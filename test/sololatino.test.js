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
    assert.deepStrictEqual(embeds.map((e) => e.server), ['streamwish.to', 'vidhide', 'waaw.to', 'voe.sx']);
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
