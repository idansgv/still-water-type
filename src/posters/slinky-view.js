// The camera shared by the Slinky scenes (the factory and the stairs). An orthographic tilt (yaw and pitch) with a zoom; a few named
// views the camera eases between; dragging empty space orbits; the keys 1 to 6 pick a view. World: x to the right, y up, z toward you.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createView(stage, iso = { yaw: 50, pitch: 32 }) {
  const VIEWS = {
    iso: { label: 'Isometric', key: '1', yaw: () => iso.yaw, pitch: () => iso.pitch, zoom: 1 },
    side: { label: 'Side', key: '2', yaw: () => 0, pitch: () => 0, zoom: 1 },
    front: { label: 'Front', key: '3', yaw: () => 90, pitch: () => 0, zoom: 1 },
    top: { label: 'Top', key: '4', yaw: () => 0, pitch: () => 89, zoom: 1 },
    close: { label: 'Close', key: '5', yaw: () => 35, pitch: () => 18, zoom: 1.9, focus: 'front' },
    wide: { label: 'Wide', key: '6', yaw: () => 40, pitch: () => 25, zoom: 0.55 },
  };
  const view = { yaw: iso.yaw, pitch: iso.pitch, zoom: 1 }, vt = { yaw: iso.yaw, pitch: iso.pitch, zoom: 1 };
  const V = {
    VIEWS, iso, view, name: 'iso', focus: 'centroid', mode: 'factory', zoomMul: 1, lock: false, onChange: () => {},
    setView(name) {
      const v = VIEWS[name]; if (!v) return;
      V.name = name; V.focus = v.focus || 'centroid'; vt.yaw = v.yaw(); vt.pitch = v.pitch(); vt.zoom = v.zoom; V.onChange();
    },
    ease() { view.yaw += (vt.yaw - view.yaw) * 0.14; view.pitch += (vt.pitch - view.pitch) * 0.14; view.zoom += (vt.zoom - view.zoom) * 0.14; },
    rot() { const y = view.yaw * Math.PI / 180, x = -view.pitch * Math.PI / 180; return { cy: Math.cos(y), sy: Math.sin(y), cx: Math.cos(x), sx: Math.sin(x), z: view.zoom * V.zoomMul }; },
    project(v, r, ox, oy) { const x1 = r.cy * v[0] + r.sy * v[2], z1 = -r.sy * v[0] + r.cy * v[2], y2 = r.cx * v[1] - r.sx * z1; return [ox + x1 * r.z, oy - y2 * r.z, r.sx * v[1] + r.cx * z1]; },
    origin(r, cam, W, H) { const o = V.project([cam.x, cam.y, 0], r, 0, 0); return [W / 2 - o[0], H / 2 - o[1]]; },
    // the pointer's place on the plane z = 0, inverting the view (null when that plane is seen edge-on)
    onPlane(q, cam, W, H) {
      const r = V.rot(); if (Math.abs(r.cy) < 0.2 || r.cx < 0.2) return null;
      const [ox, oy] = V.origin(r, cam, W, H), x = (q.x - ox) / (r.cy * r.z), y = ((oy - q.y) / r.z - r.sx * r.sy * x) / r.cx;
      return [x, y];
    },
    orbit: {
      s: null,
      start(q) { V.orbit.s = { x: q.x, y: q.y, yaw: vt.yaw, pitch: vt.pitch }; },
      move(q) { const s = V.orbit.s; if (!s) return; vt.yaw = s.yaw + (q.x - s.x) * 0.35; vt.pitch = clamp(s.pitch + (q.y - s.y) * 0.3, 0, 89); V.name = 'custom'; V.focus = 'centroid'; },
      end() { V.orbit.s = null; V.onChange(); },
    },
  };
  const onKey = (e) => {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const name = Object.keys(VIEWS).find((k) => VIEWS[k].key === e.key); if (name) V.setView(name);
  };
  addEventListener('keydown', onKey);
  V.destroy = () => removeEventListener('keydown', onKey);
  return V;
}
