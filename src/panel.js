// A small tuning panel for posters. A poster that wants one returns `tune` from mount():
//
//   tune = {
//     title: 'Sheet',
//     values: { relief: 1.1, ... },          // live object the poster reads from
//     defaults: { ... },
//     groups: [ { name: 'Paper', items: [ { key, label, min, max, step } | { key, label, type: 'text' } ] } ],
//     actions: { 'New paper': fn, ... },
//     set(key, value),                       // called on every change
//     reset(),
//   }
//
// Open it with ?tune, or press T. Settings persist (per poster, in this browser) while ?tune is on, and
// "Copy settings" puts them on the clipboard as JSON to paste back into the poster's defaults.

export function createPanel(tune, { toast = () => {}, onClose = () => {} } = {}) {
  const el = document.createElement('aside');
  el.className = 'tune';
  el.setAttribute('aria-label', `${tune.title} settings`);
  const refs = {};

  const head = document.createElement('div');
  head.className = 'tune-head';
  head.innerHTML = `<b>${tune.title}</b><button type="button" class="tune-x" aria-label="Close settings">Close</button>`;
  head.querySelector('.tune-x').addEventListener('click', () => { destroy(); onClose(); });
  el.appendChild(head);

  const actions = document.createElement('div');
  actions.className = 'tune-actions';
  const mk = (label, fn) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = label; b.addEventListener('click', fn); actions.appendChild(b);
  };
  Object.entries(tune.actions || {}).forEach(([label, fn]) => mk(label, fn));
  mk('Copy settings', async () => {
    const json = JSON.stringify(tune.values, null, 2);
    try { await navigator.clipboard.writeText(json); toast('Settings copied'); }
    catch (e) { window.prompt && toast('Copy blocked: see the console'); console.log(json); }
  });
  mk('Reset', () => { tune.reset(); sync(); toast('Reset to defaults'); });
  el.appendChild(actions);

  const fmt = (v, step) => (step && step < 1 ? Number(v).toFixed(step < 0.01 ? 3 : 2) : String(Math.round(v)));

  for (const g of tune.groups) {
    const d = document.createElement('details');
    d.open = true;
    const s = document.createElement('summary');
    s.textContent = g.name;
    d.appendChild(s);
    for (const it of g.items) {
      const row = document.createElement('label');
      row.className = 'tune-row';
      const name = document.createElement('span');
      name.textContent = it.label;
      row.appendChild(name);
      if (it.type === 'text') {
        const ta = document.createElement('textarea');
        ta.rows = it.rows || 5; ta.value = tune.values[it.key];
        ta.addEventListener('input', () => tune.set(it.key, ta.value));
        row.classList.add('tune-text');
        row.appendChild(ta); refs[it.key] = { input: ta, text: true };
      } else {
        const out = document.createElement('output');
        const inp = document.createElement('input');
        inp.type = 'range'; inp.min = it.min; inp.max = it.max; inp.step = it.step; inp.value = tune.values[it.key];
        out.textContent = fmt(tune.values[it.key], it.step);
        inp.addEventListener('input', () => {
          const v = parseFloat(inp.value);
          out.textContent = fmt(v, it.step);
          tune.set(it.key, v);
        });
        row.appendChild(out); row.appendChild(inp);
        refs[it.key] = { input: inp, out, step: it.step };
      }
      d.appendChild(row);
    }
    el.appendChild(d);
  }

  function sync() {
    for (const [k, r] of Object.entries(refs)) {
      r.input.value = tune.values[k];
      if (!r.text) r.out.textContent = fmt(tune.values[k], r.step);
    }
  }
  // keep the page's own gestures out of the panel
  ['pointerdown', 'pointermove', 'pointerup', 'keydown'].forEach((t) => el.addEventListener(t, (e) => e.stopPropagation()));
  document.body.appendChild(el);

  function destroy() { el.remove(); }
  return { el, destroy, sync };
}
