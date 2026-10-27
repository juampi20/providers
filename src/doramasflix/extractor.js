/**
 * DoramasFlix — doramasflix.in sobre la API GraphQL de seriesapi.co.
 *
 * Todo es POST GraphQL: buscar por nombre, resolver el `_id` del episodio por slug
 * (`<serie>-<S>x<E>`, sin relleno de ceros) y pedir los links. Cada link viene envuelto en
 * `embedshortener.co/e/<jwt>`, así que se desenvuelve antes de elegir el resolver.
 */

import { BROWSER_UA } from '../_utils/http.js';
import { titlesFor, bestTitleMatch } from '../_utils/matcher.js';
import { resolverFor, unwrapEmbedShortener } from '../_utils/resolvers.js';
import { inferQuality } from '../_utils/quality.js';
import { labeled, groupByLanguage, resolveFirstLanguage } from '../_utils/labels.js';

export const PROVIDER_NAME = 'DoramasFlix';

const SITE = 'https://doramasflix.in';
const API = 'https://user-api.seriesapi.co/graphql';
// Sin `app` la API devuelve un set de links distinto (o vacío).
const APP_ID = 'com.asiapp.doramasgo';
const LANGUAGE_ORDER = ['Latino', 'Español', 'Subtitulado'];

// La API entrega el idioma como código numérico.
const LANGUAGE_CODES = { 13111: 'Latino', 13109: 'Español', 13113: 'Subtitulado' };

const HEADERS = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': BROWSER_UA,
    Origin: SITE,
    Referer: SITE + '/'
};

async function gql(query, variables) {
    const response = await fetch(API, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ query, variables })
    });
    if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + API);
    const body = await response.json();
    if (body.errors && body.errors.length) throw new Error(body.errors[0].message || 'GraphQL error');
    return body.data || {};
}

export function search(query, mediaType) {
    // Películas y doramas exponen campos de fecha distintos: pedir el del otro tipo es un 400, no un vacío.
    const field = mediaType === 'movie' ? 'searchFullMovies' : 'searchFullDoramas';
    const operation = mediaType === 'movie' ? 'SearchFullMovies' : 'SearchFullDoramas';
    const dateField = mediaType === 'movie' ? 'release_date' : 'first_air_date';
    const doc = 'query ' + operation + '($input: String!) { ' + field + '(input: $input, perPage: 12) { items { _id slug name name_es original_name ' + dateField + ' } } }';
    return gql(doc, { input: query }).then((data) => (data[field] && data[field].items) || []);
}

export function episodeBySlug(slug) {
    const doc = 'query EpisodeDetailSlug($slug: String!) { detailEpisode(filter: { slug: $slug }) { _id slug episode_number season_number } }';
    return gql(doc, { slug }).then((data) => data.detailEpisode || null);
}

export function episodeLinks(episodeId) {
    const doc = 'query EpisodeLinksOnline($episode_id: ID!) { getEpisodeLinks(id: $episode_id, app: "' + APP_ID + '") { links_online { server lang link _id } } }';
    return gql(doc, { episode_id: episodeId }).then((data) => (data.getEpisodeLinks && data.getEpisodeLinks.links_online) || []);
}

export function movieLinks(movieId) {
    const doc = 'query MovieLinks($movie_id: ID!) { getMovieLinks(id: $movie_id, app: "' + APP_ID + '") { links_online { server lang link _id } } }';
    return gql(doc, { movie_id: movieId }).then((data) => (data.getMovieLinks && data.getMovieLinks.links_online) || []);
}

export function languageOf(code) {
    return LANGUAGE_CODES[parseInt(code, 10)] || 'Latino';
}

/**
 * Los `link` vienen como `https://embedshortener.co/e/<jwt>`; el embed real está adentro.
 */
export function unwrapLinks(links) {
    return links
        .map((link) => {
            const real = unwrapEmbedShortener(link.link) || link.link;
            return real && /^https?:\/\//.test(real) ? { url: real, language: languageOf(link.lang) } : null;
        })
        .filter(Boolean);
}

/**
 * El slug del episodio es `<serie>-<S>x<E>` sin ceros: `-1x01` no existe, `-1x1` sí.
 */
export function episodeSlug(seriesSlug, season, episode) {
    return seriesSlug + '-' + parseInt(season, 10) + 'x' + parseInt(episode, 10);
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

export async function extractStreams(tmdbId, mediaType, season, episode) {
    const meta = await titlesFor(tmdbId, mediaType);

    let candidates = [];
    for (const title of meta.titles.slice(0, 3)) {
        candidates = await search(title, mediaType).catch(() => []);
        if (candidates.length) break;
    }
    const match = bestTitleMatch(meta.titles, meta.year, candidates, {});
    if (!match) return [];

    let links = [];
    if (mediaType === 'movie') {
        links = await movieLinks(match._id).catch(() => []);
    } else {
        // La serie puede estar catalogada con otro slug: se prueban los del resultado y el propio.
        const slugs = [match.slug, String(match.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')].filter(Boolean);
        for (const slug of slugs) {
            const detail = await episodeBySlug(episodeSlug(slug, season, episode)).catch(() => null);
            if (detail && detail._id) {
                links = await episodeLinks(detail._id).catch(() => []);
                break;
            }
        }
    }

    const embeds = unwrapLinks(links).filter((embed) => resolverFor(embed.url));
    return resolveFirstLanguage(groupByLanguage(embeds, LANGUAGE_ORDER), 0, resolveEmbed);
}

export const _test = {
    search,
    episodeBySlug,
    episodeLinks,
    movieLinks,
    languageOf,
    unwrapLinks,
    episodeSlug,
    resolverFor,
    groupByLanguage: (embeds) => groupByLanguage(embeds, LANGUAGE_ORDER)
};
