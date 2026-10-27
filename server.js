#!/usr/bin/env node
// Serves this repository over HTTP so a Nuvio debug build can test it without a single push: the Plugin
// Tester loads a single provider file from a URL, and the Repo Tester loads the whole manifest.

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = __dirname; // server.js vive en la raíz del repo
const PORT = Number(process.env.PORT || 3000);

const MIME = {
    '.json': 'application/json',
    '.js': 'application/javascript',
    '.md': 'text/markdown',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.html': 'text/html'
};

function lanAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return 'localhost';
}

http.createServer(function (req, res) {
    const requested = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(ROOT, requested === '/' ? 'manifest.json' : requested);

    // Everything is served from this repo only: a request that escapes it is a 403, not a file read.
    if (path.relative(ROOT, file).startsWith('..')) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('fuera del repositorio');
        return;
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    // Nuvio caches what it downloads; during development that is exactly what we don't want.
    res.setHeader('Cache-Control', 'no-store');

    fs.readFile(file, function (err, content) {
        if (err) {
            console.log(req.method, requested, '->', err.code || err.message);
            res.writeHead(err.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain' });
            res.end(err.code || 'error');
            return;
        }
        console.log(req.method, requested, '-> 200');
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'text/plain' });
        res.end(content);
    });
}).listen(PORT, function () {
    const host = lanAddress();
    console.log('\nServidor local del repo:');
    console.log('  Manifest:  http://' + host + ':' + PORT + '/manifest.json');
    console.log('  Provider:  http://' + host + ':' + PORT + '/providers/<nombre>.js');
    console.log('\nNuvio (build debug) > Settings > Developer Section > Plugin Tester:');
    console.log('  Repo Tester     -> la URL del manifest');
    console.log('  Individual Plugin -> la URL de un provider compilado');
    console.log('\nCtrl+C para parar.\n');
});
