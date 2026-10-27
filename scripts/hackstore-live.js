// Live check against hackstore2.com, skipping TMDB: node scripts/hackstore-live.js <slug> [episode-slug]
//   node scripts/hackstore-live.js el-origen-2010
//   node scripts/hackstore-live.js breaking-bad-temporada-1-episodio-1 episodes
const { _test } = require('../providers/hackstore');

const slug = process.argv[2] || 'el-origen-2010';
const postType = process.argv[3] === 'episodes' ? 'episodes' : 'movies';

_test.findPostId(slug, postType)
    .then((post) => {
        console.log(slug, '-> post', post && post.id, '| titulo:', post && post.title);
        if (!post) return [];
        return _test.fetchEmbeds(post.id);
    })
    .then((embeds) => {
        const usable = embeds.filter((e) => _test.resolverFor(e.url));
        console.log('embeds:', embeds.map((e) => e.language + ' ' + e.url.split('/')[2]).join(', ') || 'ninguno');
        console.log('resolubles:', usable.length, 'de', embeds.length);
        return Promise.all(usable.map((e) => {
            const resolver = _test.resolverFor(e.url);
            return resolver.resolve(e.url)
                .then((found) => console.log(e.language, resolver.server, found.length ? found.map((s) => s.url).join(' ') : 'sin link'))
                .catch((err) => console.log(e.language, resolver.server, 'error:', err.message));
        }));
    })
    .catch((err) => console.error('error:', err.message));
