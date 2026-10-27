/**
 * CineCalidad — provider entry point called by Nuvio.
 */

import { extractStreams, _test } from './extractor.js';
import { tmdbSettings } from '../_utils/tmdb.js';
import log from './log.js';

export function onSettings() {
    return tmdbSettings('Required. The site is searched by a slug built from the Spanish title, so the title has to come from TMDB.');
}

/**
 * @param {string} tmdbId
 * @param {string} mediaType
 * @param {number} season
 * @param {number} episode
 */
export async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        log(mediaType === 'movie' ? `Request: ${mediaType} ${tmdbId}` : `Request: ${mediaType} ${tmdbId}: S${season}E${episode}`);
        return await extractStreams(tmdbId, mediaType, season, episode);
    } catch (error) {
        log('warn', error.message);
        return [];
    }
}

export const _testAll = Object.assign({ onSettings }, _test);

export { _testAll as _test };
