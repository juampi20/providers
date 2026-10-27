/**
 * Pick the real best variant of an HLS link.
 *
 * These CDNs hand out a master whose variants are listed **lowest first** (`852x480 → 1280x720 →
 * 1920x1080`). A player that takes the first entry shows 480p while the row says 1080p, and a label guessed
 * from the URL's tier letters is fiction either way. Reading the master once gives both the real resolution
 * and the variant to play, at the cost of one text request — no segment is touched.
 */

import { fetchBrowserText } from './http.js';
import { resolveUrl } from './packed.js';
import { inferQuality } from './quality.js';

/** Alto de la variante al nombre que se muestra. */
function labelForHeight(height) {
    if (height >= 2000) return '4K';
    if (height >= 1000) return '1080p';
    if (height >= 700) return '720p';
    if (height >= 460) return '480p';
    if (height > 0) return '360p';
    return 'Auto';
}

/**
 * Devuelve la mejor variante de un master, o el mismo link cuando ya es una playlist de media.
 * @param {string} url
 */
export async function bestPlayable(url) {
    let body;
    try {
        body = await fetchBrowserText(url);
    } catch (e) {
        return { url, quality: 'Auto' };
    }

    if (body.indexOf('#EXT-X-STREAM-INF') < 0) {
        // Playlist de media: la resolución no está en el texto, así que se cae a lo que diga el link.
        return { url, quality: inferQuality(url) };
    }

    const lines = body.split('\n');
    let best = null;
    lines.forEach((line, i) => {
        if (line.indexOf('#EXT-X-STREAM-INF') !== 0) return;
        const uri = lines.slice(i + 1).filter((next) => next && next.charAt(0) !== '#')[0];
        if (!uri) return;
        const resolution = /RESOLUTION=(\d+)x(\d+)/.exec(line);
        const bandwidth = /BANDWIDTH=(\d+)/.exec(line);
        const height = resolution ? parseInt(resolution[2], 10) : 0;
        const bitrate = bandwidth ? parseInt(bandwidth[1], 10) : 0;
        // La resolución manda; el bitrate desempata.
        const score = height * 1000000 + bitrate;
        if (!best || score > best.score) best = { url: resolveUrl(uri.trim(), url), height, score };
    });

    if (!best) return { url, quality: 'Auto' };
    return { url: best.url, quality: labelForHeight(best.height) };
}

/**
 * Aplica `bestPlayable` a la salida de un resolver: `[{ url, headers }]` → `[{ url, headers, quality }]`.
 * @param {Array<{url: string, headers?: object}>} found
 */
export async function withRealQuality(found) {
    return Promise.all(found.map(async (stream) => {
        const resolved = await bestPlayable(stream.url);
        return { url: resolved.url, headers: stream.headers, quality: resolved.quality };
    }));
}
