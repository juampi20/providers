#!/usr/bin/env node
// Build every provider and regenerate the manifest, following the Nuvio provider guide's workflow A:
// src/<provider>/index.js is the source, providers/<provider>.js is the single file Nuvio downloads, and
// each provider's manifest entry lives in its own provider.json (the filename is derived, so it can't drift).
//
//   node scripts/build.js              # all providers, readable output (use this while debugging)
//   node scripts/build.js --minify     # all providers, minified (for a release)
//   node scripts/build.js hackstore    # just the named ones
//
// esbuild is the same tool the guide uses; its es2016 target lowers async/await to generators, so modern
// syntax in src/ is safe for the Hermes runtime.

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');
const OUT_DIR = path.join(ROOT, 'providers');
const MANIFEST_PATH = path.join(ROOT, 'manifest.json');
const BANNER = '/* GENERADO por scripts/build.js desde src/ - no editar a mano */';
// El orden de campos del manifest se fija acá para que el archivo generado no cambie por azar entre builds.
const FIELD_ORDER = ['id', 'name', 'description', 'version', 'author', 'supportedTypes', 'filename', 'enabled', 'formats', 'logo', 'contentLanguage', 'hasSettings', 'disabledPlatforms', 'limited', 'supportsExternalPlayer'];

const args = process.argv.slice(2);
const minify = args.includes('--minify');
const requested = args.filter((arg) => arg.charAt(0) !== '-');

function providerNames() {
    return fs.readdirSync(SRC_DIR, { withFileTypes: true })
        .filter(function (entry) {
            return entry.isDirectory() && fs.existsSync(path.join(SRC_DIR, entry.name, 'index.js'));
        })
        .map(function (entry) { return entry.name; });
}

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function providerEntry(name) {
    const file = path.join(SRC_DIR, name, 'provider.json');
    if (!fs.existsSync(file)) throw new Error('Falta ' + path.relative(ROOT, file) + ' (la entrada de manifest de ' + name + ')');
    const entry = readJson(file);
    ['id', 'name', 'version', 'supportedTypes'].forEach(function (key) {
        if (!entry[key] || (Array.isArray(entry[key]) && !entry[key].length)) {
            throw new Error(path.relative(ROOT, file) + ': falta "' + key + '"');
        }
    });
    const ordered = {};
    FIELD_ORDER.forEach(function (key) {
        if (key === 'filename') ordered.filename = 'providers/' + name + '.js';
        else if (entry[key] !== undefined) ordered[key] = entry[key];
    });
    Object.keys(entry).forEach(function (key) {
        if (ordered[key] === undefined) ordered[key] = entry[key];
    });
    return ordered;
}

const names = providerNames().filter(function (name) {
    return !requested.length || requested.indexOf(name) >= 0;
});
if (!names.length) {
    console.error('No hay providers para buildear' + (requested.length ? ' con esos nombres' : ' en src/'));
    process.exit(1);
}

esbuild.buildSync({
    // Cada carpeta entra con nombre propio: sin `out`, esbuild escribiría providers/<nombre>/index.js.
    entryPoints: names.map(function (name) {
        return { in: path.join(SRC_DIR, name, 'index.js'), out: name };
    }),
    outdir: OUT_DIR,
    bundle: true,
    format: 'cjs',
    platform: 'neutral',
    target: 'es2016',
    minify: minify,
    banner: { js: BANNER },
    logLevel: 'warning'
});

names.forEach(function (name) {
    const size = Math.round(fs.statSync(path.join(OUT_DIR, name + '.js')).size / 1024);
    console.log('  ' + name + '.js  ' + size + ' KB' + (minify ? ' (minificado)' : ''));
});

// A partial build (named providers) leaves the manifest alone: it would otherwise drop the providers that
// were not rebuilt.
if (!requested.length) {
    const manifest = readJson(MANIFEST_PATH);
    const known = new Set(manifest.scrapers.map(function (s) { return s.id; }));
    const built = providerNames().map(providerEntry);
    const kept = manifest.scrapers
        .map(function (s) { return s.id; })
        .filter(function (id) { return built.some(function (b) { return b.id === id; }); })
        .map(function (id) { return built.filter(function (b) { return b.id === id; })[0]; });
    const added = built.filter(function (b) { return !known.has(b.id); });
    manifest.scrapers = kept.concat(added);
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
    console.log('  manifest.json  ' + manifest.scrapers.length + ' providers: ' + manifest.scrapers.map(function (s) { return s.id + '@' + s.version; }).join(', '));
}
