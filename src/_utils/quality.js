/**
 * Quality labels read out of the link itself — never a HEAD/GET probe, never a guess from the title.
 */

const TIER_PRIORITY = ['x', 'o', 'h', 'n', 'l'];

const TIERS = {
    vimeos: { x: '1080p', o: '1080p', h: '720p', n: '480p', l: '360p' },
    streamwish: { x: '1080p', o: '1080p', h: '1080p', n: '720p', l: '480p' },
    vidhide: { x: '1080p', o: '1080p', h: '720p', n: '480p', l: '360p' }
};

/**
 * A multi-quality master URL lists its tiers (`_,l,n,h,.urlset`); the best one is the label.
 * Anything without a tier or an explicit `480p`-style marker reports `Auto` rather than a lie.
 */
export function inferQuality(url, server) {
    const tiers = TIERS[server] || {};
    const set = /_,([a-z,]+),\.urlset/.exec(url);
    if (set) {
        const available = set[1].split(',');
        for (let i = 0; i < TIER_PRIORITY.length; i++) {
            const tier = TIER_PRIORITY[i];
            if (available.indexOf(tier) >= 0 && tiers[tier]) return tiers[tier];
        }
    }
    const labelled = /[_\-/](\d{3,4})p/.exec(url);
    return labelled ? labelled[1] + 'p' : 'Auto';
}
