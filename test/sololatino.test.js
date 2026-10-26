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
