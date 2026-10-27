/**
 * EntrePeliculasySeries — entrepeliculasyseries.nz, another site on the embed69 engine.
 *
 * Same flow as MegaDede: TMDB → IMDb → `/vidurl/<imdb>/` → PoW page → shared resolvers. The difference is
 * the episode spelling (season unpadded, episode two digits) and that its TLD rotates.
 */

import { fetchPowEmbeds, POW_LANGUAGES, POW_LANGUAGE_ORDER } from '../_utils/pow.js';
import { imdbIdFor } from '../_utils/tmdb.js';
import { resolverFor } from '../_utils/resolvers.js';
import { inferQuality } from '../_utils/quality.js';
import { labeled, groupByLanguage, resolveFirstLanguage } from '../_utils/labels.js';

export const PROVIDER_NAME = 'EntrePeliculasySeries';

const HOST = 'https://entrepeliculasyseries.nz';

/**
 * Película: `/vidurl/<imdb>/`. Episodio: `/vidurl/<imdb>-<S>x<EE>/` — temporada sin cero a la izquierda,
 * episodio a dos dígitos; `2x5` y `01x01` responden 200 con un cuerpo vacío, así que el formato importa.
 * @param {string} imdbId
 */
export function vidurlPath(imdbId, mediaType, season, episode) {
    if (mediaType === 'movie') return '/vidurl/' + imdbId + '/';
    return '/vidurl/' + imdbId + '-' + parseInt(season, 10) + 'x' + String(episode).padStart(2, '0') + '/';
}

async function resolveEmbed(embed) {
    const resolver = resolverFor(embed.url);
    if (!resolver) return [];
    try {
        const found = await resolver.resolve(embed.url);
        found.forEach((stream) => { stream.quality = inferQuality(stream.url, resolver.key); });
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
