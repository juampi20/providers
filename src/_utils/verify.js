/**
 * Liveness of a resolved stream, decided from requests we were already making.
 *
 * No extra probing: an HLS stream is verified by the manifest fetch in `bestPlayable`, and a direct file by
 * the HEAD that measures its size. What is new is that the answer is acted on — a stream whose own request
 * failed is dropped instead of being offered — and that both verdicts are cached, so a dead CDN costs one
 * request per session instead of one per search.
 */

const TTL = 30 * 60 * 1000;
const MAX = 300;
const CACHE = {};

/** @param {string} url */
export function cachedVerdict(url) {
    const entry = CACHE[url];
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
        delete CACHE[url];
        return undefined;
    }
    return entry.value;
}

/**
 * @param {string} url
 * @param {{alive: boolean, bytes?: number}} verdict
 */
export function rememberVerdict(url, verdict) {
    const keys = Object.keys(CACHE);
    if (keys.length >= MAX) delete CACHE[keys[0]];
    CACHE[url] = { value: verdict, expires: Date.now() + TTL };
}
