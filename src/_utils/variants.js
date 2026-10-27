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
import { mp4Resolution, mp4Size, sizeLabel, heightLabel } from './mp4.js';

/** Alto de la variante al nombre que se muestra. */
const labelForHeight = heightLabel;

/** ¿El link es un archivo directo y no un HLS? (zilla sirve HLS bajo `/m3u8/<hash>`, sin extensión) */
export function isDirectFile(url) {
    return !/(\.m3u8|\.txt(\?|$)|\/m3u8\/)/i.test(String(url));
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
        return { url, quality: 'Auto', height: 0 };
    }

    if (body.indexOf('#EXT-X-STREAM-INF') < 0) {
        // Playlist de media: la resolución no está en el texto, así que se cae a lo que diga el link.
        return { url, quality: inferQuality(url), height: 0 };
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

    if (!best) return { url, quality: 'Auto', height: 0 };
    return { url: best.url, quality: labelForHeight(best.height), height: best.height };
}

/**
 * Aplica `bestPlayable` a la salida de un resolver y le agrega lo que se pudo medir de verdad:
 * `{ url, headers }` → `{ url, headers, quality, resolution, protocol }`.
 *
 * Un archivo directo (`.mp4`) se etiqueta leyendo su `tkhd`: es la fuente de mejor calidad en estos hosts y
 * sin eso quedaría en `Auto`, por debajo de cualquier HLS.
 *
 * @param {Array<{url: string, headers?: object}>} found
 */
export async function withRealQuality(found) {
    return Promise.all(found.map(async (stream) => {
        if (isDirectFile(stream.url)) {
            const size = await mp4Resolution(stream.url, stream.headers).catch(() => null);
            // Sin `Range` (el runtime del cliente puede ignorarlo) no hay resolución: se mide el tamaño.
            const bytes = size ? 0 : await mp4Size(stream.url, stream.headers).catch(() => 0);
            return {
                url: stream.url,
                headers: stream.headers,
                quality: size ? labelForHeight(size.height) : 'Direct',
                resolution: size ? size.width + 'x' + size.height : '',
                size: sizeLabel(bytes || (size ? 0 : 0)),
                protocol: 'mp4',
                kind: 'direct',
                best: !!size && size.height >= 720
            };
        }
        const resolved = await bestPlayable(stream.url);
        return {
            url: resolved.url,
            headers: stream.headers,
            // Sin resolución legible, el primer token es la clase: Web.
            quality: resolved.height ? resolved.quality : 'Web',
            resolution: resolved.height ? 'x' + resolved.height : '',
            size: '',
            protocol: 'hls',
            kind: 'web',
            best: !!resolved.height && resolved.height >= 1080
        };
    }));
}
