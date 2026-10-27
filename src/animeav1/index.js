/**
 * AnimeAV1 — provider entry point called by Nuvio.
 */

import { extractStreams, _test } from './extractor.js';
import { applyContext } from '../_utils/labels.js';
import log from './log.js';

/**
 * @param {string} tmdbId
 * @param {string} mediaType
 * @param {number} season
 * @param {number} episode
 */
export async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        log(mediaType === 'movie' ? `Request: ${mediaType} ${tmdbId}` : `Request: ${mediaType} ${tmdbId}: S${season}E${episode}`);
        const streams = await extractStreams(tmdbId, mediaType, season, episode);
        return applyContext(streams, { mediaType, season, episode });
    } catch (error) {
        log('warn', error.message);
        return [];
    }
}

export const _testAll = _test;

export { _testAll as _test };
