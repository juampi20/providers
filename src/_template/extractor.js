import { fetchText } from '../_utils/http.js';
import { generateRandomUserAgent } from '../_utils/useragent';
import cheerio from 'cheerio-without-node-native';

export const PROVIDER_NAME = 'ProviderName';
const BASE_URL = 'https://example.com';

// const USER_AGENT = generateRandomUserAgent('windows', 'chrome');
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36';

const HEADERS = {
    'User-Agent':USER_AGENT,
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: BASE_URL,
    Origin: BASE_URL
};

export async function extractStreams(tmdbId, mediaType, season, episode) {

    // Ver src/embed69/ o src/vimeus/ para una implementación completa.

    return [];
}
