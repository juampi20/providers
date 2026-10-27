const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { _test, getStreams } = require('../providers/cinecalidad');

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

function withRoutes(routes, fn) {
    const original = global.fetch;
    const calls = [];
    global.fetch = (url) => {
        calls.push(String(url));
        const route = routes.filter((r) => r.match.test(url))[0];
        const body = route ? route.body : '';
        return Promise.resolve({
            ok: !!(route && route.body !== undefined),
            status: route && route.body !== undefined ? 200 : 404,
            text: () => Promise.resolve(body),
            json: () => Promise.resolve(JSON.parse(body))
        });
    };
    return fn().then((r) => { global.fetch = original; return { result: r, calls }; },
        (e) => { global.fetch = original; throw e; });
}

test('decodeBase64 reads a data-src without Buffer or atob', () => {
    assert.strictEqual(_test.decodeBase64('aHR0cHM6Ly92aW1lb3MubmV0L2VtYmVkLXpneWNyN3U4Y3d1OC5odG1s'),
        'https://vimeos.net/embed-zgycr7u8cwu8.html');
    assert.strictEqual(_test.decodeBase64('aG9sYQ=='), 'hola');
});

test('buildSlug folds accents and drops the year', () => {
    assert.strictEqual(_test.buildSlug('Amor y tesoro'), 'amor-y-tesoro');
    assert.strictEqual(_test.buildSlug('¡Qué pasó, ayer! (2008)'), 'que-paso-ayer-2008');
});

test('embedUrls decodes every data-src and keeps http urls only', () => {
    const urls = _test.embedUrls(fixture('cinecalidad-movie.html'));
    assert.deepStrictEqual(urls, [
        'https://vimeos.net/embed-zgycr7u8cwu8.html',
        'https://voe.sx/e/ppmkzfbwsy85',
        'https://doodstream.com/e/6t3e7j4xuan9'
    ]);
    assert.strictEqual(_test.embedUrls('<html>sin players</html>').length, 0);
});

test('pageYear reads the release year out of the h1', () => {
    assert.strictEqual(_test.pageYear(fixture('cinecalidad-movie.html')), '2008');
    assert.strictEqual(_test.pageYear('<h1>Sin año</h1>'), null);
});

test('resolverFor keeps vimeos and streamwish, drops voe and doodstream', () => {
    assert.deepStrictEqual([
        'https://vimeos.net/embed-a.html', 'https://hglink.to/e/abc', 'https://voe.sx/e/abc', 'https://doodstream.com/e/abc'
    ].map((u) => (_test.resolverFor(u) || {}).server), ['vimeos', 'streamwish', undefined, undefined]);
});

test('resolveVimeos pulls the m3u8 with the site referer', () => {
    const routes = [{ match: /vimeos\.net/, body: fixture('vimeos-embed.html') }];
    return withRoutes(routes, () => _test.resolveVimeos('https://vimeos.net/embed-zgycr7u8cwu8.html')).then(({ result }) => {
        assert.strictEqual(result.length, 1);
        assert.match(result[0].url, /^https:\/\/[a-z0-9.-]*vimeos\.(zip|net)\/hls2\/.+\/master\.m3u8\?/);
        assert.deepStrictEqual(result[0].headers.Referer, 'https://vimeos.net/');
    });
});

test('findMoviePage prefers the page whose year matches and skips pages without players', () => {
    const page = fixture('cinecalidad-movie.html');
    const routes = [
        { match: /pelicula\/amor-y-tesoro\/$/, body: page },
        { match: /pelicula\/amor-y-tesoro-2\/$/, body: '<html><h1>Amor y tesoro (1999)</h1>' + page.replace('<h1', '<div') + '</html>' }
    ];
    return withRoutes(routes, () => _test.findMoviePage(['Amor y tesoro'], '2008')).then(({ result }) => {
        assert.strictEqual(result, page);
    });
});

test('findMoviePage returns null when no candidate page carries a player', () => {
    return withRoutes([], () => _test.findMoviePage(['Nada'], '2008')).then(({ result }) => {
        assert.strictEqual(result, null);
    });
});

test('getStreams ignores tv, which the site does not carry', () => {
    return getStreams('1396', 'tv', 1, 1).then((streams) => assert.deepStrictEqual(streams, []));
});

test('getStreams returns nothing, with a warning, when no TMDB key is available', () => {
    delete global.TMDB_API_KEY;
    delete global.SCRAPER_SETTINGS;
    return getStreams('27205', 'movie').then((streams) => assert.deepStrictEqual(streams, []));
});

test('getStreams keeps only the resolvable players, labelled Latino, with quality read from the url', () => {
    global.TMDB_API_KEY = 'injected';
    const routes = [
        { match: /api\.themoviedb\.org/, body: JSON.stringify({ title: 'Amor y tesoro', original_title: 'Fool\'s Gold', release_date: '2008-02-07' }) },
        { match: /pelicula\/amor-y-tesoro\/$/, body: fixture('cinecalidad-movie.html') },
        { match: /vimeos\.net/, body: fixture('vimeos-embed.html') },
        { match: /doodstream|voe\.sx/, body: '<html>nada</html>' }
    ];
    return withRoutes(routes, () => getStreams('10528', 'movie')).then(({ result, calls }) => {
        delete global.TMDB_API_KEY;
        assert.strictEqual(result.length, 1);
        assert.deepStrictEqual(result.map((s) => s.name + ' | ' + s.title + ' | ' + s.quality), ['CineCalidad | Latino - Vimeos | 720p']);
        assert.match(result[0].url, /master\.m3u8\?/);
        assert.deepStrictEqual(calls.filter((u) => /embed69|vibuxer/.test(u)), []);
    });
});

test('findMoviePage drops a page whose year contradicts TMDB instead of returning another movie', () => {
    const page = fixture('cinecalidad-movie.html');
    const wrong = page.replace(/<h1[^>]*>[^<]*<\/h1>/, '<h1>Otra pelicula (2012)</h1>');
    const routes = [{ match: /pelicula\/amor-y-tesoro\/$/, body: wrong }];
    return withRoutes(routes, () => _test.findMoviePage(['Amor y tesoro'], '2008')).then(({ result }) => {
        assert.strictEqual(result, null);
    });
});

test('findMoviePage still accepts a page whose h1 has no year', () => {
    const page = fixture('cinecalidad-movie.html').replace(/<h1[^>]*>[^<]*<\/h1>/, '<h1>Amor y tesoro</h1>');
    const routes = [{ match: /pelicula\/amor-y-tesoro\/$/, body: page }];
    return withRoutes(routes, () => _test.findMoviePage(['Amor y tesoro'], '2008')).then(({ result }) => {
        assert.strictEqual(result, page);
    });
});
