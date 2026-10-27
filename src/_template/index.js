import { extractStreams } from './extractor.js';
import log from './log.js';

export async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        if (mediaType === 'movie') {
            log(`Request: ${mediaType} ${tmdbId}`);
        } else {
            log(`Request: ${mediaType} ${tmdbId}: S${season}E${episode}`);
        }

        const streams = await extractStreams(tmdbId, mediaType, season, episode);

        return streams;
    } catch (error) {
        log('error', `Unexpected error: ${error.message}`);
        return [];
    }
}

module.exports = { getStreams };
