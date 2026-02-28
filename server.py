import http.server
import mimetypes
import os

# Ensure .js files are served with correct MIME type
mimetypes.add_type('application/javascript', '.js')

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Only set Content-Type for .js files if not already set
        if self.path.endswith('.js'):
            self.send_header('Content-Type', 'application/javascript')
        super().end_headers()

if __name__ == '__main__':
    server = http.server.HTTPServer(('127.0.0.1', 8000), MyHTTPRequestHandler)
    print('Server running at http://127.0.0.1:8000')
    server.serve_forever()