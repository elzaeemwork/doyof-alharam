const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8085;
const WWW_ROOT = path.join(__dirname, 'www');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.wasm': 'application/wasm',
    '.gz': 'application/gzip',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    let reqPath = decodeURIComponent(req.url.split('?')[0]);
    if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

    const filePath = path.join(WWW_ROOT, reqPath);
    const ext = path.extname(filePath).toLowerCase();

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('File Not Found');
            return;
        }
        const mime = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
            'Content-Type': mime,
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        res.end(data);
    });
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`Mobile test server running at http://127.0.0.1:${PORT}`);
});
