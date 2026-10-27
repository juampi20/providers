import { extractStreams, _test } from './extractor.js';
import { applyContext } from '../_utils/labels.js';
import { unpack, playableLinks } from '../_utils/packed.js';
import { tmdbSettings } from '../_utils/tmdb.js';
import log from './log.js';

export function onSettings() {
    return tmdbSettings('Optional. Needed on Nuvio builds that do not share their TMDB key with plugins; without it, titles missing from Wikidata are not found.');
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

export const _testAll = Object.assign({ onSettings, unpack, playableLinks }, _test);

export { _testAll as _test };
