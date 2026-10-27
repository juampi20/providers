// Live check against cinecalidad.vg, skipping TMDB: node scripts/cinecalidad-live.js <slug> [year]
//   node scripts/cinecalidad-live.js amor-y-tesoro 2008
const { _test } = require('../providers/cinecalidad');

const slug = process.argv[2] || 'amor-y-tesoro';
const year = process.argv[3] || '';

_test.findMoviePage([slug.replace(/-/g, ' ')], year)
    .then((html) => {
        if (!html) return console.log(slug, '-> sin página con players');
        const embeds = _test.embedUrls(html);
        const usable = embeds.filter((u) => _test.resolverFor(u));
        console.log(slug, '-> h1 año', _test.pageYear(html), '| players:', embeds.length, '| resolubles:', usable.length);
        console.log('   hosts:', embeds.map((u) => u.split('/')[2]).join(', '));
        return Promise.all(usable.map((url) => _test.resolverFor(url).resolve(url)
            .then((found) => console.log('  ', url.split('/')[2], found.length ? found.map((s) => s.url).join(' ') : 'sin link'))
            .catch((err) => console.log('  ', url.split('/')[2], 'error:', err.message))));
    })
    .catch((err) => console.error('error:', err.message));
