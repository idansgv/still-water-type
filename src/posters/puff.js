// Puff up and away: each letter is a balloon. Hold to inflate, drag to aim, release to launch.
// Ported from the standalone Vite project (Canvas 2D, elastic spring-mesh letters). Black and white only,
// DynaPuff for the letters, no outlines, no corners. Colour comes from the stage theme (pure black/white).

const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const smooth = (t) => { t = clamp(t,0,1); return t*t*(3-2*t); };
const FONT = '"DynaPuff","Fredoka","Avenir Next Rounded",system-ui,sans-serif';
const fontStr = (px) => `700 ${px}px ${FONT}`;

async function loadFont() {
  if (!document.getElementById('font-dynapuff')) {
    const l = document.createElement('link');
    l.id = 'font-dynapuff'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=DynaPuff:wght@700&display=swap';
    document.head.appendChild(l);
  }
  try {
    await Promise.race([document.fonts.load('700 100px "DynaPuff"', 'PUFFUPANDAWAY'), new Promise((r) => setTimeout(r, 2500))]);
  } catch (e) { /* fall back to the rounded system face */ }
}

export async function mount(stage) {
  await loadFont();
  const ctx = stage.canvas.getContext('2d');
  const mc = document.createElement('canvas').getContext('2d');
  const H_STEP = 1/240;


  let W=1, H=1, DPR=1, ready=false, timers=[];
  let letters=[], puffs=[], gravity=900, timeScale=1, acc=0, col={ink:'#000', paper:'#fff'};

  function readColors(){
    const dark = stage.theme.name === 'dark';
    col = { ink: dark ? '#fff' : '#000', paper: dark ? '#000' : '#fff' };
    stage.setBackdrop(dark ? 0 : 1);
  }

  function renderSprite(l){
    const q = Math.min(DPR,2)*1.6, pad = 10;
    const c = document.createElement('canvas');
    c.width = Math.ceil((l.bw+2*pad)*q); c.height = Math.ceil((l.bh+2*pad)*q);
    const g = c.getContext('2d'); g.scale(q,q);
    g.font = fontStr(l.fs); g.textBaseline = 'alphabetic'; g.fillStyle = col.ink;
    g.fillText(l.ch, pad+l.L, pad+l.A);
    l.sprite = c; l.q = q; l.pad = pad;
  }


  // ---- elastic mesh: each letter is a grid of damped springs that lags behind the body ----
  function initMesh(l){
    const sw = l.sprite.width/l.q, sh = l.sprite.height/l.q;
    const gx = clamp(Math.round(sw/22),3,10), gy = clamp(Math.round(sh/22),3,10), W1 = gx+1, nn = W1*(gy+1);
    Object.assign(l, { gx, gy, nn, rx:new Float32Array(nn), ry:new Float32Array(nn), tu:new Float32Array(nn), tv:new Float32Array(nn),
      w:new Float32Array(nn), k:new Float32Array(nn), dx:new Float32Array(nn), dy:new Float32Array(nn),
      mvx:new Float32Array(nn), mvy:new Float32Array(nn), ndx:new Float32Array(nn), ndy:new Float32Array(nn),
      nvx:new Float32Array(nn), nvy:new Float32Array(nn), mrest:true, pvx:0, pvy:0, pav:0 });
    const ox = -l.bw/2-l.pad, oy = -l.bh/2-l.pad, SW = l.sprite.width, SH = l.sprite.height;
    for (let j=0;j<=gy;j++) for (let i=0;i<=gx;i++){
      const k = j*W1+i;
      l.rx[k] = ox+i/gx*sw; l.ry[k] = oy+j/gy*sh; l.tu[k] = i/gx*SW; l.tv[k] = j/gy*SH;
      const rr = Math.min(1, Math.hypot(l.rx[k]/(l.bw/2+l.pad), l.ry[k]/(l.bh/2+l.pad))/1.2);
      l.w[k] = Math.pow(rr,1.3); l.k[k] = 220-110*rr;
    }
    const img = l.sprite.getContext('2d').getImageData(0,0,SW,SH).data;
    l.cell = new Uint8Array(gx*gy);
    for (let j=0;j<gy;j++) for (let i=0;i<gx;i++){
      const x0 = Math.max(0,Math.floor(i/gx*SW)-1), x1 = Math.min(SW-1,Math.ceil((i+1)/gx*SW)+1);
      const y0 = Math.max(0,Math.floor(j/gy*SH)-1), y1 = Math.min(SH-1,Math.ceil((j+1)/gy*SH)+1);
      let on = 0;
      for (let y=y0;y<=y1 && !on;y+=2) for (let x=x0;x<=x1;x+=2) if (img[(y*SW+x)*4+3] > 8){ on = 1; break; }
      l.cell[j*gx+i] = on;
    }
  }

  function updateMesh(l, dt, ax, ay, al){
    const stretch = l.state==='inflating' ? l.a*0.12 : 0;
    const calm = Math.abs(ax)<150 && Math.abs(ay)<150 && Math.abs(al)<2 && stretch===0;
    if (l.mrest && calm) return;
    const c = Math.cos(-l.angle), s = Math.sin(-l.angle), sc = l.s;
    let lax = (ax*c-ay*s)/sc, lay = (ax*s+ay*c)/sc;
    const m = Math.hypot(lax,lay); if (m > 3500){ lax *= 3500/m; lay *= 3500/m; }
    const om2 = l.av*l.av*0.04, tg = 0.3*al;
    const ac = Math.cos(l.aim-l.angle), as = Math.sin(l.aim-l.angle);
    const W1 = l.gx+1, gy = l.gy, gx = l.gx, nn = l.nn;
    const lim = 0.22*Math.min(l.bw,l.bh)+8, sub = 2, h = Math.min(dt,1/30)/sub, cd = 5.5, kc = 40;
    let maxE = 0;
    for (let it=0; it<sub; it++){
      for (let j=0;j<=gy;j++) for (let i=0;i<=gx;i++){
        const k = j*W1+i, px = l.rx[k], py = l.ry[k], w = l.w[k];
        const dotA = px*ac+py*as, dotP = -px*as+py*ac;
        const tx = ac*dotA*stretch + as*0.5*stretch*dotP, ty = as*dotA*stretch - ac*0.5*stretch*dotP;
        const kl = i>0?k-1:k, kr = i<gx?k+1:k, ku = j>0?k-W1:k, kd = j<gy?k+W1:k;
        const avx = (l.dx[kl]+l.dx[kr]+l.dx[ku]+l.dx[kd])/4, avy = (l.dy[kl]+l.dy[kr]+l.dy[ku]+l.dy[kd])/4;
        const exx = w*(-0.45*lax + om2*px + tg*py), exy = w*(-0.45*lay + om2*py - tg*px);
        const kk = l.k[k];
        l.nvx[k] = l.mvx[k] + (-kk*(l.dx[k]-tx) - cd*l.mvx[k] + kc*4*(avx-l.dx[k]) + exx)*h;
        l.nvy[k] = l.mvy[k] + (-kk*(l.dy[k]-ty) - cd*l.mvy[k] + kc*4*(avy-l.dy[k]) + exy)*h;
      }
      for (let k=0;k<nn;k++){
        l.mvx[k] = l.nvx[k]; l.mvy[k] = l.nvy[k];
        let x = l.dx[k]+l.mvx[k]*h, y = l.dy[k]+l.mvy[k]*h;
        const d = Math.hypot(x,y); if (d > lim){ x *= lim/d; y *= lim/d; }
        l.dx[k] = x; l.dy[k] = y;
        const e = Math.abs(x)+Math.abs(y)+0.1*(Math.abs(l.mvx[k])+Math.abs(l.mvy[k]));
        if (e > maxE) maxE = e;
      }
    }
    if (calm && maxE < 0.05){ l.dx.fill(0); l.dy.fill(0); l.mvx.fill(0); l.mvy.fill(0); l.mrest = true; }
    else l.mrest = false;
  }

  function tri(l, a, b, c){
    const u0=l.tu[a], v0=l.tv[a], u1=l.tu[b], v1=l.tv[b], u2=l.tu[c], v2=l.tv[c];
    const x0=l.rx[a]+l.dx[a], y0=l.ry[a]+l.dy[a], x1=l.rx[b]+l.dx[b], y1=l.ry[b]+l.dy[b], x2=l.rx[c]+l.dx[c], y2=l.ry[c]+l.dy[c];
    const det = (u1-u0)*(v2-v0)-(u2-u0)*(v1-v0); if (Math.abs(det) < 1e-6) return;
    const A = ((x1-x0)*(v2-v0)-(x2-x0)*(v1-v0))/det, C = ((x2-x0)*(u1-u0)-(x1-x0)*(u2-u0))/det;
    const B = ((y1-y0)*(v2-v0)-(y2-y0)*(v1-v0))/det, D = ((y2-y0)*(u1-u0)-(y1-y0)*(u2-u0))/det;
    const E = x0-A*u0-C*v0, F = y0-B*u0-D*v0;
    const cx = (x0+x1+x2)/3, cy = (y0+y1+y2)/3, grow = p => p;
    const ex = (x,y) => { const dx=x-cx, dy=y-cy, d=Math.hypot(dx,dy)||1; return [x+dx/d*0.8, y+dy/d*0.8]; };
    const p0 = ex(x0,y0), p1 = ex(x1,y1), p2 = ex(x2,y2);
    const su = Math.max(0,Math.min(u0,u1,u2)-2), sv = Math.max(0,Math.min(v0,v1,v2)-2);
    const eu = Math.min(l.sprite.width,Math.max(u0,u1,u2)+2), ev = Math.min(l.sprite.height,Math.max(v0,v1,v2)+2);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(p0[0],p0[1]); ctx.lineTo(p1[0],p1[1]); ctx.lineTo(p2[0],p2[1]); ctx.closePath(); ctx.clip();
    ctx.transform(A,B,C,D,E,F);
    ctx.drawImage(l.sprite, su, sv, eu-su, ev-sv, su, sv, eu-su, ev-sv);
    ctx.restore();
  }

  function drawMesh(l){
    const gx = l.gx, gy = l.gy, W1 = gx+1;
    for (let j=0;j<gy;j++) for (let i=0;i<gx;i++){
      if (!l.cell[j*gx+i]) continue;
      const a = j*W1+i, b = a+1, c = a+W1, d = c+1;
      tri(l,a,b,c); tri(l,b,d,c);
    }
  }

  function build(){
    letters = []; puffs = [];
    const lines = W/H > 1.15 ? ['PUFF UP','AND AWAY'] : ['PUFF','UP','AND','AWAY'];
    const top = 40, bottom = 120, availH = H-top-bottom, targetW = W-2*Math.max(20, W*0.06);
    const info = lines.map(t => {
      mc.font = fontStr(100);
      const w = mc.measureText(t).width, cap = mc.measureText('H').actualBoundingBoxAscent/100;
      const fs = targetW/w*100;
      return { t, fs, capPx: cap*fs, cap };
    });
    let gap = 0.12*Math.max(...info.map(l => l.capPx));
    let total = info.reduce((s,l) => s+l.capPx, 0) + gap*(info.length-1);
    const f = Math.min(1, availH/total);
    info.forEach(l => { l.fs*=f; l.capPx*=f; }); gap*=f; total*=f;
    let y = top + (availH-total)/2;
    for (const l of info){
      mc.font = fontStr(l.fs);
      const lineW = mc.measureText(l.t).width, x0 = (W-lineW)/2, base = y+l.capPx;
      for (let i=0;i<l.t.length;i++){
        const ch = l.t[i]; if (ch === ' ') continue;
        const pre = mc.measureText(l.t.slice(0,i)).width, m = mc.measureText(ch);
        const L = m.actualBoundingBoxLeft, R = m.actualBoundingBoxRight, A = m.actualBoundingBoxAscent, D = m.actualBoundingBoxDescent;
        const bw = L+R, bh = A+D, hx = x0+pre+(R-L)/2, hy = base-(A-D)/2;
        const o = { ch, fs:l.fs, L, A, bw, bh, hx, hy, x:hx, y:hy, vx:0, vy:0, angle:0, av:0, s:1, a:0,
          state:'home', timer:0, knot:Math.PI/2, aim:-Math.PI/2, ax:hx, ay:hy, t:0, ph:Math.random()*6.28,
          rc:0.5*(bw+bh)/2*0.95, rk:0.5*Math.max(bw,bh)*0.78, auto:false };
        renderSprite(o); initMesh(o); letters.push(o);
      }
      y += l.capPx+gap;
    }
  }

  function resize(){
    W = stage.W; H = stage.H;
    DPR = stage.pw / stage.W;
    if (ready) build();
  }

  function launch(l){
    if (l.state !== 'inflating') return;
    l.state = 'flying'; l.auto = false; l.a = Math.max(l.a, 0.3); l.t = 0;
  }

  function step(l, h){
    l.t += h;
    const st = l.state;
    if (st === 'home' || st === 'inflating'){
      const tx = st==='inflating' ? l.ax : l.hx, ty = st==='inflating' ? l.ay : l.hy;
      l.vx += (500*(tx-l.x) - 36*l.vx)*h; l.vy += (500*(ty-l.y) - 36*l.vy)*h;
      l.av += (300*(0-l.angle) - 20*l.av)*h;
      if (st === 'inflating'){
        l.a = Math.min(1, l.a + h*0.75);
        l.s = 1 + 1.4*smooth(l.a);
        if (l.auto && l.a >= 0.85) launch(l);
      } else l.s += (1-l.s)*Math.min(1, h*12);
    } else if (st === 'flying'){
      l.a -= h*(0.55 + 0.4*l.a);
      if (l.a <= 0){ l.a = 0; l.state = 'free'; l.timer = 0; }
      l.s = 1 + 1.4*smooth(l.a);
      const wa = l.knot + l.angle;
      const jit = Math.sin(l.t*26+l.ph)*0.28*(0.4+l.a) + Math.sin(l.t*13+l.ph*2)*0.18;
      const dir = wa + Math.PI + jit, T = 2300*(0.25+0.75*l.a);
      const Fx = Math.cos(dir)*T, Fy = Math.sin(dir)*T;
      const rk = l.rk*l.s, ox = Math.cos(wa)*rk, oy = Math.sin(wa)*rk;
      const I = 0.5*(l.rc*l.s)*(l.rc*l.s);
      l.av += ((ox*Fy - oy*Fx)/I)*h;
      l.vx += Fx*h; l.vy += (Fy+gravity)*h;
      const d = Math.exp(-1.0*h); l.vx*=d; l.vy*=d; l.av*=Math.exp(-1.6*h);
    } else if (st === 'free'){
      l.vy += gravity*h;
      const d = Math.exp(-0.5*h); l.vx*=d; l.vy*=d; l.av*=Math.exp(-1.0*h);
      l.s += (1-l.s)*Math.min(1, h*6);
      l.timer += h; if (l.timer > 2.4) l.state = 'returning';
    } else if (st === 'returning'){
      l.vx += (40*(l.hx-l.x) - 12.6*l.vx)*h; l.vy += (40*(l.hy-l.y) - 12.6*l.vy)*h;
      const ta = Math.round(l.angle/(Math.PI*2))*Math.PI*2;
      l.av += (120*(ta-l.angle) - 22*l.av)*h;
      l.s += (1-l.s)*Math.min(1, h*8);
      if (Math.abs(l.hx-l.x)<1.2 && Math.abs(l.hy-l.y)<1.2 && Math.hypot(l.vx,l.vy)<15 && Math.abs(ta-l.angle)<0.05){
        l.state='home'; l.x=l.hx; l.y=l.hy; l.vx=l.vy=0; l.angle=0; l.av=0; l.s=1; l.a=0;
      }
    }
    l.x += l.vx*h; l.y += l.vy*h; l.angle += l.av*h;
    if (l.state === 'flying' || l.state === 'free'){
      const wb = l.bw*0.45*l.s, hb = l.bh*0.45*l.s, floor = H-6;
      if (l.y > floor-hb){ l.y = floor-hb; if (l.vy>0) l.vy *= -0.4; l.vx *= (1-4*h); l.av *= (1-3*h); }
      if (l.y < hb){ l.y = hb; l.vy = Math.abs(l.vy)*0.4; }
      if (l.x < wb){ l.x = wb; l.vx = Math.abs(l.vx)*0.5; }
      if (l.x > W-wb){ l.x = W-wb; l.vx = -Math.abs(l.vx)*0.5; }
    }
  }

  function collide(a, b){
    if (a.state==='returning' || b.state==='returning') return;
    const mv = l => l.state==='flying' || l.state==='free';
    let aM = mv(a), bM = mv(b);
    if (!aM && !bM && a.state!=='inflating' && b.state!=='inflating') return;
    const dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy)||1e-3, rr=(a.rc*a.s+b.rc*b.s)*0.9;
    if (d >= rr) return;
    if (a.state==='home'){ a.state='free'; a.timer=0; aM=true; }
    if (b.state==='home'){ b.state='free'; b.timer=0; bM=true; }
    const nx=dx/d, ny=dy/d, o=rr-d;
    if (!aM && bM){ b.x+=nx*o; b.y+=ny*o; b.vx+=nx*o*12; b.vy+=ny*o*12; }
    else if (aM && !bM){ a.x-=nx*o; a.y-=ny*o; a.vx-=nx*o*12; a.vy-=ny*o*12; }
    else if (aM && bM){ a.x-=nx*o/2; a.y-=ny*o/2; b.x+=nx*o/2; b.y+=ny*o/2; }
    else return;
    const rv = (b.vx-a.vx)*nx + (b.vy-a.vy)*ny;
    if (rv < 0){
      const j = -(1.5)*rv;
      if (aM && bM){ a.vx-=nx*j/2; a.vy-=ny*j/2; b.vx+=nx*j/2; b.vy+=ny*j/2; }
      else if (bM){ b.vx+=nx*j; b.vy+=ny*j; } else { a.vx-=nx*j; a.vy-=ny*j; }
    }
    a.av += (Math.random()-0.5)*2; b.av += (Math.random()-0.5)*2;
  }

  function emit(l, dt){
    if (l.state !== 'flying') return;
    const wa = l.knot + l.angle, rk = l.rk*l.s;
    let n = 150*(0.3+l.a)*dt; n = Math.floor(n) + (Math.random() < n%1 ? 1 : 0);
    for (let k=0;k<n;k++){
      const sp = 300+Math.random()*220, sx = (Math.random()-0.5)*160, dx = Math.cos(wa), dy = Math.sin(wa);
      puffs.push({ x:l.x+dx*rk, y:l.y+dy*rk, vx:l.vx+dx*sp-dy*sx, vy:l.vy+dy*sp+dx*sx, life:0, max:0.45+Math.random()*0.35, r:3+Math.random()*3 });
    }
  }

  function update(dt){
    acc += dt; let g = 0;
    while (acc >= H_STEP && g++ < 24){
      acc -= H_STEP;
      for (const l of letters) step(l, H_STEP);
      for (let i=0;i<letters.length;i++) for (let j=i+1;j<letters.length;j++) collide(letters[i], letters[j]);
    }
    if (g >= 24) acc = 0;
    if (dt > 1e-5) for (const l of letters){
      const ax = (l.vx-l.pvx)/dt, ay = (l.vy-l.pvy)/dt, al = (l.av-l.pav)/dt;
      l.pvx = l.vx; l.pvy = l.vy; l.pav = l.av;
      updateMesh(l, dt, ax, ay, al);
    }
    for (const l of letters) emit(l, dt);
    for (const p of puffs){ p.life += dt; const k = Math.exp(-3*dt); p.vx*=k; p.vy*=k; p.x+=p.vx*dt; p.y+=p.vy*dt; p.r+=dt*45; }
    puffs = puffs.filter(p => p.life < p.max);
  }

  function draw(){
    ctx.setTransform(DPR,0,0,DPR,0,0);
    ctx.fillStyle = col.paper; ctx.fillRect(0,0,W,H);
    for (const p of puffs){
      ctx.fillStyle = col.ink;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0, p.r*(1-p.life/p.max)), 0, Math.PI*2); ctx.fill();
    }
    const order = letters.slice().sort((a,b) => a.s-b.s);
    for (const l of order){
      if (l.state === 'inflating'){
        ctx.fillStyle = col.ink;
        const base = l.rk*l.s;
        for (let k=1;k<=4;k++){
          ctx.beginPath();
          ctx.arc(l.ax+Math.cos(l.aim)*(base+26*k), l.ay+Math.sin(l.aim)*(base+26*k), 5-k*0.8, 0, Math.PI*2); ctx.fill();
        }
      }
      ctx.save();
      const wob = l.state==='inflating' ? Math.sin(l.t*40)*1.2*l.a : 0;
      ctx.translate(l.x+wob, l.y);
      const sp = Math.hypot(l.vx, l.vy);
      if (sp > 40 && (l.state==='flying' || l.state==='free')){
        const va = Math.atan2(l.vy, l.vx), s = 1+Math.min(0.28, sp/2800);
        ctx.rotate(va); ctx.scale(s, 1/Math.pow(s,0.6)); ctx.rotate(-va);
      }
      ctx.rotate(l.angle); ctx.scale(l.s, l.s);
      if (l.mrest) ctx.drawImage(l.sprite, -l.bw/2-l.pad, -l.bh/2-l.pad, l.sprite.width/l.q, l.sprite.height/l.q);
      else drawMesh(l);
      if (l.state==='inflating' || l.state==='flying'){
        const kx = Math.cos(l.knot)*l.rk, ky = Math.sin(l.knot)*l.rk;
        ctx.fillStyle = col.ink;
        ctx.beginPath(); ctx.ellipse(kx, ky, 11, 7, l.knot, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }
  }

  const off = [];
  off.push(stage.frame((dt) => { update(Math.min(dt, 1/30)*timeScale); draw(); }));

  // input
  const active = new Map();
  function hit(p){
    const order = letters.slice().sort((a,b) => b.s-a.s);
    for (const l of order){
      if (l.state==='flying' || l.state==='inflating') continue;
      const dx = p.x-l.x, dy = p.y-l.y, c = Math.cos(-l.angle), s = Math.sin(-l.angle);
      const lx = dx*c-dy*s, ly = dx*s+dy*c;
      if (Math.abs(lx) <= l.bw/2*l.s+10 && Math.abs(ly) <= l.bh/2*l.s+10) return l;
    }
    return null;
  }
  function aim(l, p){
    const dx = p.x-l.ax, dy = p.y-l.ay;
    if (Math.hypot(dx,dy) > 16){ l.aim = Math.atan2(dy,dx); l.knot = l.aim+Math.PI-l.angle; }
  }
  off.push(stage.on('down', (q, e) => {
    const p = { x:q.x, y:q.y }, l = hit(p);
    if (!l) return;
    l.state='inflating'; l.ax=l.x; l.ay=l.y; l.vx=l.vy=0; l.a=0.12; l.auto=false;
    l.aim=-Math.PI/2; l.knot=Math.PI/2-l.angle; l.t=0;
    aim(l, p);
    active.set(e.pointerId, l);
  }));
  off.push(stage.on('move', (q, e) => {
    const l = active.get(e.pointerId), p = { x:q.x, y:q.y };
    if (l) aim(l, p); else if (q.type === 'mouse') stage.root.style.cursor = hit(p) ? 'grab' : '';
  }));
  const end = (q, e) => {
    const l = active.get(e.pointerId); if (!l) return;
    active.delete(e.pointerId); launch(l);
  };
  off.push(stage.on('up', end));

  const reform = () => {
    for (const l of letters) if (l.state !== 'home') { l.state = 'returning'; l.a = 0; }
    active.clear();
  };

  function start(){
    if (ready) return;
    ready = true; build();
    timers.push(setTimeout(() => {
      const l = letters[0]; if (!l || l.state !== 'home') return;
      l.state='inflating'; l.ax=l.x; l.ay=l.y; l.a=0.12; l.auto=true;
      l.aim = Math.atan2(H*0.65-l.ay, W*0.75-l.ax); l.knot = l.aim+Math.PI;
    }, 900));
  }

  readColors();
  resize();
  stage.on('resize', resize);
  start();

  const tune = {
    title: 'Puff',
    values: { gravity: 900, slow: 0 },
    defaults: { gravity: 900, slow: 0 },
    groups: [{ name: 'World', items: [
      { key: 'gravity', label: 'Gravity', min: 0, max: 1800, step: 50 },
      { key: 'slow', label: 'Slow motion', type: 'toggle' },
    ] }],
    actions: { 'Re-form': reform },
    set(k, v) { tune.values[k] = v; if (k === 'gravity') gravity = v; if (k === 'slow') timeScale = v ? 0.25 : 1; },
    reset() { Object.assign(tune.values, tune.defaults); gravity = 900; timeScale = 1; },
  };

  return {
    tune,
    debug: { letters: () => letters },
    destroy() {
      off.forEach((f) => f());
      timers.forEach(clearTimeout);
      stage.root.style.cursor = '';
      stage.setBackdrop(null);
    },
  };
}
