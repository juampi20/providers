/**
 * CineCalidad — cinecalidad.vg movie pages.
 *
 * The movie page carries each player as a base64 `data-src`, so one request per candidate slug is all the
 * scraping there is. Vimeos and StreamWish resolve; VOE is skipped.
 */

import { fetchBrowserText, BROWSER_UA } from '../_utils/http.js';
import { resolverFor, resolveVimeos, resolveStreamWish } from '../_utils/resolvers.js';
import { playableLinks, vibuxerUrl, unpack } from '../_utils/packed.js';
import { inferQuality } from '../_utils/quality.js';
import { labeled } from '../_utils/labels.js';
import { titlesFor, bestTitleMatch, buildSlug, slugVariants, splitTitleYear } from '../_utils/matcher.js';

export const PROVIDER_NAME = 'CineCalidad';

const BASE = 'https://www.cinecalidad.vg';
// The site has no language metadata; it is a Latino catalogue, so every stream is labelled Latino.
const LANGUAGE = 'Latino';
const SERVERS = { vimeos: 'Vimeos', streamwish: 'Streamwish' };
// Slugs are guessed from the title, so the site's own numbering (-2, -3, …) has to be tried too.
const SLUG_VARIANTS = ['', '-2', '-3'];

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Decoded by hand: Hermes on FireTV has no Buffer, and atob is not guaranteed either.
 */
export function decodeBase64(text) {
    let out = '';
    let buffer = 0;
    let bits = 0;
    for (let i = 0; i < text.length; i++) {
        const value = BASE64.indexOf(text.charAt(i));
        if (value < 0) continue;
        buffer = (buffer << 6) | value;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            out += String.fromCharCode((buffer >> bits) & 0xff);
        }
    }
    return out;
}

export function getTitles(tmdbId) {
    return titlesFor(tmdbId, 'movie');
}

export function movieUrl(slug) {
    return BASE + '/pelicula/' + slug + '/';
}

/**
 * The page's `<h1>` carries the title and its release year; that header is what the matcher scores.
 */
export function pageTitle(html) {
    const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
    return h1 ? splitTitleYear(h1[1].replace(/<[^>]*>/g, '')) : { title: '', year: null };
}

export function pageYear(html) {
    return pageTitle(html).year;
}

export function embedUrls(html) {
    const found = [];
    const re = /data-src="([A-Za-z0-9+/=]{20,})"/g;
    let m;
    while ((m = re.exec(html))) {
        const url = decodeBase64(m[1]);
        if (/^https?:\/\//.test(url) && found.indexOf(url) < 0) found.push(url);
    }
    return found;
}

/**
 * Tries every slug candidate at once and keeps the page the matcher picks: a page whose title or year does
 * not agree is dropped instead of used, because another movie's streams are worse than none.
 */
export async function findMoviePage(titleList, year) {
    const candidates = [];
    slugVariants(titleList, 3).forEach((slug) => {
        SLUG_VARIANTS.forEach((variant) => candidates.push(slug + variant));
    });

    const pages = await Promise.all(candidates.map((slug) => fetchBrowserText(movieUrl(slug), BASE + '/')
        .then((html) => {
            const head = pageTitle(html);
            return { html, title: head.title, year: head.year };
        })
        .catch(() => null)));

    const usable = pages.filter((page) => page && embedUrls(page.html).length);
    const match = bestTitleMatch(titleList, year, usable, {});
    return match ? match.html : null;
}

async function streamsFrom(embedUrl) {
    const resolver = resolverFor(embedUrl);
    if (!resolver) return [];
    try {
        const found = await resolver.resolve(embedUrl);
        return labeled(PROVIDER_NAME, LANGUAGE, SERVERS[resolver.server], found);
    } catch (e) {
        return [];
    }
}

export async function extractStreams(tmdbId, mediaType) {
    if (mediaType !== 'movie') return [];
    const meta = await getTitles(tmdbId);
    const html = await findMoviePage(meta.titles, meta.year);
    if (!html) return [];

    const lists = await Promise.all(embedUrls(html).filter(resolverFor).map(streamsFrom));
    return lists.reduce((all, list) => all.concat(list), []);
}

export const _test = {
    getTitles,
    buildSlug,
    movieUrl,
    pageYear,
    pageTitle,
    embedUrls,
    findMoviePage,
    decodeBase64,
    unpack,
    inferQuality,
    resolveVimeos,
    resolveStreamWish,
    resolverFor,
    playableLinks,
    vibuxerUrl,
    BROWSER_UA
};
