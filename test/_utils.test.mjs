import test from 'node:test';
import assert from 'node:assert';
import * as matcher from '../src/_utils/matcher.js';
import * as quality from '../src/_utils/quality.js';
import { groupByLanguage, labeled } from '../src/_utils/labels.js';

const shared = { ...matcher, ...quality };

test('titleSimilarity folds accents, articles and punctuation before comparing', () => {
    assert.strictEqual(shared.titleSimilarity('El Origen', 'el origen'), 1);
    assert.strictEqual(shared.titleSimilarity('The Matrix', 'Matrix'), 1);
    assert.strictEqual(shared.titleSimilarity('Ánima: Corazón', 'anima corazon'), 1);
});

test('titleSimilarity refuses a one-word query swallowing a longer title', () => {
    assert.ok(shared.titleSimilarity('Matrix', 'Matrix Reloaded') < 0.5);
});

test('titleSimilarity punishes a candidate carrying words the query lacks', () => {
    assert.ok(shared.titleSimilarity('Origen', 'Los miserables. El origen') < 0.7);
});

test('splitTitleYear separates the title from the year a page or API hands back', () => {
    assert.deepStrictEqual(shared.splitTitleYear('El Origen (2010)'), { title: 'El Origen', year: '2010' });
    assert.deepStrictEqual(shared.splitTitleYear('Breaking Bad'), { title: 'Breaking Bad', year: null });
});

test('bestTitleMatch accepts the candidate whose title and year agree', () => {
    const match = shared.bestTitleMatch(['El Origen', 'Inception'], '2010', [
        { title: 'El Origen', year: '2010' },
        { title: 'Otra pelicula', year: '2005' }
    ], {});
    assert.strictEqual(match.title, 'El Origen');
});

test('bestTitleMatch matches on an alternative title when the Spanish one misses', () => {
    const match = shared.bestTitleMatch(['El caballero de la noche', 'The Dark Knight'], '2008', [
        { title: 'The Dark Knight', year: '2008' }
    ], {});
    assert.strictEqual(match.title, 'The Dark Knight');
});

test('bestTitleMatch returns null for a same-title page from another year', () => {
    assert.strictEqual(shared.bestTitleMatch(['Amor y tesoro'], '2008', [{ title: 'Amor y tesoro', year: '1999' }], {}), null);
});

test('bestTitleMatch returns null below the threshold instead of guessing', () => {
    assert.strictEqual(shared.bestTitleMatch(['Amor y tesoro'], '2008', [{ title: 'Otra cosa distinta', year: '2008' }], {}), null);
    assert.strictEqual(shared.bestTitleMatch(['Nada'], '2008', [], {}), null);
});

test('bestTitleMatch keeps the right episode and drops another season', () => {
    const right = shared.bestTitleMatch(['Breaking Bad'], '', [{ title: 'Breaking Bad: Temporada 1 Episodio 1' }], { season: 1 });
    assert.strictEqual(right.title, 'Breaking Bad: Temporada 1 Episodio 1');
    assert.strictEqual(shared.bestTitleMatch(['Breaking Bad'], '', [{ title: 'Breaking Bad: Temporada 4 Episodio 1' }], { season: 1 }), null);
});

test('slugVariants dedupes, folds and caps the slugs a provider may request', () => {
    const slugs = shared.slugVariants(['El Origen', 'Inception', 'El Origen'], 3);
    assert.deepStrictEqual(slugs, ['el-origen', 'inception']);
});

test('inferQuality reads the tier the link carries and stays Auto when it carries none', () => {
    assert.strictEqual(shared.inferQuality('https://cdn/x_,l,n,h,.urlset/master.m3u8?t=1', 'vidhide'), '720p');
    assert.strictEqual(shared.inferQuality('https://cdn/x_,l,n,h,.urlset/master.m3u8?t=1', 'streamwish'), '1080p');
    assert.strictEqual(shared.inferQuality('https://cdn/hls2/01/08534/abc_n/master.m3u8?t=1', 'vidhide'), 'Auto');
});
