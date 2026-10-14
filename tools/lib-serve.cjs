// Start the dev server on a spare port for a script, and stop it after. If BASE_URL is set that build is used instead and nothing is started.
const { spawn } = require('child_process');
const path = require('path');
const net = require('net');
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
async function serve() {
  if (process.env.BASE_URL) return { base: process.env.BASE_URL, stop() {} };
  const port = await freePort(), base = `http://127.0.0.1:${port}`;
  const child = spawn('python3', [path.join(__dirname, 'dev.py'), String(port)], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { if ((await fetch(base + '/')).ok) break; } catch (e) { /* not up yet */ } await new Promise((r) => setTimeout(r, 100)); }
  return { base, stop() { child.kill(); } };
}
module.exports = { serve };
