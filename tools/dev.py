#!/usr/bin/env python3
"""Local dev server that never lets the browser cache anything.

  python3 tools/dev.py [port] [host] # default 8910 on 127.0.0.1; use 0.0.0.0 to reach it from a phone on the same Wi-Fi (anything on that network can read the repo, fonts included)

Python's plain `http.server` sends no cache headers, so browsers reuse old copies of the ES modules
(src/*.js) and a page can end up running a mix of old and new files. This sends `Cache-Control: no-store`.
"""
import os, sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')

class H(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8910
    host = sys.argv[2] if len(sys.argv) > 2 else '127.0.0.1'
    print(f'Serving {os.path.abspath(ROOT)} on http://{host}:{port}  (no caching)')
    ThreadingHTTPServer((host, port), partial(H, directory=ROOT)).serve_forever()
