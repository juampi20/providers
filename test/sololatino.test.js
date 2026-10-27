const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { _test } = require('../providers/sololatino');

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

test('embedId formats movies and zero-pads episodes', () => {
    assert.strictEqual(_test.embedId('tt1375666', 'movie'), 'tt1375666');
    assert.strictEqual(_test.embedId('tt0903747', 'tv', 1, 1), 'tt0903747-1x01');
    assert.strictEqual(_test.embedId('tt0903747', 'tv', 5, 16), 'tt0903747-5x16');
});

test('parseEmbedPage solves the POW and decrypts every server', () => {
    const embeds = _test.parseEmbedPage(fixture('embed69-episode.html'));
    assert.deepStrictEqual(embeds.map((e) => e.server), ['vidhide', 'streamwish', 'voe']);
    assert.strictEqual(embeds[0].language, 'LAT');
    assert.strictEqual(embeds[0].url, 'https://morencius.com/embed/uoujqybusqw9');
});

test('parseEmbedPage returns [] when the page layout changes', () => {
    assert.deepStrictEqual(_test.parseEmbedPage('<html>no player</html>'), []);
});

test('unpack exposes the vidhide hls links', () => {
    const links = JSON.parse(/var links=(\{[^}]*\})/.exec(_test.unpack(fixture('vidhide.html')))[1]);
    assert.match(links.hls2, /^https:\/\/.+\/master\.m3u8\?/);
});

function withFetch(handler, fn) {
    const original = global.fetch;
    const urls = [];
    global.fetch = (url) => { urls.push(url); return Promise.resolve({ ok: true, json: () => Promise.resolve(handler(url)) }); };
    return fn().then((r) => { global.fetch = original; return { result: r, urls }; }, (e) => { global.fetch = original; throw e; });
}

test('getImdbId falls back to Wikidata when Nuvio injects no TMDB_API_KEY', () => {
    delete global.TMDB_API_KEY;
    const wikidata = { results: { bindings: [{ imdb: { value: 'tt0903747' } }] } };
    return withFetch(() => wikidata, () => _test.getImdbId('1396', 'tv')).then(({ result, urls }) => {
        assert.strictEqual(result, 'tt0903747');
        assert.strictEqual(urls.length, 1);
        assert.match(urls[0], /^https:\/\/query\.wikidata\.org\/sparql\?/);
        assert.match(decodeURIComponent(urls[0]), /wdt:P4983 "1396"/);
    });
});

test('getImdbId uses TMDB with the injected TMDB_API_KEY', () => {
    global.TMDB_API_KEY = 'injected';
    return withFetch(() => ({ imdb_id: 'tt0133093' }), () => _test.getImdbId('603', 'movie')).then(({ result, urls }) => {
        delete global.TMDB_API_KEY;
        assert.strictEqual(result, 'tt0133093');
        assert.deepStrictEqual(urls, ['https://api.themoviedb.org/3/movie/603?api_key=injected']);
    });
});

test('parseVideoPage reads the plain /video/ server list with its language', () => {
    const embeds = _test.parseVideoPage(fixture('embed69-video.html'));
    assert.deepStrictEqual(embeds.map((e) => e.server), ['streamwish', 'vidhide', 'waaw.to', 'voe.sx']);
    assert.deepStrictEqual(embeds[1], { language: 'LAT', server: 'vidhide', url: 'https://vidhidepro.com/v/vezyplqzsoso' });
});

test('parseVideoPage maps each server to its own language tab', () => {
    const html = '<li class="SLD_A" data-lang="0"><img src="https://embed69.org/static/lang/LAT.png"></li>' +
        '<li class="SLD_B" data-lang="1"><img src="https://embed69.org/static/lang/SUB.png"></li>' +
        '<li onclick="playServerVast(\'https://vidhidepro.com/v/aaa\');" data-lang="0">' +
        '<li onclick="playServerVast(\'https://vidhidepro.com/v/bbb\');" data-lang="1">';
    assert.deepStrictEqual(_test.parseVideoPage(html).map((e) => e.language + ' ' + e.url),
        ['LAT https://vidhidepro.com/v/aaa', 'SUB https://vidhidepro.com/v/bbb']);
});

test('parsePage handles both the encrypted /f/ and the plain /video/ layouts', () => {
    assert.deepStrictEqual(_test.parsePage(fixture('embed69-episode.html')).map((e) => e.server), ['vidhide', 'streamwish', 'voe']);
    assert.strictEqual(_test.parsePage(fixture('embed69-video.html')).length, 4);
    assert.deepStrictEqual(_test.parseVideoPage(fixture('embed69-episode.html')), []);
});

