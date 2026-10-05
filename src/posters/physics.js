// A thin layer over Rapier (Apache-2.0, WASM, vendored in src/vendor), so the posters talk to bodies that look like
// plain objects: body.position, body.quaternion, body.velocity are refreshed after every step, and only for bodies
// that are awake. World units are whatever the poster uses; z is up, gravity is -z.
//
//   const sim = await createSim({ gravity: 12 });
//   const floor = sim.fixed({ x: 0, y: 0, z: -0.5 }); sim.box(floor, [50, 50, 0.5]);
//   const b = sim.dynamic({ x: 0, y: 0, z: 2 }); sim.box(b, [0.5, 0.5, 0.5], { density: 1 });
//   sim.step(1 / 90, (a, other) => { ... });          // a collision began between a and other
//
// Rapier is loaded once, on first use (about 2 MB of WASM, cached by the browser).

import RAPIER from '../vendor/rapier.es.js';

let ready = null;
export function loadRapier() { return (ready ??= RAPIER.init().then(() => RAPIER)); }

const rotate = (q, v) => {                                           // rotate a vector by a quaternion
  const tx = 2 * (q.y * v.z - q.z * v.y), ty = 2 * (q.z * v.x - q.x * v.z), tz = 2 * (q.x * v.y - q.y * v.x);
  return { x: v.x + q.w * tx + (q.y * tz - q.z * ty), y: v.y + q.w * ty + (q.z * tx - q.x * tz), z: v.z + q.w * tz + (q.x * ty - q.y * tx) };
};
const conj = (q) => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });
const zRot = (a) => ({ x: 0, y: 0, z: Math.sin(a / 2), w: Math.cos(a / 2) });

export class Body {
  constructor(sim, rb, isStatic) {
    this.sim = sim; this.rb = rb; this.world = sim; this.static = isStatic;
    this.position = { x: 0, y: 0, z: 0 }; this.quaternion = { x: 0, y: 0, z: 0, w: 1 }; this.velocity = { x: 0, y: 0, z: 0 };
    this.shapes = []; this.shapeOffsets = []; this.shapeOrientations = []; this.colliders = [];
    this.pv = { x: 0, y: 0, z: 0 };                                  // velocity just before the last step
    this.sync();
  }
  get mass() { return this.rb.mass(); }
  get sleeping() { return this.rb.isSleeping(); }
  sync() {
    const t = this.rb.translation(), r = this.rb.rotation(), v = this.rb.linvel(), p = this.position, q = this.quaternion, w = this.velocity;
    p.x = t.x; p.y = t.y; p.z = t.z; q.x = r.x; q.y = r.y; q.z = r.z; q.w = r.w; w.x = v.x; w.y = v.y; w.z = v.z;
  }
  wake() { this.rb.wakeUp(); }
  sleep() { this.rb.sleep(); }
  setVelocity(x, y, z) { this.rb.setLinvel({ x, y, z }, true); this.velocity.x = x; this.velocity.y = y; this.velocity.z = z; }
  setSpin(x, y, z) { this.rb.setAngvel({ x, y, z }, true); }
  /** impulse at a world point */
  impulseAt(imp, point) { this.rb.applyImpulseAtPoint(imp, point, true); }
  /** impulse at a point given relative to the body's centre, in world axes */
  impulseRel(imp, rel) { this.rb.applyImpulseAtPoint(imp, { x: this.position.x + rel.x, y: this.position.y + rel.y, z: this.position.z + rel.z }, true); }
  toLocal(p) { return rotate(conj(this.quaternion), { x: p.x - this.position.x, y: p.y - this.position.y, z: p.z - this.position.z }); }
  toWorld(l) { const r = rotate(this.quaternion, l); return { x: r.x + this.position.x, y: r.y + this.position.y, z: r.z + this.position.z }; }
}

export class Sim {
  constructor(R, gravity) {
    this.R = R; this.world = new R.World({ x: 0, y: 0, z: -gravity });
    this.queue = new R.EventQueue(true);
    this.owner = new Map();                                          // collider handle -> Body
    this.dynamics = new Set();
    this.mat = { friction: 0.5, restitution: 0.1 };
  }
  setGravity(g) { this.world.gravity = { x: 0, y: 0, z: -g }; }
  setSolver(n) { try { this.world.numSolverIterations = n; } catch (e) { /* older build */ } }

