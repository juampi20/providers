/**
 * Provider entry point called by Nuvio.
 */

import { extractStreams, _test } from './extractor.js';
import { applyContext } from '../_utils/labels.js';
import { tmdbSettings } from '../_utils/tmdb.js';
import log from './log.js';

export function onSettings() {
    return tmdbSettings('Required. The site is addressed by the IMDb id, which this provider reads from TMDB.');
}

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

export const _testAll = Object.assign({ onSettings }, _test);

export { _testAll as _test };
