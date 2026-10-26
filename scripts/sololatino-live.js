// Live check against the real sites, skipping TMDB: node scripts/sololatino-live.js tt0903747-1x01
const { _test } = require('../providers/sololatino');

const id = process.argv[2] || 'tt0903747-1x01';
fetch('https://embed69.org/f/' + id, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://sololatino.net/' } })
    .then((res) => res.text())
    .then((html) => {
        const vidhide = _test.parseEmbedPage(html).filter((e) => e.server === 'vidhide');
        console.log(id, '-> vidhide embeds:', vidhide.length);
        return Promise.all(vidhide.map((e) => _test.extractVidhide(e.url).then((url) => console.log(e.language, url))));
    });
