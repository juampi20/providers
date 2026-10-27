const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { _test, getStreams } = require('../providers/hackstore');

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

function withRoutes(routes, fn) {
    const original = global.fetch;
    const calls = [];
    global.fetch = (url, opts) => {
        calls.push(String(url));
        const route = routes.filter((r) => r.match.test(url))[0];
        const body = route ? route.body : '';
        return Promise.resolve({
            ok: !!(route && route.body !== undefined),
            status: route && route.body !== undefined ? 200 : 500,
            text: () => Promise.resolve(body),
            json: () => Promise.resolve(JSON.parse(body))
        });
    };
    return fn().then((r) => { global.fetch = original; return { result: r, calls }; },
        (e) => { global.fetch = original; throw e; });
}

test('buildSlug folds accents, drops punctuation and joins with dashes', () => {
    assert.strictEqual(_test.buildSlug('El Origen (2010)'), 'el-origen-2010');
    assert.strictEqual(_test.buildSlug('Ánima: Corazón & Blues'), 'anima-corazon-blues');
    assert.strictEqual(_test.buildSlug('  Español  '), 'espanol');
});

test('episodeSlug follows the site pattern without zero padding', () => {
    assert.strictEqual(_test.episodeSlug('Breaking Bad', 1, 1), 'breaking-bad-temporada-1-episodio-1');
    assert.strictEqual(_test.episodeSlug('Breaking Bad', '03', '05'), 'breaking-bad-temporada-3-episodio-5');
});

test('findPostId reads data._id for movies and data.episode._id for episodes', () => {
    const movie = [{ match: /post_type=movies/, body: fixture('hackstore-single-movie.json') }];
    const episode = [{ match: /post_type=episodes/, body: fixture('hackstore-single-episode.json') }];
    return withRoutes(movie, () => _test.findPostId('el-origen-2010', 'movies'))
        .then(({ result }) => {
            assert.strictEqual(result, 58180);
            return withRoutes(episode, () => _test.findPostId('breaking-bad-temporada-1-episodio-1', 'episodes'));
        })
        .then(({ result }) => assert.strictEqual(result, 41526));
});

test('fetchEmbeds keeps the site language and drops unusable entries', () => {
    const routes = [{
        match: /api\/rest\/player/,
        body: JSON.stringify({ data: [{ lang: 'Castellano', url: 'https://vimeos.net/embed-a.html' }, { lang: '', url: 'nope' }] })
    }];
    return withRoutes(routes, () => _test.fetchEmbeds(1)).then(({ result }) => {
        assert.deepStrictEqual(result, [{ url: 'https://vimeos.net/embed-a.html', language: 'Español' }]);
    });
});

test('resolveVimeos pulls the m3u8 out of the packed player with the site referer', () => {
    const routes = [{ match: /vimeos\.net/, body: fixture('vimeos-embed.html') }];
    return withRoutes(routes, () => _test.resolveVimeos('https://vimeos.net/embed-uog0l1cy08dd.html')).then(({ result, calls }) => {
        assert.strictEqual(result.length, 1);
        assert.match(result[0].url, /^https:\/\/[a-z0-9.-]*vimeos\.zip\/hls2\/.+\/master\.m3u8\?/);
        assert.deepStrictEqual(result[0].headers.Referer, 'https://vimeos.net/');
        assert.deepStrictEqual(calls, ['https://vimeos.net/embed-uog0l1cy08dd.html']);
    });
});

test('inferQuality reads the tier list instead of fetching anything', () => {
    assert.strictEqual(_test.inferQuality('https://p2.vimeos.zip/hls2/02/00003/x_,n,h,.urlset/master.m3u8?t=a', 'vimeos'), '720p');
    assert.strictEqual(_test.inferQuality('https://cdn/x_,l,.urlset/master.m3u8', 'streamwish'), '480p');
    assert.strictEqual(_test.inferQuality('https://cdn/video_1080p.mp4', 'vimeos'), '1080p');
    assert.strictEqual(_test.inferQuality('https://cdn/unknown.m3u8', 'vimeos'), 'Auto');
});

test('resolverFor keeps vimeos and streamwish and drops everything else, voe included', () => {
    assert.deepStrictEqual(['https://vimeos.net/embed-a.html', 'https://hglink.to/e/abc', 'https://streamwish.to/e/abc',
        'https://voe.sx/e/abc', 'https://doodstream.com/e/abc'].map((u) => (_test.resolverFor(u) || {}).server),
    ['vimeos', 'streamwish', 'streamwish', undefined, undefined]);
});

test('vibuxerUrl rewrites streamwish mirrors and leaves vibuxer alone', () => {
    assert.strictEqual(_test.vibuxerUrl('https://hglink.to/e/o0tzovv5f3t2'), 'https://vibuxer.com/e/o0tzovv5f3t2');
    assert.strictEqual(_test.vibuxerUrl('https://vibuxer.com/e/o0tzovv5f3t2'), 'https://vibuxer.com/e/o0tzovv5f3t2');
});

test('getStreams returns nothing, with a warning, when no TMDB key is available', () => {
    delete global.TMDB_API_KEY;
    delete global.SCRAPER_SETTINGS;
    return getStreams('27205', 'movie').then((streams) => assert.deepStrictEqual(streams, []));
});

test('getStreams resolves only the first language that works', () => {
    global.TMDB_API_KEY = 'injected';
    const routes = [
        { match: /api\.themoviedb\.org/, body: JSON.stringify({ title: 'El Origen', release_date: '2010-07-15' }) },
        { match: /post_type=movies/, body: fixture('hackstore-single-movie.json') },
        {
            match: /api\/rest\/player/,
            body: JSON.stringify({
                data: [
                    { lang: 'Subtitulado', url: 'https://vimeos.net/embed-sub.html' },
                    { lang: 'Latino', url: 'https://vimeos.net/embed-lat.html' }
                ]
            })
        },
        { match: /embed-sub\.html/, body: '<html>nada</html>' },
        { match: /embed-lat\.html/, body: fixture('vimeos-embed.html') }
    ];
    return withRoutes(routes, () => getStreams('27205', 'movie')).then(({ result, calls }) => {
        delete global.TMDB_API_KEY;
        assert.ok(result.length > 0);
        assert.deepStrictEqual([...new Set(result.map((s) => s.title.split(' - ')[0]))], ['Latino']);
        assert.deepStrictEqual(calls.filter((u) => u.indexOf('embed-sub') >= 0), []);
        assert.deepStrictEqual(result.map((s) => s.name + '/' + s.quality), ['HackStore/720p']);
    });
});

test('getStreams falls through to the next language when the first yields no link', () => {
    global.TMDB_API_KEY = 'injected';
    const routes = [
        { match: /api\.themoviedb\.org/, body: JSON.stringify({ title: 'El Origen', release_date: '2010-07-15' }) },
        { match: /post_type=movies/, body: fixture('hackstore-single-movie.json') },
        {
            match: /api\/rest\/player/,
            body: JSON.stringify({ data: [{ lang: 'Latino', url: 'https://vimeos.net/embed-lat.html' }, { lang: 'Subtitulado', url: 'https://vimeos.net/embed-sub.html' }] })
        },
        { match: /embed-lat\.html/, body: '<html>nada</html>' },
        { match: /embed-sub\.html/, body: fixture('vimeos-embed.html') }
    ];
    return withRoutes(routes, () => getStreams('27205', 'movie')).then(({ result }) => {
        delete global.TMDB_API_KEY;
        assert.deepStrictEqual([...new Set(result.map((s) => s.title.split(' - ')[0]))], ['Subtitulado']);
    });
});
