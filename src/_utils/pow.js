/**
 * Proof-of-work pages: embed69 and the sites built on the same engine (megadede, entrepeliculasyseries)
 * serve their embed list only after solving a hashcash puzzle and decrypting it with AES-256-CBC.
 *
 * The page carries `POW_CHALLENGE`, `POW_DIFFICULTY`, `POW_SALT` and a `dataLink` JSON blob. The key is
 * `SHA-256(challenge + nonce + salt)`, where `nonce` is brute-forced until `SHA-256(challenge + nonce)`
 * starts with `difficulty` zeros; each embed link is base64 of `iv[16] + ciphertext`.
 */

import CryptoJS from 'crypto-js';
import { between } from './packed.js';

/** Brute-force the nonce and return the AES key. */
function deriveKey(challenge, difficulty, salt) {
    const prefix = '0'.repeat(difficulty);
    let nonce = 0;
    while (CryptoJS.SHA256(challenge + nonce).toString().indexOf(prefix) !== 0) nonce++;
    return CryptoJS.SHA256(challenge + nonce + salt);
}

/** @param {string} base64 @param {object} key */
export function decryptLink(base64, key) {
    try {
        const raw = CryptoJS.enc.Base64.parse(base64);
        const iv = CryptoJS.lib.WordArray.create(raw.words.slice(0, 4), 16);
        const ciphertext = CryptoJS.lib.WordArray.create(raw.words.slice(4), raw.sigBytes - 16);
        const plain = CryptoJS.AES.decrypt({ ciphertext }, key, {
            iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7
        }).toString(CryptoJS.enc.Utf8);
        return plain || null;
    } catch (e) {
        return null;
    }
}

/** El JSON que sigue a `dataLink =`, o null si la página no lo trae. */
export function dataLinkOf(html) {
    const raw = between(html, 'dataLink = ', ';');
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

/** ¿La página trae el puzzle? Sirve para distinguir "no hay título" de "el sitio cambió". */
export function hasPuzzle(html) {
    return /POW_CHALLENGE\s*=/.test(html) && /POW_DIFFICULTY\s*=/.test(html);
}

/**
 * Devuelve los embeds descifrados de una página con PoW: `[{ language, server, url }]`.
 * Lista vacía cuando la página no trae puzzle o el layout cambió.
 * @param {string} html
 * @param {{ skipServers?: RegExp }} [options]
 */
export function parsePowPage(html, options = {}) {
    const challenge = between(html, "const POW_CHALLENGE = '", "';") || between(html, 'POW_CHALLENGE = "', '";');
    const difficulty = parseInt(between(html, 'const POW_DIFFICULTY = ', ';') || between(html, 'POW_DIFFICULTY = ', ';'), 10);
    const salt = between(html, "const POW_SALT = '", "';") || between(html, 'POW_SALT = "', '";');
    const blocks = dataLinkOf(html);
    if (!challenge || isNaN(difficulty) || salt === null || !blocks) return [];

    const key = deriveKey(challenge, difficulty, salt);
    const result = [];
    blocks.forEach((block) => {
        (block.sortedEmbeds || []).forEach((embed) => {
            if (embed.type && embed.type !== 'video') return;
            if (options.skipServers && options.skipServers.test(embed.servername || '')) return;
            const url = embed.link && decryptLink(embed.link, key);
            if (url && /^https?:\/\//.test(url)) {
                result.push({ language: block.video_language, server: embed.servername, url });
            }
        });
    });
    return result;
}

/** Idiomas de estos sitios al nombre que ve el usuario. */
export const POW_LANGUAGES = { LAT: 'Latino', ESP: 'Castellano', SUB: 'Subtitulado' };
export const POW_LANGUAGE_ORDER = ['LAT', 'ESP', 'SUB'];

/**
 * The flow the embed69-family sites share: IMDb id in, decrypted embeds out.
 * `path` is the site's own route for a title (`/vidurl/<imdb>/…`); its season/episode spelling differs per
 * site, so the caller builds it.
 * @param {string} host
 * @param {string} path
 */
export async function fetchPowEmbeds(host, path) {
    const response = await fetch(host + path, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,*/*',
            'Accept-Language': 'es-MX,es;q=0.9',
            Referer: host + '/'
        }
    });
    if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + host + path);
    const html = await response.text();
    // These sites answer 200 with a short error body when the title is not there, so the puzzle is the check.
    if (!hasPuzzle(html)) {
        if (html.length < 2000) return [];
        throw new Error('la página no trae el puzzle PoW (¿cambió el sitio?)');
    }
    return parsePowPage(html, { skipServers: /filemoon|1fichier|fireload/i });
}
