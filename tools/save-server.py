#!/usr/bin/env python3
"""A tiny local receiver for images drawn in the browser (see tools/og.html).

  python3 tools/save-server.py            # listens on 127.0.0.1:8920, writes into ./assets

The page POSTs a PNG to /save?name=og.png and it lands in assets/. Local only.
"""
import os, re
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets')

class H(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_POST(self):
        q = parse_qs(urlparse(self.path).query)
        name = (q.get('name') or ['out.png'])[0]
        if not re.fullmatch(r'[A-Za-z0-9._-]+\.(png|jpg|webp)', name):
            self.send_response(400); self._cors(); self.end_headers(); return
        data = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        os.makedirs(OUT, exist_ok=True)
        with open(os.path.join(OUT, name), 'wb') as f:
            f.write(data)
        self.send_response(200); self._cors(); self.end_headers(); self.wfile.write(b'ok')
        print('saved', name, len(data), 'bytes')

    def log_message(self, *a):
        pass

if __name__ == '__main__':
    HTTPServer(('127.0.0.1', 8920), H).serve_forever()
