const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { _test, getStreams } = require('../providers/sololatino');

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

test('playableEmbed sends streamwish mirrors to vibuxer.com and keeps vidhide as is', () => {
    assert.strictEqual(_test.playableEmbed({ server: 'streamwish', url: 'https://hglink.to/e/o0tzovv5f3t2' }), 'https://vibuxer.com/e/o0tzovv5f3t2');
    assert.strictEqual(_test.playableEmbed({ server: 'streamwish', url: 'https://streamwish.to/e/jz6bxz6ryzvo' }), 'https://vibuxer.com/e/jz6bxz6ryzvo');
    assert.strictEqual(_test.playableEmbed({ server: 'vidhide', url: 'https://vidhidepro.com/v/vezyplqzsoso' }), 'https://vidhidepro.com/v/vezyplqzsoso');
    assert.strictEqual(_test.playableEmbed({ server: 'voe', url: 'https://voe.sx/e/hqou76go1rwg' }), null);
});

test('playableLinks returns hls2 and hls3 without fetching, since Nuvio waits for every pending request and a dead CDN outlasts its 60 s limit', () => {
    const original = global.fetch;
    const calls = [];
    global.fetch = (url) => { calls.push(url); return new Promise(() => {}); };
    try {
        const result = _test.playableLinks({ hls2: 'https://a.example/master.m3u8', hls3: 'https://b.example/master.txt', hls4: '/stream/x/master.m3u8' }, 'https://e.example/v/x');
        assert.deepStrictEqual(result, ['https://a.example/master.m3u8', 'https://b.example/master.txt']);
        assert.deepStrictEqual(calls, []);
        assert.deepStrictEqual(_test.playableLinks({ hls4: '/stream/x/master.m3u8' }, 'https://e.example/v/x'), []);
    } finally {
        global.fetch = original;
    }
});

function withRoutes(routes, fn) {
    const original = global.fetch;
    const calls = [];
    global.fetch = (url) => {
        calls.push(url);
        const route = routes.filter((r) => r.match.test(url))[0];
        const body = route ? route.body : '';
        return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(body),
            json: () => Promise.resolve(JSON.parse(body))
        });
    };
    return fn().then((r) => { global.fetch = original; return { result: r, calls }; },
        (e) => { global.fetch = original; throw e; });
}

const twoLanguagePage = (latHost, subHost) =>
    '<li class="SLD_A" data-lang="0"><img src="https://embed69.org/static/lang/LAT.png"></li>' +
    '<li class="SLD_B" data-lang="1"><img src="https://embed69.org/static/lang/SUB.png"></li>' +
    "<li onclick=\"playServerVast('" + latHost + "');\" data-lang=\"0\">" +
    "<li onclick=\"playServerVast('" + subHost + "');\" data-lang=\"1\">";

test('getStreams cuts at latino and never fetches the other languages', () => {
    global.TMDB_API_KEY = 'injected';
    const routes = [
        { match: /api\.themoviedb\.org/, body: '{"imdb_id":"tt0903747"}' },
        { match: /embed69\.org\/video\//, body: twoLanguagePage('https://vidhidepro.com/v/lat', 'https://vidhidepro.com/v/sub') },
        { match: /vidhidepro\.com/, body: fixture('vidhide.html') }
    ];
    return withRoutes(routes, () => getStreams('1396', 'tv', 1, 1)).then(({ result, calls }) => {
        delete global.TMDB_API_KEY;
        assert.ok(result.length > 0);
        assert.deepStrictEqual([...new Set(result.map((s) => s.title.split(' ')[0]))], ['Latino']);
        assert.strictEqual(calls.filter((u) => u.indexOf('/v/lat') >= 0).length, 1);
        assert.deepStrictEqual(calls.filter((u) => u.indexOf('/v/sub') >= 0), []);
    });
});

test('getStreams falls through to the next language when latino yields no link', () => {
    global.TMDB_API_KEY = 'injected';
    const routes = [
        { match: /api\.themoviedb\.org/, body: '{"imdb_id":"tt0903747"}' },
        { match: /embed69\.org\/video\//, body: twoLanguagePage('https://vidhidepro.com/v/lat', 'https://vidhidepro.com/v/sub') },
        { match: /\/v\/lat/, body: '<html>no player</html>' },
        { match: /vidhidepro\.com/, body: fixture('vidhide.html') }
    ];
    return withRoutes(routes, () => getStreams('1396', 'tv', 1, 1)).then(({ result, calls }) => {
        delete global.TMDB_API_KEY;
        assert.ok(result.length > 0);
        assert.deepStrictEqual([...new Set(result.map((s) => s.title.split(' ')[0]))], ['Subtitulado']);
        assert.strictEqual(calls.filter((u) => u.indexOf('/v/sub') >= 0).length, 1);
    });
});