  fixed(pos) { return this._make(this.R.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z), true); }
  dynamic(pos, o = {}) {
    let d = this.R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setCanSleep(o.canSleep !== false);
    if (o.angle) { const q = zRot(o.angle); d = d.setRotation(q); }
    if (o.linearDamping != null) d = d.setLinearDamping(o.linearDamping);
    if (o.angularDamping != null) d = d.setAngularDamping(o.angularDamping);
    if (o.ccd) d = d.setCcdEnabled(true);
    const b = this._make(d, false); this.dynamics.add(b); return b;
  }
  _make(desc, isStatic) { return new Body(this, this.world.createRigidBody(desc), isStatic); }

  _desc(desc, o) {
    const R = this.R;
    desc.setFriction(o.friction ?? this.mat.friction).setRestitution(o.restitution ?? this.mat.restitution)
      .setFrictionCombineRule(R.CoefficientCombineRule.Max).setRestitutionCombineRule(R.CoefficientCombineRule.Min);
    if (o.density != null) desc.setDensity(o.density);
    if (o.events) desc.setActiveEvents(R.ActiveEvents.COLLISION_EVENTS);
    return desc;
  }
  _attach(body, desc, o, record) {
    const c = this.world.createCollider(desc, body.rb);
    this.owner.set(c.handle, body); body.colliders.push(c);
    body.shapes.push(record.shape); body.shapeOffsets.push(record.offset); body.shapeOrientations.push(record.orientation);
    return c;
  }
  /** a box with half extents [hx, hy, hz], at `offset` in the body's frame, turned `angle` about z */
  box(body, half, o = {}) {
    const off = o.offset || { x: 0, y: 0, z: 0 }, q = zRot(o.angle || 0);
    const desc = this._desc(this.R.ColliderDesc.cuboid(half[0], half[1], half[2]).setTranslation(off.x, off.y, off.z).setRotation(q), o);
    return this._attach(body, desc, o, { shape: { halfExtents: { x: half[0], y: half[1], z: half[2] } }, offset: off, orientation: q });
  }
  /** a convex hull from flat vertices [x, y, z, ...]; returns null if Rapier cannot build one */
  hull(body, flat, o = {}) {
    const d = this.R.ColliderDesc.convexHull(flat); if (!d) return null;
    return this._attach(body, this._desc(d, o), o, { shape: { halfExtents: { x: 0, y: 0, z: 0 } }, offset: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } });
  }
  removeCollider(body, collider) {
    const k = body.colliders.indexOf(collider); if (k < 0) return;
    body.colliders.splice(k, 1); body.shapes.splice(k, 1); body.shapeOffsets.splice(k, 1); body.shapeOrientations.splice(k, 1);
    this.owner.delete(collider.handle); this.world.removeCollider(collider, true);
  }
  remove(body) {
    for (const c of body.colliders) this.owner.delete(c.handle);
    body.colliders.length = 0; body.world = null; this.dynamics.delete(body);
    this.world.removeRigidBody(body.rb);
  }
  setMaterial(friction, restitution) {                              // change every collider that is not a wall
    this.mat.friction = friction; this.mat.restitution = restitution;
    for (const b of this.owner.values()) { if (b.isWall) continue; for (const c of b.colliders) { c.setFriction(friction); c.setRestitution(restitution); } }
  }

  /** the first thing hit by a ray from (x, y, top) straight down: { body, point } or null */
  castDown(x, y, top = 8) {
    const hit = this.world.castRay(new this.R.Ray({ x, y, z: top }, { x: 0, y: 0, z: -1 }), top + 2, true);
    if (!hit) return null;
    const body = this.owner.get(hit.collider.handle); if (!body) return null;
    return { body, point: { x, y, z: top - hit.timeOfImpact }, collider: hit.collider };
  }

  /** the first thing hit by a ray in any direction: { body, point } or null */
  cast(origin, dir, maxToi = 100) {
    const hit = this.world.castRay(new this.R.Ray(origin, dir), maxToi, true);
    if (!hit) return null;
    const body = this.owner.get(hit.collider.handle); if (!body) return null;
    const t = hit.timeOfImpact;
    return { body, point: { x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t }, collider: hit.collider };
  }

  step(dt, onHit) {
    this.world.timestep = dt;
    for (const b of this.dynamics) { b.pv.x = b.velocity.x; b.pv.y = b.velocity.y; b.pv.z = b.velocity.z; }
    this.world.step(this.queue);
    if (onHit) this.queue.drainCollisionEvents((h1, h2, started) => {
      if (!started) return;
      const a = this.owner.get(h1), b = this.owner.get(h2);
      if (a && b) onHit(a, b);
    });
    else this.queue.drainCollisionEvents(() => {});
    for (const b of this.dynamics) if (!b.rb.isSleeping()) b.sync();
  }
}

export async function createSim(o = {}) {
  const R = await loadRapier();
  return new Sim(R, o.gravity ?? 12);
}
