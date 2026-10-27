// Live check against the real sites, skipping TMDB: node scripts/sololatino-live.js tt0903747-1x01 (or tt2661044-3x05, /video/-only)
const { _test } = require('../providers/sololatino');

const id = process.argv[2] || 'tt0903747-1x01';
fetch('https://embed69.org/video/' + id, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://sololatino.net/' } })
    .then((res) => res.text())
    .then((html) => {
        const embeds = _test.parsePage(html).filter((e) => _test.playableEmbed(e));
        console.log(id, '-> playable embeds:', embeds.length);
        return Promise.all(embeds.map((e) => _test.extractHls(_test.playableEmbed(e)).then((url) => console.log(e.language, e.server, url))));
    });
