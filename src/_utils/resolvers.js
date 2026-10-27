/**
 * Embed resolvers — one function per server family, chosen by host.
 *
 * The set follows what the working Latino provider ecosystem resolves (latinuvio's `cdn_resolvers.js`), minus
 * the parts that contradict this repo's rules: nothing here probes the resulting link, and `hls4` is never
 * returned because its segments carry a PNG header libmpv refuses.
 */

import JsUnpacker from './jsunpack.js';
import { BROWSER_UA, fetchBrowserText, browserHeaders } from './http.js';
import { between, resolveUrl, hostOf, vibuxerUrl, playableLinks } from './packed.js';

/** @param {string} html */
function unpack(html) {
    const unpacker = new JsUnpacker(html);
    return unpacker.detect() ? unpacker.unpack() : null;
}

/** Primer .m3u8 que aparezca en un texto. @param {string} text */
function firstM3u8(text) {
    const m = /["']?(https?:\/\/[^"'\s<>\\]+\.m3u8[^"'\s<>\\]*)["']?/i.exec(text || '');
    return m ? m[1] : null;
}

// ── players empaquetados (p,a,c,k,e,d) ─────────────────────────────────────────────────────────────────────

/** vidhide / dint ezuvio / minochinos: packer con `var links` o hls2/hls4. */
export async function resolveVidhide(embedUrl) {
    const html = await fetchBrowserText(embedUrl, embedUrl);
    const script = unpack(html);
    if (script) {
        const links = between(script, 'var links=', ';');
        if (links) {
            const urls = playableLinks(JSON.parse(links), embedUrl);
            if (urls.length) return urls.map((url) => ({ url, headers: { 'User-Agent': BROWSER_UA, Referer: embedUrl } }));
        }
        const direct = /"(hls2|hls3)"\s*:\s*"([^"]+)"/.exec(script);
        if (direct) return [{ url: resolveUrl(direct[2], embedUrl), headers: { 'User-Agent': BROWSER_UA, Referer: embedUrl } }];
    }
    return [];
}

/** streamwish y mirrors: se reescriben a vibuxer, que sirve el mismo player empaquetado. */
export async function resolveStreamWish(embedUrl) {
    const target = vibuxerUrl(embedUrl);
    const html = await fetchBrowserText(target, target);
    const script = unpack(html);
    const links = script && between(script, 'var links=', ';');
    if (!links) return [];
    return playableLinks(JSON.parse(links), target).map((url) => ({ url, headers: { 'User-Agent': BROWSER_UA, Referer: target } }));
}

/**
 * vimeos: el master trae dos variantes y, en muchos títulos, un grupo de audio que el player puede no saber
 * enganchar (audio sin imagen). Se devuelve la variante de mayor calidad, que trae audio y video muxados.
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

/** La playlist de mayor bandwidth de un master, o el master si no hay nada que elegir. */
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

// ── players que exponen el link en el HTML ────────────────────────────────────────────────────────────────

/** goodstream: `file: "https://….m3u8"` en el HTML o en el packer. */
export async function resolveGoodstream(embedUrl) {
    const html = await fetchBrowserText(embedUrl, 'https://goodstream.one/');
    const unpacked = unpack(html) || html;
    const file = /file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i.exec(unpacked);
    const url = file ? file[1] : firstM3u8(unpacked);
    if (!url) return [];
    return [{ url, headers: { 'User-Agent': BROWSER_UA, Referer: 'https://goodstream.one/' } }];
}

/** uqload: `sources: [...]` con el m3u8 adentro. */
export async function resolveUqload(embedUrl) {
    const html = await fetchBrowserText(embedUrl, 'https://uqload.com/');
    const unpacked = unpack(html) || html;
    const url = firstM3u8(unpacked);
    if (!url) return [];
    return [{ url, headers: { 'User-Agent': BROWSER_UA, Referer: 'https://uqload.com/' } }];
}

