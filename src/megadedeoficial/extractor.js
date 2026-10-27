/**
 * MegaDede — megadede.mobi, one of the sites running the embed69 engine.
 *
 * Addresses titles by IMDb id (`/vidurl/<imdb>/`), so the only job here is TMDB → IMDb → the PoW page →
 * the shared resolvers. It carries no language metadata beyond the engine's LAT/ESP/SUB blocks.
 */

import { fetchPowEmbeds, POW_LANGUAGES, POW_LANGUAGE_ORDER } from '../_utils/pow.js';
import { imdbIdFor } from '../_utils/tmdb.js';
import { resolverFor } from '../_utils/resolvers.js';
import { inferQuality } from '../_utils/quality.js';
import { labeled, groupByLanguage, resolveFirstLanguage } from '../_utils/labels.js';

export const PROVIDER_NAME = 'MegaDede';

const HOST = 'https://megadede.mobi';

/**
 * Película: `/vidurl/<imdb>/`. Episodio: `/vidurl/<imdb>-<S>x<EE>/`, con el episodio a dos dígitos.
 * @param {string} imdbId
 */
export function vidurlPath(imdbId, mediaType, season, episode) {
    if (mediaType === 'movie') return '/vidurl/' + imdbId + '/';
    return '/vidurl/' + imdbId + '-' + season + 'x' + String(episode).padStart(2, '0') + '/';
}

async function resolveEmbed(embed) {
    const resolver = resolverFor(embed.url);
    if (!resolver) return [];
    try {
        const found = await resolver.resolve(embed.url);
        return labeled(PROVIDER_NAME, POW_LANGUAGES[embed.language] || embed.language, resolver.server, found);
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
    const imdbId = await imdbIdFor(tmdbId, mediaType);
    if (!imdbId) throw new Error('TMDB has no IMDb id for ' + mediaType + ' ' + tmdbId);

    const embeds = (await fetchPowEmbeds(HOST, vidurlPath(imdbId, mediaType, season, episode)))
        .filter((embed) => resolverFor(embed.url));
    return resolveFirstLanguage(groupByLanguage(embeds, POW_LANGUAGE_ORDER), 0, resolveEmbed);
}

export const _test = {
    vidurlPath,
    resolverFor,
    groupByLanguage: (embeds) => groupByLanguage(embeds, POW_LANGUAGE_ORDER)
};
