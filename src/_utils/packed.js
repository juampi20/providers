/**
 * Helpers for the packed players vidhide, vibuxer, vimeos and most mirrors of that family use.
 */

import JsUnpacker from './jsunpack.js';
import { BROWSER_UA, fetchBrowserText } from './http.js';

/**
 * Unpacks a Dean Edwards `p,a,c,k,e,d` player page, or null when the page carries none.
 * @param {string} html
 */
export function unpack(html) {
    const unpacker = new JsUnpacker(html);
    return unpacker.detect() ? unpacker.unpack() : null;
}

/**
 * Slice of `text` between two markers.
 * @param {string} text
 * @param {string} start
 * @param {string} end
 */
export function between(text, start, end) {
    const i = text.indexOf(start);
    if (i < 0) return null;
    const j = text.indexOf(end, i + start.length);
    return j < 0 ? null : text.slice(i + start.length, j);
}

/**
 * Resolve a link found in a page against the page's own URL.
 * @param {string} ref
 * @param {string} base
 */
export function resolveUrl(ref, base) {
    if (/^https?:\/\//.test(ref)) return ref;
    if (ref.charAt(0) === '/') return base.match(/^https?:\/\/[^/]+/)[0] + ref;
    return base.replace(/[?#].*$/, '').replace(/[^/]*$/, '') + ref;
}

/**
 * Host part of a URL.
 * @param {string} url
 */
export function hostOf(url) {
    return url.split('/')[2] || '';
}

/**
 * streamwish mirrors serve an obfuscated loader; vibuxer.com serves the same file as a packed player.
 * @param {string} embedUrl
 */
export function vibuxerUrl(embedUrl) {
    if (hostOf(embedUrl).indexOf('vibuxer') >= 0) return embedUrl;
    return 'https://vibuxer.com/e/' + embedUrl.split('/').pop();
}

/**
 * hls4 segments carry a PNG header that Nuvio's libmpv refuses; nothing is probed, because Nuvio waits
 * for every pending request before showing results and a dead CDN outlasts its 60 s plugin limit.
 * @param {object} links
 * @param {string} embedUrl
 */
export function playableLinks(links, embedUrl) {
    return ['hls2', 'hls3']
        .filter((k) => links[k])
        .map((k) => resolveUrl(links[k], embedUrl));
}

/**
 * Read the `var links` object out of a packed player and return its playable URLs.
 * @param {string} embedUrl
 * @param {string} referer
 */
export async function packedLinks(embedUrl, referer) {
    const html = await fetchBrowserText(embedUrl, referer);
    const script = unpack(html);
    const links = script && between(script, 'var links=', ';');
    if (!links) return [];
    return playableLinks(JSON.parse(links), embedUrl).map((url) => ({
        url,
        headers: { 'User-Agent': BROWSER_UA, Referer: referer }
    }));
}
