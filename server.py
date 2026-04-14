import json
import os
import sys
from http.server import SimpleHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

DB_FILE = "database.json"

class SmartTaskHandler(SimpleHTTPRequestHandler):
    # Ignore broken pipe errors when client disconnects
    def handle_one_request(self):
        try:
            super().handle_one_request()
        except Exception:
            pass

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/tasks':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
            self.end_headers()
            if os.path.exists(DB_FILE):
                with open(DB_FILE, 'r') as f:
                    self.wfile.write(f.read().encode())
            else:
                self.wfile.write(b'[]')
        else:
            # Serve the standard frontend files (index.html, style.css, etc.)
            super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/tasks':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            
            try:
                # Expecting a full array of tasks dumped as JSON
                tasks = json.loads(body.decode())
                with open(DB_FILE, 'w') as f:
                    json.dump(tasks, f)
                    
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success synced"}).encode())
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
        else:
            self.send_response(404)
            self.end_headers()
            
if __name__ == '__main__':
    port = 3000
    print(f"==========================================")
    print(f"[!] LOCAL BACKEND SERVER STARTED!")
    print(f"[#] Access on your PC: http://localhost:{port}")
    print(f"[@] Access on your phone: Type your computer's Wi-Fi IP address followed by :{port}!")
    print(f"==========================================")
    
    server = HTTPServer(('0.0.0.0', port), SmartTaskHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
        sys.exit(0)
