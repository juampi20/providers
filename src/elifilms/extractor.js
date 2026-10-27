/**
 * EliFilms — allcalidad.re, REST JSON puro.
 *
 * No hay slug ni PoW: se busca por texto, el sitio devuelve posts con su `_id`, y el player entrega los
 * embeds como JSON (`{ lang, quality, url }`). En la práctica todo sale por vimeos, que el resolver
 * compartido ya maneja.
 */

import { fetchBrowserJson } from '../_utils/http.js';
import { titlesFor, bestTitleMatch, splitTitleYear } from '../_utils/matcher.js';
import { resolverFor } from '../_utils/resolvers.js';
import { inferQuality } from '../_utils/quality.js';
import { labeled, groupByLanguage, resolveFirstLanguage } from '../_utils/labels.js';

export const PROVIDER_NAME = 'EliFilms';

const HOST = 'https://allcalidad.re';
const API = HOST + '/api/rest/';
const LANGUAGE_ORDER = ['Latino', 'Español', 'Subtitulado'];
const SERVERS_SUFFIX = { voe: 'VOE', vimeos: 'Vimeos', vidhide: 'Vidhide', streamwish: 'Streamwish', goodstream: 'GoodStream', dood: 'Doodstream' };

const API_HEADERS = { Accept: 'application/json, text/plain, */*', Referer: HOST + '/' };

/**
 * El sitio rompe con queries largas, así que se manda lo mínimo: dos palabras de más de un carácter.
 * @param {string} title
 */
export function searchQuery(title) {
    return String(title || '')
        .split(':')[0]
        .replace(/[([][^)\]]*[)\]]/g, ' ')
        .replace(/[^a-zA-Z0-9\s\-áéíóúÁÉÍÓÚñÑ]/g, ' ')
        .split(/\s+/)
        .filter((word) => word.length > 1)
        .slice(0, 2)
        .join(' ');
}

/** @param {string} query */
export function search(query, mediaType) {
    const postType = mediaType === 'movie' ? 'movies' : 'tvshows';
    return fetchBrowserJson(API + 'search?post_type=' + postType + '&query=' + encodeURIComponent(query) + '&posts_per_page=20', API_HEADERS)
        .then((body) => (body && body.data && body.data.posts) || []);
}

/** @param {number|string} showId */
export function episodes(showId) {
    // Los episodios vienen como array directo en `data`, no dentro de una clave con nombre.
    return fetchBrowserJson(API + 'episodes?post_id=' + showId, API_HEADERS)
        .then((body) => {
            const data = body && body.data;
            if (Array.isArray(data)) return data;
            return (data && data.episodes) || [];
        });
}

/** `_any=1` no es opcional: sin él el endpoint responde 200 con la lista vacía. */
export function playerEmbeds(postId) {
    return fetchBrowserJson(API + 'player?post_id=' + postId + '&_any=1', API_HEADERS).then((body) => {
        const embeds = (body && body.data && body.data.embeds) || [];
        return embeds
            .filter((embed) => embed && typeof embed.url === 'string' && /^https?:\/\//.test(embed.url.replace(/\\\//g, '/')))
            .map((embed) => ({ url: embed.url.replace(/\\\//g, '/'), language: normalizeLanguage(embed.lang) }));
    });
}

/** @param {string} lang */
export function normalizeLanguage(lang) {
    const text = String(lang || '').toLowerCase();
    if (text.indexOf('castellano') >= 0 || text.indexOf('espa') >= 0) return 'Español';
    if (text.indexOf('sub') >= 0 || text.indexOf('vose') >= 0) return 'Subtitulado';
    return 'Latino';
}

/**
 * Busca el post que corresponde al título, probando cada título cosechado de TMDB.
 * @param {string[]} titles
 * @param {string} year
 */
export async function findPost(titles, year, mediaType) {
    const collected = [];
    for (const title of titles.slice(0, 3)) {
        const query = searchQuery(title);
        if (!query) continue;
        (await search(query, mediaType).catch(() => [])).forEach((post) => {
            const head = splitTitleYear(post.title);
            collected.push({ id: post._id, title: head.title, year: head.year });
        });
        if (collected.length) break;
    }
    const match = bestTitleMatch(titles, year, collected, {});
    return match ? match.id : null;
}

/** @param {Array} list */
export function pickEpisode(list, season, episode) {
    const found = list.filter((entry) =>
        parseInt(entry.season_number, 10) === parseInt(season, 10) &&
        parseInt(entry.episode_number, 10) === parseInt(episode, 10));
    return found.length ? found[0]._id : null;
}

async function resolveEmbed(embed) {
    const resolver = resolverFor(embed.url);
    if (!resolver) return [];
    try {
        const found = await resolver.resolve(embed.url);
        return labeled(PROVIDER_NAME, embed.language, SERVERS_SUFFIX[resolver.key] || resolver.server, found);
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
    const meta = await titlesFor(tmdbId, mediaType);
    const showId = await findPost(meta.titles, meta.year, mediaType);
    if (!showId) return [];

    let postId = showId;
    if (mediaType !== 'movie') {
        const list = await episodes(showId).catch(() => []);
        postId = pickEpisode(list, season, episode);
        if (!postId) return [];
    }

    const embeds = (await playerEmbeds(postId)).filter((embed) => resolverFor(embed.url));
    return resolveFirstLanguage(groupByLanguage(embeds, LANGUAGE_ORDER), 0, resolveEmbed);
}

export const _test = {
    searchQuery,
    search,
    episodes,
    playerEmbeds,
    normalizeLanguage,
    findPost,
    pickEpisode,
    resolverFor,
    groupByLanguage: (embeds) => groupByLanguage(embeds, LANGUAGE_ORDER)
};
