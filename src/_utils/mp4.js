/**
 * Resolution of a direct `.mp4`, read from its own header.
 *
 * A `.mp4` carries its real size in the `tkhd` box inside `moov`, so a ranged read of the first or last
 * 64 KB answers it without downloading the video. That is what lets an mp4 stream show "1080p" instead of
 * `Auto` — and therefore rank as what it is, since these files are usually the best source available.
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const WINDOW = 65536;

/**
 * Ancho y alto declarados en el `tkhd` de un buffer, o null si no está ahí.
 * @param {Uint8Array} bytes
 */
export function readTkhd(bytes) {
    const view = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let searchFrom = 0;
    while (searchFrom < view.length) {
        const at = view.indexOf('tkhd', searchFrom, 'latin1');
        if (at < 0) return null;
        const size = view.readUInt32BE(at - 4);
        const end = at - 4 + size;
        if (size >= 84 && end <= view.length) {
            // Los dos últimos campos del box son width y height en 16.16 fixed point.
            const width = view.readUInt32BE(end - 8) / 65536;
            const height = view.readUInt32BE(end - 4) / 65536;
            if (width >= 100 && height >= 100) return { width, height };
        }
        searchFrom = at + 4;
    }
    return null;
}

/** @param {number} height */
export function heightLabel(height) {
    if (height >= 2000) return '4K';
    if (height >= 1000) return '1080p';
    if (height >= 700) return '720p';
    if (height >= 460) return '480p';
    if (height > 0) return '360p';
    return 'Auto';
}

/**
 * Resolución de un mp4: se mira la cabecera y, si `moov` está al final (habitual en estos hosts), la cola.
 * Devuelve `null` cuando el servidor no acepta rangos o el archivo no declara tamaño.
 * @param {string} url
 * @param {object} [headers]
 */
export async function mp4Resolution(url, headers) {
    const ranges = [{ Range: 'bytes=0-' + (WINDOW - 1) }, { Range: 'bytes=-' + WINDOW }];
    for (const range of ranges) {
        let response;
        try {
            response = await fetch(url, { headers: Object.assign({ 'User-Agent': UA }, headers || {}, range) });
        } catch (e) {
            return null;
        }
        if (!response.ok) continue;
        if (response.status !== 206) {
            // Sin soporte de rangos, no se puede leer sin bajar el archivo entero: se abandona.
            return null;
        }
        const buffer = new Uint8Array(await response.arrayBuffer());
        const size = readTkhd(buffer);
        if (size) return size;
    }
    return null;
}
