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

/** @param {string} embedUrl */
export function resolveVidhide(embedUrl) {
    return packedLinks(embedUrl, embedUrl);
}

/** @param {string} embedUrl */
export function resolveStreamWish(embedUrl) {
    const target = vibuxerUrl(embedUrl);
    return packedLinks(target, target);
}

/**
 * Vimeos serves a packed player too, but its m3u8 sits in the unpacked source as a bare string.
 *
 * The CDN hands out a master with two variants and, on many titles, an `#EXT-X-MEDIA` audio group the
 * variants reference with `AUDIO="audio0"`. A player that mishandles that master plays audio and shows no
 * image, so the master is resolved one step further into its highest variant: those carry audio and video
 * muxed in the same TS (verified on four titles), which is the single-playlist shape that plays everywhere.
 * Falls back to the master when it cannot be read. The stream headers carry only the browser User-Agent:
 * the CDN rejects a `Referer` on some edges.
 * @param {string} embedUrl
 */
export async function resolveVimeos(embedUrl) {
    const html = await fetchBrowserText(embedUrl, 'https://vimeos.net/');
    const script = unpack(html) || html;
    const m = /["']([^"']+\.m3u8[^"']*)['"]/i.exec(script);
    if (!m) return [];
    const master = resolveUrl(m[1], embedUrl);
    const headers = { 'User-Agent': BROWSER_UA };
    return [{ url: await bestVariant(master, headers), headers }];
}

/**
 * The highest-bandwidth playlist listed by a master, or the master itself when there is nothing to pick.
 * @param {string} masterUrl
 * @param {object} headers
 */
async function bestVariant(masterUrl, headers) {
    let body;
    try {
        body = await fetchBrowserText(masterUrl);
    } catch (e) {
        return masterUrl;
    }
    const lines = body.split('\n');
    const variants = [];
    lines.forEach((line, i) => {
        if (line.indexOf('#EXT-X-STREAM-INF') !== 0) return;
        const bandwidth = /BANDWIDTH=(\d+)/.exec(line);
        const uri = lines.slice(i + 1).filter((l) => l && l.charAt(0) !== '#')[0];
        if (uri) variants.push({ bandwidth: bandwidth ? parseInt(bandwidth[1], 10) : 0, url: resolveUrl(uri.trim(), masterUrl) });
    });
    if (variants.length < 2) return masterUrl;
    variants.sort((a, b) => b.bandwidth - a.bandwidth);
    return variants[0].url;
}

/** Hosts this repo knows how to turn into a playable link. */
export const RESOLVERS = {
    vimeos: { key: 'vimeos', server: 'Vimeos', resolve: resolveVimeos },
    streamwish: { key: 'streamwish', server: 'Streamwish', resolve: resolveStreamWish },
    vidhide: { key: 'vidhide', server: 'Vidhide', resolve: resolveVidhide }
};

/**
 * Pick the resolver for an embed URL, or null when the host has none (VOE is deliberately absent).
 * @param {string} embedUrl
 */
export function resolverFor(embedUrl) {
    const host = hostOf(embedUrl);
    if (host.indexOf('vimeos') >= 0) return RESOLVERS.vimeos;
    if (/streamwish|hlswish|hglink|strwish/.test(host)) return RESOLVERS.streamwish;
    if (/vidhide|dintezuvio|filelions/.test(host)) return RESOLVERS.vidhide;
    return null;
}