test('onSettings exposes a password field for the TMDB key', () => {
    assert.deepStrictEqual(_test.onSettings().map((f) => [f.type, f.key, f.isPassword]), [['text', 'tmdbApiKey', true]]);
});

test('getImdbId prefers the TMDB key saved in the plugin settings', () => {
    global.TMDB_API_KEY = 'injected';
    global.SCRAPER_SETTINGS = { tmdbApiKey: '  mine  ' };
    return withFetch(() => ({ imdb_id: 'tt14488928' }), () => _test.getImdbId('201897', 'tv')).then(({ result, urls }) => {
        delete global.TMDB_API_KEY;
        delete global.SCRAPER_SETTINGS;
        assert.strictEqual(result, 'tt14488928');
        assert.deepStrictEqual(urls, ['https://api.themoviedb.org/3/tv/201897/external_ids?api_key=mine']);
    });
});

test('getImdbId falls back to Wikidata when TMDB has no IMDb id (e.g. a bad key)', () => {
    global.SCRAPER_SETTINGS = { tmdbApiKey: 'bad' };
    const replies = [{ status_code: 7, status_message: 'Invalid API key' }, { results: { bindings: [{ imdb: { value: 'tt0133093' } }] } }];
    return withFetch(() => replies.shift(), () => _test.getImdbId('603', 'movie')).then(({ result, urls }) => {
        delete global.SCRAPER_SETTINGS;
        assert.strictEqual(result, 'tt0133093');
        assert.strictEqual(urls.length, 2);
        assert.match(urls[1], /^https:\/\/query\.wikidata\.org\//);
    });
});

function bytes(prefix, length) {
    const b = new Uint8Array(length);
    b.set(prefix);
    return b;
}
const TS = (() => { const b = new Uint8Array(1024); for (let i = 0; i < 1024; i += 188) b[i] = 0x47; return b; })();
const PNG_WRAPPED = (() => { const b = new Uint8Array(1024); b.set([0x89, 0x50, 0x4e, 0x47]); for (let i = 70; i < 1024; i += 188) b[i] = 0x47; return b; })();

test('segmentKind tells clean MPEG-TS, PNG-wrapped TS and error pages apart', () => {
    assert.strictEqual(_test.segmentKind(TS), 'ts');
    assert.strictEqual(_test.segmentKind(PNG_WRAPPED), 'wrapped');
    assert.strictEqual(_test.segmentKind(bytes([0x3c, 0x68, 0x74, 0x6d], 146)), null);
});

function withRoutes(routes, fn) {
    const original = global.fetch;
    const calls = [];
    global.fetch = (url, opts) => {
        calls.push({ url, headers: (opts && opts.headers) || {} });
        const r = routes[url] || { status: 502, body: '<html>500</html>' };
        return Promise.resolve({
            ok: r.status < 400, status: r.status,
            text: () => Promise.resolve(typeof r.body === 'string' ? r.body : ''),
            arrayBuffer: () => Promise.resolve((typeof r.body === 'string' ? new TextEncoder().encode(r.body) : r.body).buffer)
        });
    };
    return fn().then((r) => { global.fetch = original; return { result: r, calls }; }, (e) => { global.fetch = original; throw e; });
}

function hlsRoutes(base, segment, variants) {
    const r = {};
    const list = variants || [['index.m3u8', 1, segment]];
    r[base + '/master.m3u8'] = { status: 200, body: '#EXTM3U\n' + list.map(([name, bw]) => '#EXT-X-STREAM-INF:BANDWIDTH=' + bw + '\n' + name).join('\n') + '\n' };
    list.forEach(([name, , seg]) => {
        const id = name.replace('.m3u8', '');
        r[base + '/' + name] = { status: 200, body: '#EXTM3U\n#EXTINF:6,\n' + id + '-1.ts\n' };
        if (seg) r[base + '/' + id + '-1.ts'] = { status: 206, body: seg };
    });
    return r;
}

test('playableLinks keeps clean TS links, never tries hls4 and drops failing or PNG-wrapped ones', () => {
    const routes = Object.assign({}, hlsRoutes('https://a.example', TS), hlsRoutes('https://w.example', PNG_WRAPPED), hlsRoutes('https://c.example', TS));
    const links = { hls2: 'https://w.example/master.m3u8', hls3: 'https://a.example/master.m3u8', hls4: 'https://c.example/master.m3u8' };
    return withRoutes(routes, () => _test.playableLinks(links, 'https://embed.example/', {})).then(({ result, calls }) => {
        assert.deepStrictEqual(result, ['https://a.example/master.m3u8']);
        assert.ok(!calls.some((c) => c.url.indexOf('https://c.example/') === 0), 'hls4 must not be fetched');
        assert.ok(calls.filter((c) => /-1\.ts$/.test(c.url)).every((c) => c.headers.Range === 'bytes=0-1023'));
    });
});

test('playableLinks checks the highest-bandwidth variant, the one the player picks', () => {
    const deadTop = hlsRoutes('https://a.example', null, [['low.m3u8', 100, TS], ['high.m3u8', 900, null]]);
    const liveTop = hlsRoutes('https://b.example', null, [['low.m3u8', 100, null], ['high.m3u8', 900, TS]]);
    const links = { hls2: 'https://a.example/master.m3u8', hls3: 'https://b.example/master.m3u8' };
    return withRoutes(Object.assign({}, deadTop, liveTop), () => _test.playableLinks(links, 'https://embed.example/', {}))
        .then(({ result }) => assert.deepStrictEqual(result, ['https://b.example/master.m3u8']));
});

test('playableLinks returns what passed by the deadline when a CDN hangs', () => {
    const routes = hlsRoutes('https://a.example', TS);
    const original = global.fetch;
    global.fetch = (url) => {
        if (url.indexOf('https://hung.example/') === 0) return new Promise(() => {});
        const r = routes[url] || { status: 502, body: '' };
        return Promise.resolve({ ok: r.status < 400, status: r.status, text: () => Promise.resolve(typeof r.body === 'string' ? r.body : ''), arrayBuffer: () => Promise.resolve(r.body.buffer) });
    };
    const restore = (v) => { global.fetch = original; return v; };
    return _test.playableLinks({ hls2: 'https://hung.example/master.m3u8', hls3: 'https://a.example/master.m3u8' }, 'https://e.example/x', {}, 30)
        .then(restore, (e) => { restore(); throw e; })
        .then((result) => {
            assert.deepStrictEqual(result, ['https://a.example/master.m3u8']);
            global.fetch = () => new Promise(() => {});
            return _test.playableLinks({ hls2: 'https://hung.example/a.m3u8' }, 'https://e.example/x', {}, 30).then(restore, (e) => { restore(); throw e; });
        })
        .then((result) => assert.deepStrictEqual(result, []));
});

test('playableEmbed sends streamwish mirrors to vibuxer.com and keeps vidhide as is', () => {
    assert.strictEqual(_test.playableEmbed({ server: 'streamwish', url: 'https://hglink.to/e/o0tzovv5f3t2' }), 'https://vibuxer.com/e/o0tzovv5f3t2');
    assert.strictEqual(_test.playableEmbed({ server: 'streamwish', url: 'https://streamwish.to/e/jz6bxz6ryzvo' }), 'https://vibuxer.com/e/jz6bxz6ryzvo');
    assert.strictEqual(_test.playableEmbed({ server: 'vidhide', url: 'https://vidhidepro.com/v/vezyplqzsoso' }), 'https://vidhidepro.com/v/vezyplqzsoso');
    assert.strictEqual(_test.playableEmbed({ server: 'voe', url: 'https://voe.sx/e/hqou76go1rwg' }), null);
});

test('playableLinks skips probing where Nuvio has no setTimeout, since a dead CDN there outlasts the 60 s plugin limit', () => {
    const originalFetch = global.fetch;
    const originalSetTimeout = global.setTimeout;
    const calls = [];
    global.fetch = (url) => { calls.push(url); return new Promise(() => {}); };
    global.setTimeout = undefined;
    let pending;
    try {
        pending = _test.playableLinks({ hls2: 'https://a.example/master.m3u8', hls3: 'https://b.example/master.txt', hls4: '/stream/x/master.m3u8' }, 'https://e.example/v/x', {});
    } finally {
        global.setTimeout = originalSetTimeout;
    }
    return pending.then((result) => {
        global.fetch = originalFetch;
        assert.deepStrictEqual(result, ['https://a.example/master.m3u8', 'https://b.example/master.txt']);
        assert.deepStrictEqual(calls, []);
    }, (e) => { global.fetch = originalFetch; throw e; });
});
