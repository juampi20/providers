/**
 * HTTP Utilities
 * Use this file for network requests and headers.
 */

export const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Headers a scraping site expects from a browser; the referer is the page the request belongs to.
 * @param {string} [referer]
 */
export function browserHeaders(referer) {
    const headers = { 'User-Agent': BROWSER_UA };
    if (referer) headers.Referer = referer;
    return headers;
}

/**
 * Fetch text content from a URL
 * @param {string} provider
 * @param {string} url
 * @param {object} headers
 * @param {object} options
 */
export async function fetchText(provider, url, headers, options = {}) {
    console.log(`[${provider}] Fetching: ${url}`);

    const response = await fetch(url, {
        headers: {
            ...headers,
            ...options.headers
        },
        ...options
    });

    if (!response.ok) {
        throw new Error(`HTTP error ${response.status} for ${url}`);
    }

    return await response.text();
}

/**
 * Fetch JSON content from a URL
 * @param {string} provider
 * @param {string} url
 * @param {object} headers
 * @param {object} options
 */
export async function fetchJson(provider, url, headers, options = {}) {
    const raw = await fetchText(provider, url, headers, options);
    return JSON.parse(raw);
}

/**
 * Fetch a page the way the site expects it: browser `User-Agent`, plus the page it was linked from.
 * @param {string} url
 * @param {string} [referer]
 */
export async function fetchBrowserText(url, referer) {
    const response = await fetch(url, { headers: browserHeaders(referer) });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return response.text();
}

/**
 * Fetch JSON with an optional header bag (TMDB needs nothing, site APIs want Referer/Origin).
 * @param {string} url
 * @param {object} [headers]
 */
export async function fetchBrowserJson(url, headers) {
    const response = await fetch(url, { headers: { ...browserHeaders(), Accept: 'application/json', ...headers } });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return response.json();
}
