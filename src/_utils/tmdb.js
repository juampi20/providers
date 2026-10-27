/**
 * TMDB access shared by every provider: the key Nuvio injects (or the user saved), and the settings field
 * that lets them save one. Providers never declare `TMDB_API_KEY` themselves — a local declaration shadows
 * the injected global and silently disables it.
 */

import { fetchBrowserJson } from './http.js';

/**
 * The key saved in the plugin settings wins over the one Nuvio injects; older builds (e.g. desktop 1.1.21)
 * inject none.
 */
export function tmdbApiKey() {
    const saved = typeof SCRAPER_SETTINGS !== 'undefined' && SCRAPER_SETTINGS && SCRAPER_SETTINGS.tmdbApiKey;
    if (saved && String(saved).trim()) return String(saved).trim();
    return typeof TMDB_API_KEY !== 'undefined' && TMDB_API_KEY ? TMDB_API_KEY : null;
}

/**
 * The field Nuvio renders in the plugin settings and hands back in `SCRAPER_SETTINGS`.
 * @param {string} description
 */
export function tmdbSettings(description) {
    return [{
        type: 'text',
        key: 'tmdbApiKey',
        label: 'TMDB API key',
        description,
        placeholder: 'TMDB v3 API key',
        isPassword: true
    }];
}

/**
 * One TMDB endpoint as JSON.
 * @param {string} path e.g. `/movie/603?language=es-MX`
 * @param {string} key
 */
export function tmdbGet(path, key) {
    const separator = path.indexOf('?') >= 0 ? '&' : '?';
    return fetchBrowserJson('https://api.themoviedb.org/3' + path + separator + 'api_key=' + encodeURIComponent(key));
}

/**
 * The IMDb id for a TMDB id, which is what the embed69-family sites address titles by.
 * Returns null when TMDB has none (the key is bad, or the title is not on IMDb).
 * @param {string} tmdbId
 * @param {string} mediaType
 */
export async function imdbIdFor(tmdbId, mediaType) {
    const key = tmdbApiKey();
    if (!key) throw new Error('No TMDB API key: this provider resolves the IMDb id from TMDB');
    const path = mediaType === 'movie' ? '/movie/' + tmdbId : '/tv/' + tmdbId + '/external_ids';
    const data = await tmdbGet(path, key);
    return (data && data.imdb_id) || null;
}
