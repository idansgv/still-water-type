#!/usr/bin/env python3
"""Local dev server that never lets the browser cache anything.

  python3 tools/dev.py [port] [host] # default 8910 on 127.0.0.1; use 0.0.0.0 to reach it from a phone on the same Wi-Fi (anything on that network can read the repo, fonts included)

Python's plain `http.server` sends no cache headers, so browsers reuse old copies of the ES modules
(src/*.js) and a page can end up running a mix of old and new files. This sends `Cache-Control: no-store`.
"""
import json, os, re, sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')

class H(SimpleHTTPRequestHandler):
    # The settings panel's "Save as defaults": POST /__params/<slug> with the poster's settings as JSON lands in src/posters/params/<slug>.json (local requests only).
    def do_POST(self):
        m = re.fullmatch(r'/__params/([a-z0-9-]+)', self.path)
        local = self.client_address[0] in ('127.0.0.1', '::1')
        try:
            n = int(self.headers.get('Content-Length', '0'))
            if not (m and local) or n <= 0 or n > 20000: raise ValueError('refused')
            data = json.loads(self.rfile.read(n))
            if not isinstance(data, dict) or not all(isinstance(v, (int, float, str, bool)) for v in data.values()): raise ValueError('not settings')
            path = os.path.join(ROOT, 'src', 'posters', 'params', m.group(1) + '.json')
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'w') as f: json.dump(data, f, indent=2); f.write('\n')
            self.send_response(200)
        except Exception:
            self.send_response(400)
        self.send_header('Content-Length', '0'); self.end_headers()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8910
    host = sys.argv[2] if len(sys.argv) > 2 else '127.0.0.1'
    print(f'Serving {os.path.abspath(ROOT)} on http://{host}:{port}  (no caching)')
    ThreadingHTTPServer((host, port), partial(H, directory=ROOT)).serve_forever()
