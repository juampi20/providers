/**
 * SoloLatino — the embed69 player sololatino.net embeds.
 *
 * Goes straight to embed69.org, since the site's own search sits behind Cloudflare. Resolves vidhide and
 * streamwish, which share the packed `var links` player.
 */

import CryptoJS from 'crypto-js';
import { fetchBrowserText, fetchBrowserJson, BROWSER_UA } from '../_utils/http.js';
import { between, hostOf, vibuxerUrl } from '../_utils/packed.js';
import { resolveVidhide, resolveStreamWish } from '../_utils/resolvers.js';
import { inferQuality } from '../_utils/quality.js';
import { labeled, groupByLanguage, resolveFirstLanguage } from '../_utils/labels.js';
import { tmdbApiKey } from '../_utils/tmdb.js';

export const PROVIDER_NAME = 'SoloLatino';

// /video/ 302s to /f/ when the title is there, so it covers both layouts.
const EMBED_BASE = 'https://embed69.org/video/';
// Wikimedia answers 403 to browser-like User-Agents from non-browsers; it wants one naming the client.
const WIKIDATA_UA = 'nuvio-providers/1.0 (https://github.com/juampi20/providers)';
const LANGUAGES = { LAT: 'Latino', ESP: 'Castellano', SUB: 'Subtitulado' };
const LANGUAGE_ORDER = ['LAT', 'ESP', 'SUB'];
const SERVERS = { vidhide: 'Vidhide', streamwish: 'Streamwish' };

// Without a key, or when TMDB has no answer (e.g. a bad key), fall back to Wikidata, which needs no key.
export async function getImdbId(tmdbId, mediaType) {
    const key = tmdbApiKey();
    if (!key) return getImdbIdFromWikidata(tmdbId, mediaType);
    const path = mediaType === 'movie' ? '/movie/' + tmdbId : '/tv/' + tmdbId + '/external_ids';
    const data = await fetchBrowserJson('https://api.themoviedb.org/3' + path + '?api_key=' + encodeURIComponent(key));
    return (data && data.imdb_id) || getImdbIdFromWikidata(tmdbId, mediaType);
}

// P4947 / P4983 are Wikidata's TMDB movie / TV ids, P345 the IMDb id.
async function getImdbIdFromWikidata(tmdbId, mediaType) {
    const prop = mediaType === 'movie' ? 'P4947' : 'P4983';
    const query = 'SELECT ?imdb WHERE { ?item wdt:' + prop + ' "' + String(tmdbId).replace(/\D/g, '') + '"; wdt:P345 ?imdb } LIMIT 1';
    const response = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query), { headers: { 'User-Agent': WIKIDATA_UA } });
    const data = await response.json();
    const row = data && data.results && data.results.bindings[0];
    return row ? row.imdb.value : null;
}

/** @param {string} imdbId */
export function embedId(imdbId, mediaType, season, episode) {
    if (mediaType === 'movie') return imdbId;
    return imdbId + '-' + season + 'x' + String(episode).padStart(2, '0');
}

// Brute-force a nonce whose SHA-256 starts with `difficulty` zeros; the AES key is
// SHA-256(challenge + nonce + salt).
function deriveKey(challenge, difficulty, salt) {
    const prefix = '0'.repeat(difficulty);
    let nonce = 0;
    while (CryptoJS.SHA256(challenge + nonce).toString().indexOf(prefix) !== 0) nonce++;
    return CryptoJS.SHA256(challenge + nonce + salt);
}

// Payload is base64(iv[16] + ciphertext), AES-256-CBC.
function decrypt(base64, key) {
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

/**
 * Returns [{ language, server, url }] from an embed69 page, or [] if the layout changed.
 * @param {string} html
 */
export function parseEmbedPage(html) {
    const challenge = between(html, "const POW_CHALLENGE = '", "';");
    const difficulty = parseInt(between(html, 'const POW_DIFFICULTY = ', ';'), 10);
    const salt = between(html, "const POW_SALT = '", "';");
    const dataLink = between(html, 'dataLink = ', ';');
    if (!challenge || isNaN(difficulty) || salt === null || !dataLink) return [];

    const key = deriveKey(challenge, difficulty, salt);
    const result = [];
    JSON.parse(dataLink).forEach((lang) => {
        (lang.sortedEmbeds || []).forEach((embed) => {
            const url = embed.link && decrypt(embed.link, key);
            if (url) result.push({ language: lang.video_language, server: embed.servername, url });
        });
    });
    return result;
}

/**
 * Titles missing from /f/ (e.g. The 100) only exist on embed69's /video/ page, a plain list of
 * playServerVast('<url>') entries, each tagged with a data-lang index into the language tabs.
 * @param {string} html
 */
export function parseVideoPage(html) {
    const languages = {};
    html.replace(/<li class="SLD_[A-Z]" data-lang="(\d+)">\s*<img src="[^"]*\/lang\/([A-Z]+)\.png/g, (m, index, lang) => {
        languages[index] = lang;
    });
    const result = [];
    html.replace(/playServerVast\('([^']+)'\);" data-lang="(\d+)"/g, (m, url, index) => {
        const host = hostOf(url);
        const server = host.indexOf('vidhide') >= 0 ? 'vidhide' : /streamwish|hglink/.test(host) ? 'streamwish' : host;
        result.push({ language: languages[index] || 'LAT', server, url });
    });
    return result;
}

/** @param {string} html */
export function parsePage(html) {
    return parseEmbedPage(html).concat(parseVideoPage(html));
}

/** streamwish mirrors go through vibuxer.com, which serves the same packed player as vidhide. */
export function playableEmbed(embed) {
    if (embed.server === 'vidhide') return embed.url;
    if (embed.server === 'streamwish') return vibuxerUrl(embed.url);
    return null;
}

async function resolveEmbed(embed) {
    const embedUrl = playableEmbed(embed);
    try {
        const found = embed.server === 'streamwish' ? await resolveStreamWish(embedUrl) : await resolveVidhide(embedUrl);
        found.forEach((stream) => { stream.quality = inferQuality(stream.url, embed.server); });
        return labeled(PROVIDER_NAME, LANGUAGES[embed.language] || embed.language, SERVERS[embed.server], found);
    } catch (e) {
        return [];
    }
}

/**
 * @param {string} tmdbId
 * @param {string} mediaType
 * @param {number} season
 * @param {number} episode
 */
export async function extractStreams(tmdbId, mediaType, season, episode) {
    const imdbId = await getImdbId(tmdbId, mediaType);
    if (!imdbId) throw new Error('No IMDB id for TMDB ' + tmdbId);

    const html = await fetchBrowserText(EMBED_BASE + embedId(imdbId, mediaType, season, episode), 'https://sololatino.net/');
    const embeds = parsePage(html).filter((embed) => playableEmbed(embed));
    return resolveFirstLanguage(groupByLanguage(embeds, LANGUAGE_ORDER), 0, resolveEmbed);
}

/** Extracted links for a player URL, as plain strings (used by the live script). */
export async function extractHls(url) {
    const found = await resolveVidhide(url);
    return found.map((stream) => stream.url);
}

export const _test = {
    getImdbId,
    parseEmbedPage,
    parseVideoPage,
    parsePage,
    embedId,
    playableEmbed,
    extractHls,
    groupByLanguage: (embeds) => groupByLanguage(embeds, LANGUAGE_ORDER)
};
