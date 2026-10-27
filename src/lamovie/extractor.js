/**
 * LaMovie — lamovie.org, API JSON propia (`/wp-api/v1`).
 *
 * Se busca por texto con `postType`, el episodio se resuelve por temporada/número y el player entrega los
 * embeds como JSON (`{ lang, server, quality, url }`). Los embeds reales son vimeos y voe, que la capa
 * compartida ya resuelve.
 */

import { fetchBrowserJson } from '../_utils/http.js';
import { titlesFor, bestTitleMatch, splitTitleYear } from '../_utils/matcher.js';
import { resolverFor } from '../_utils/resolvers.js';
import { inferQuality } from '../_utils/quality.js';
import { labeled, groupByLanguage, resolveFirstLanguage } from '../_utils/labels.js';

export const PROVIDER_NAME = 'LaMovie';

const BASE = 'https://lamovie.org';
const API = BASE + '/wp-api/v1';
const HEADERS = { Accept: 'application/json', Referer: BASE + '/' };
const LANGUAGE_ORDER = ['Latino', 'Español', 'Subtitulado'];

/** `Latino - Inglés`, `Castellano`, `Subtitulado`… al nombre canónico. */
export function normalizeLanguage(lang) {
    const text = String(lang || '').toLowerCase();
    if (text.indexOf('castellano') >= 0 || text.indexOf('espa') >= 0) return 'Español';
    if (text.indexOf('sub') >= 0) return 'Subtitulado';
    if (text.indexOf('latino') >= 0) return 'Latino';
    return String(lang || 'Latino').trim();
}

/**
 * Búsqueda por título. `postType` no es opcional en la práctica: la API sin él asume `movies` y las series
 * devuelven `{"error":true,"message":"empty"}`.
 * @param {string} query
 * @param {string} postType `movies` | `tvshows` | `animes`
 */
export async function search(query, postType) {
    const body = await fetchBrowserJson(API + '/search?q=' + encodeURIComponent(query) + '&postType=' + postType, HEADERS);
    if (!body || body.error) return [];
    return (body.data && body.data.posts) || [];
}

/** Episodios de una serie: se busca el par temporada/número exacto. */
export async function episodes(seriesId, season) {
    const body = await fetchBrowserJson(API + '/single/episodes/list?_id=' + seriesId + '&season=' + parseInt(season, 10) + '&page=1&postsPerPage=100', HEADERS);
    if (!body || body.error) return [];
    return (body.data && body.data.posts) || [];
}

/** @param {Array} list */
export function pickEpisode(list, season, episode) {
    const found = list.filter((entry) =>
        parseInt(entry.season_number, 10) === parseInt(season, 10) &&
        parseInt(entry.episode_number, 10) === parseInt(episode, 10));
    return found.length ? found[0]._id : null;
}

/**
 * Embeds del player. Un postId inválido no da 404: devuelve `data.error` con un embed señuelo
 * (`lamovie.org/embed.html`), que hay que descartar en vez de intentar resolver.
 * @param {number|string} postId
 */
export async function playerEmbeds(postId) {
    const body = await fetchBrowserJson(API + '/player?postId=' + postId + '&demo=0', HEADERS);
    const data = body && body.data;
    if (!data || data.error) return [];
    return (data.embeds || [])
        .filter((embed) => embed && typeof embed.url === 'string' && /^https?:\/\//.test(embed.url))
        .filter((embed) => embed.url.indexOf(BASE + '/embed.html') !== 0)
        .map((embed) => ({ url: embed.url, language: normalizeLanguage(embed.lang), server: embed.server || '' }));
}

/**
 * Busca el post que corresponde, probando los títulos cosechados y los tipos que el sitio usa para ese
 * `mediaType` (las series pueden estar catalogadas como `animes`).
 * @param {string[]} titles
 */
export async function findPost(titles, year, mediaType) {
    const postTypes = mediaType === 'movie' ? ['movies'] : ['tvshows', 'animes'];
    const collected = [];
    for (const title of titles.slice(0, 3)) {
        for (const postType of postTypes) {
            (await search(title, postType).catch(() => [])).forEach((post) => {
                const head = splitTitleYear(post.title);
                collected.push({ id: post._id, title: head.title || post.title, year: head.year });
            });
        }
        if (collected.length) break;
    }
    const match = bestTitleMatch(titles, year, collected, {});
    return match ? match.id : null;
}

async function resolveEmbed(embed) {
    const resolver = resolverFor(embed.url);
    if (!resolver) return [];
    try {
        const found = await resolver.resolve(embed.url);
        return labeled(PROVIDER_NAME, embed.language, resolver.server, found);
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
    const postId = await findPost(meta.titles, meta.year, mediaType);
    if (!postId) return [];

    let target = postId;
    if (mediaType !== 'movie') {
        const list = await episodes(postId, season).catch(() => []);
        target = pickEpisode(list, season, episode);
        if (!target) return [];
    }

    const embeds = (await playerEmbeds(target)).filter((embed) => resolverFor(embed.url));
    return resolveFirstLanguage(groupByLanguage(embeds, LANGUAGE_ORDER), 0, resolveEmbed);
}

export const _test = {
    search,
    episodes,
    pickEpisode,
    playerEmbeds,
    normalizeLanguage,
    findPost,
    resolverFor,
    groupByLanguage: (embeds) => groupByLanguage(embeds, LANGUAGE_ORDER)
};
