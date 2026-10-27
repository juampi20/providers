/**
 * Vimeus — vimeus.com, a front keyed by TMDB id.
 *
 * One request per title: `/e/movie?tmdb=<id>` or `/e/serie?tmdb=<id>&se=&ep=` answers a page whose
 * `<script type="text/json" id="data">` already carries the embed list, so there is no title to match and no
 * TMDB key to ask for. The embeds are vimeos (and friends), which the shared resolvers already handle.
 */

import { browserHeaders } from '../_utils/http.js';
import { resolverFor, playableLinks, resolveVimeos, resolveStreamWish, unpack } from '../_utils/packed.js';
import { inferQuality } from '../_utils/quality.js';
import { labeled } from '../_utils/labels.js';

export const PROVIDER_NAME = 'Vimeus';

const BASE = 'https://vimeus.com';
// The site does not publish this key; it is the one every client sends, and without it the endpoint answers
// 400. If the site rotates it, every Vimeus request starts failing until this constant is updated.
export const VIEW_KEY = 'ttapaNFkp2YbIFMawxmnqCPcs0pRVzbjrI5r1-da5M4';
// The payload carries no language; the catalogue is Latino.
const LANGUAGE = 'Latino';

/**
 * The page Vimeus answers for one title.
 * @param {string} tmdbId
 * @param {string} mediaType
 * @param {number} season
 * @param {number} episode
 */
export function embedPageUrl(tmdbId, mediaType, season, episode) {
    const query = '?tmdb=' + encodeURIComponent(tmdbId) + (mediaType === 'movie' ? '' : '&se=' + season + '&ep=' + episode);
    const path = mediaType === 'movie' ? '/e/movie' : '/e/serie';
    return BASE + path + query + '&view_key=' + VIEW_KEY;
}

/**
 * Pull the JSON payload out of the page. Returns null when the page carries none (layout change, key
 * rejected with a 200 error page, or a title the site does not have).
 * @param {string} html
 */
export function parseDataScript(html) {
    const m = /<script[^>]*type=["']text\/json["'][^>]*id=["']data["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
    if (!m) return null;
    try {
        return JSON.parse(m[1]);
    } catch (e) {
        return null;
    }
}

/**
 * Embeds out of the payload: `[{ url, server }]`, absolute URLs only.
 * @param {object} payload
 */
export function payloadEmbeds(payload) {
    return ((payload && payload.embeds) || [])
        .map((embed) => {
            const url = String((embed && embed.url) || '');
            if (!url) return null;
            const absolute = url.indexOf('//') === 0 ? 'https:' + url : url;
            return /^https?:\/\//.test(absolute) ? { url: absolute, server: embed.server || '' } : null;
        })
        .filter(Boolean);
}

/**
 * Fetch the payload for a title, turning the one failure mode that has a name into a clear log line.
 * @param {string} url
 */
export async function fetchPayload(url) {
    const response = await fetch(url, { headers: browserHeaders(BASE + '/') });
    if (!response.ok) {
        if (response.status === 400) throw new Error('view_key rechazada (400): el sitio rotó VIEW_KEY');
        throw new Error('HTTP ' + response.status + ' for ' + url);
    }
    const payload = parseDataScript(await response.text());
    if (!payload) throw new Error('la página no trae el bloque text/json de datos');
    return payload;
}

async function streamsFrom(embedUrl) {
    const resolver = resolverFor(embedUrl);
    if (!resolver) return [];
    try {
        const found = await resolver.resolve(embedUrl);
        found.forEach((stream) => { stream.quality = inferQuality(stream.url, resolver.key); });
        return labeled(PROVIDER_NAME, LANGUAGE, resolver.server, found);
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
    const payload = await fetchPayload(embedPageUrl(tmdbId, mediaType, season, episode));
    const embeds = payloadEmbeds(payload).filter((embed) => resolverFor(embed.url));
    if (!embeds.length) return [];

    const lists = await Promise.all(embeds.map((embed) => streamsFrom(embed.url)));
    return lists.reduce((all, list) => all.concat(list), []);
}

export const _test = {
    embedPageUrl,
    parseDataScript,
    payloadEmbeds,
    fetchPayload,
    resolverFor,
    playableLinks,
    unpack,
    resolveVimeos,
    resolveStreamWish,
    inferQuality
};
