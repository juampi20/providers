const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { _test, getStreams } = require('../providers/vimeus');

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

function withRoutes(routes, fn) {
    const original = global.fetch;
    const calls = [];
    global.fetch = (url) => {
        calls.push(String(url));
        const route = routes.filter((r) => r.match.test(url))[0];
        const status = route ? (route.status || 200) : 404;
        const body = route ? route.body : '';
        return Promise.resolve({
            ok: status >= 200 && status < 300,
            status,
            text: () => Promise.resolve(body)
        });
    };
    return fn().then((r) => { global.fetch = original; return { result: r, calls }; },
        (e) => { global.fetch = original; throw e; });
}

test('embedPageUrl builds the movie and the episode endpoints', () => {
    assert.match(_test.embedPageUrl('27205', 'movie', null, null), /^https:\/\/vimeus\.com\/e\/movie\?tmdb=27205&view_key=/);
    assert.match(_test.embedPageUrl('1396', 'tv', 3, 5), /^https:\/\/vimeus\.com\/e\/serie\?tmdb=1396&se=3&ep=5&view_key=/);
});

test('parseDataScript reads the json block of a movie page', () => {
    const payload = _test.parseDataScript(fixture('vimeus-movie.html'));
    assert.strictEqual(payload.title, 'El origen');
    assert.strictEqual(payload.tmdb_id, 27205);
    assert.deepStrictEqual(payload.embeds.map((e) => e.url), ['https://vimeos.net/embed-uog0l1cy08dd.html']);
});

test('parseDataScript reads the json block of a series page with its season and episode', () => {
    const payload = _test.parseDataScript(fixture('vimeus-series.html'));
    assert.strictEqual(payload.type, 'series');
    assert.strictEqual(payload.season, 1);
    assert.strictEqual(payload.episode, 1);
    assert.strictEqual(payload.embeds.length, 1);
});

test('parseDataScript returns null when the page carries no payload', () => {
    assert.strictEqual(_test.parseDataScript('<html><body>nada</body></html>'), null);
    assert.strictEqual(_test.parseDataScript('<script type="text/json" id="data">{roto}</script>'), null);
});

test('payloadEmbeds keeps absolute urls and drops the rest', () => {
    const embeds = _test.payloadEmbeds({ embeds: [{ url: '//vimeos.net/embed-a.html' }, { url: 'voe.sx/e/x' }, { url: 'https://hglink.to/e/abc' }, {}] });
    assert.deepStrictEqual(embeds.map((e) => e.url), ['https://vimeos.net/embed-a.html', 'https://hglink.to/e/abc']);
});

test('fetchPayload names the one failure that matters: a rotated view_key', () => {
    return withRoutes([{ match: /vimeus\.com/, status: 400, body: 'bad key' }], () => _test.fetchPayload('https://vimeus.com/e/movie?tmdb=1&view_key=x'))
        .then(() => assert.fail('debía fallar'))
        .catch((e) => assert.match(e.message, /view_key/));
});

test('getStreams resolves the vimeos embed of a movie', () => {
    const routes = [
        { match: /vimeus\.com\/e\/movie/, body: fixture('vimeus-movie.html') },
        { match: /vimeos\.net/, body: fixture('vimeos-embed.html') }
    ];
    return withRoutes(routes, () => getStreams('27205', 'movie')).then(({ result, calls }) => {
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].name, 'Vimeus \u2022 720P \u2022 Vimeos');
        assert.strictEqual(result[0].title, 'Latino');
        assert.match(result[0].url, /master\.m3u8\?/);
        assert.deepStrictEqual(calls.filter((u) => /voe\.sx|filemoon/.test(u)), []);
    });
});

test('getStreams returns nothing when the title has no resolvable embed', () => {
    const routes = [{ match: /vimeus\.com/, body: fixture('vimeus-movie.html') }];
    return withRoutes(routes, () => getStreams('999999', 'movie')).then(({ result }) => {
        assert.deepStrictEqual(result, []);
    });
});