/** audinifer: packer con `file`/`src` o el m3u8 directo. */
export async function resolveAudinifer(embedUrl) {
    const html = await fetchBrowserText(embedUrl, embedUrl);
    const unpacked = unpack(html) || html;
    const file = /(?:file|src)\s*[:=]\s*["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/i.exec(unpacked);
    const url = file ? file[1] : firstM3u8(unpacked);
    if (!url) return [];
    return [{ url, headers: { 'User-Agent': BROWSER_UA, Referer: embedUrl } }];
}

/**
 * VOE: el player ofusca el link en un JSON que hay que deshacer a mano —
 * rot13 → sacar ruido → base64 → correr cada char -3 → invertir → base64 → JSON.
 * Nuvio no trae `atob`, así que el base64 se decodifica con una tabla.
 */
export async function resolveVoe(embedUrl) {
    const html = await fetchBrowserText(embedUrl, embedUrl);
    const redirected = /window\.location\.href\s*=\s*["']([^"']+)["']/i.exec(html);
    if (redirected && html.length < 4000) return resolveVoe(redirected[1]);

    const scriptJson = /<script type="application\/json">([\s\S]*?)<\/script>/.exec(html);
    if (scriptJson) {
        let encoded = null;
        try {
            encoded = JSON.parse(scriptJson[1].trim());
            if (Array.isArray(encoded)) encoded = encoded[0];
        } catch (e) {
            encoded = null;
        }
        if (typeof encoded === 'string') {
            const url = decodeVoe(encoded);
            if (url) return [{ url, headers: { 'User-Agent': BROWSER_UA, Referer: embedUrl } }];
        }
    }
    const raw = firstM3u8(html);
    if (!raw) return [];
    return [{ url: raw, headers: { 'User-Agent': BROWSER_UA, Referer: embedUrl } }];
}

function decodeVoe(encoded) {
    try {
        let text = encoded.replace(/[a-zA-Z]/g, (c) => {
            const code = c.charCodeAt(0);
            const limit = c <= 'Z' ? 90 : 122;
            const shifted = code + 13;
            return String.fromCharCode(limit >= shifted ? shifted : shifted - 26);
        });
        ['@$', '^^', '~@', '%?', '*~', '!!', '#&'].forEach((noise) => {
            text = text.split(noise).join('');
        });
        const first = decodeBase64(text);
        let shifted = '';
        for (let i = 0; i < first.length; i++) shifted += String.fromCharCode(first.charCodeAt(i) - 3);
        const payload = JSON.parse(decodeBase64(shifted.split('').reverse().join('')));
        return (payload && (payload.source || payload.direct_access_url)) || null;
    } catch (e) {
        return null;
    }
}

/** doodstream / ds2play: el player pide un token a `/pass_md5/<path>` y arma la URL final con él. */
export async function resolveDood(embedUrl) {
    const host = (embedUrl.match(/^(https?:\/\/[^/]+)/) || [])[1] || 'https://dood.to';
    const html = await fetchBrowserText(embedUrl, embedUrl);
    const path = /\$\.get\(\s*["']\/pass_md5\/([^"']+)["']/.exec(html);
    if (!path) {
        const direct = firstM3u8(html);
        return direct ? [{ url: direct, headers: { 'User-Agent': BROWSER_UA, Referer: embedUrl } }] : [];
    }
    const token = (await fetchBrowserText(host + '/pass_md5/' + path[1], embedUrl)).trim();
    if (!token) return [];
    const random = Math.random().toString(36).slice(2, 12);
    return [{ url: token + random + '?token=' + path[1] + '&expiry=' + Date.now(), headers: { 'User-Agent': BROWSER_UA, Referer: host + '/' } }];
}

/** ok.ru / odnoklassniki: `videoPlayerMetadata` por POST. */
export async function resolveOkru(embedUrl) {
    const id = /(?:ok\.ru|odnoklassniki\.ru)\/(?:videoembed|video|live)\/(\d+)/i.exec(embedUrl)
        || /[?&]mid=(\d+)/i.exec(embedUrl);
    if (!id) return [];
    const response = await fetch('https://www.ok.ru/dk', {
        method: 'POST',
        headers: {
            'User-Agent': BROWSER_UA,
            'Content-Type': 'application/x-www-form-urlencoded',
            Referer: 'https://ok.ru/videoembed/' + id[1],
            Origin: 'https://ok.ru'
        },
        body: 'cmd=videoPlayerMetadata&mid=' + id[1]
    });
    const data = await response.json().catch(() => null);
    if (!data || data.error) return [];
    const url = data.hlsManifestUrl || data.hlsMasterPlaylistUrl || (data.videos && data.videos[0] && data.videos[0].url);
    if (!url) return [];
    return [{ url, headers: { 'User-Agent': BROWSER_UA, Referer: 'https://ok.ru/' } }];
}

/**
 * Página wrapper: algunos sitios embeben su propio player, que imprime el m3u8/mp4 en el HTML.
 * Es el último recurso, y solo cuando el host no tiene resolver propio.
 */
export async function resolveWrapperPage(embedUrl) {
    const html = await fetchBrowserText(embedUrl, embedUrl);
    const file = /(?:file|source|src)\s*[:=]\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i.exec(html);
    const url = file ? file[1] : firstM3u8(html);
    if (!url) return [];
    return [{ url: resolveUrl(url, embedUrl), headers: { 'User-Agent': BROWSER_UA, Referer: embedUrl } }];
}

// ── base64 sin atob (Hermes) ──────────────────────────────────────────────────────────────────────────────

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** @param {string} text */
export function decodeBase64(text) {
    let out = '';
    let buffer = 0;
    let bits = 0;
    for (let i = 0; i < text.length; i++) {
        const value = BASE64.indexOf(text.charAt(i));
        if (value < 0) continue;
        buffer = (buffer << 6) | value;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            out += String.fromCharCode((buffer >> bits) & 0xff);
        }
    }
    return out;
}

/**
 * Varios catálogos entregan `embedshortener.co/e/<jwt>` en vez del embed real: el payload lleva el host
 * verdadero, así que desenvolverlo convierte un host opaco en voe/vidhide/streamwish.
 * @param {string} url
 */
export function unwrapEmbedShortener(url) {
    if (!/embedshortener\.|fkplayer\./i.test(String(url || ''))) return null;
    const token = String(url).split('/e/').pop().split(/[?#]/)[0];
    const parts = token.split('.');
    if (parts.length < 2) return null;
    let payload = null;
    try {
        payload = JSON.parse(decodeBase64(parts[1]));
    } catch (e) {
        return null;
    }
    if (!payload) return null;
    if (payload.embed && /^https?:/i.test(payload.embed)) return payload.embed;
    if (payload.link) {
        const decoded = decodeBase64(payload.link);
        if (/^https?:/i.test(decoded)) return decoded;
    }
    return null;
}

// ── mapa de hosts ────────────────────────────────────────────────────────────────────────────────────────

const VIDHIDE_HOSTS = /vidhide|dintezuvio|minochinos|morencius|movearnpre|luluvdo|filelions/;
const STREAMWISH_HOSTS = /streamwish|hlswish|hglink|hglamioz|strwish|wishfast|awish|flaswish|wishembed|dhcplay|vibuxer|bysefu|byse/;

export const RESOLVER_HOSTS = {
    vimeos: /vimeos/,
    streamwish: STREAMWISH_HOSTS,
    vidhide: VIDHIDE_HOSTS,
    voe: /voe/,
    goodstream: /goodstream/,
    uqload: /uqload|oneupload/,
    audinifer: /audinifer/,
    okru: /ok\.ru|okcdn|odnoklassniki/,
    dood: /doodstream|dood\.|ds2play/
};

/** Resolver para un embed, o null cuando el host no está soportado. */
export function resolverFor(embedUrl) {
    const host = hostOf(embedUrl);
    const shortener = unwrapEmbedShortener(embedUrl);
    if (shortener) return resolverFor(shortener);
    if (host.indexOf('vimeos') >= 0) return { key: 'vimeos', server: 'Vimeos', resolve: resolveVimeos };
    if (STREAMWISH_HOSTS.test(host)) return { key: 'streamwish', server: 'Streamwish', resolve: resolveStreamWish };
    if (VIDHIDE_HOSTS.test(host)) return { key: 'vidhide', server: 'Vidhide', resolve: resolveVidhide };
    if (host.indexOf('voe') >= 0) return { key: 'voe', server: 'VOE', resolve: resolveVoe, dynamic: true };
    if (host.indexOf('goodstream') >= 0) return { key: 'goodstream', server: 'GoodStream', resolve: resolveGoodstream, dynamic: true };
    if (host.indexOf('uqload') >= 0 || host.indexOf('oneupload') >= 0) return { key: 'uqload', server: 'Uqload', resolve: resolveUqload, dynamic: true };
    if (host.indexOf('audinifer') >= 0) return { key: 'audinifer', server: 'Audinifer', resolve: resolveAudinifer, dynamic: true };
    if (/ok\.ru|okcdn|odnoklassniki/.test(host)) return { key: 'okru', server: 'OK.ru', resolve: resolveOkru, dynamic: true };
    if (/doodstream|dood\.|ds2play|do7go/.test(host)) return { key: 'dood', server: 'Doodstream', resolve: resolveDood, dynamic: true };
    return null;
}
