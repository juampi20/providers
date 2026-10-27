/**
 * Embed69 — the player sololatino.net embeds, addressed straight at embed69.org.
 *
 * Goes straight to embed69.org, since the site's own search sits behind Cloudflare. Resolves vidhide and
 * streamwish, which share the packed `var links` player.
 */

import { fetchBrowserText, fetchBrowserJson, BROWSER_UA } from '../_utils/http.js';
import { between, hostOf, vibuxerUrl } from '../_utils/packed.js';
import { resolverFor } from '../_utils/resolvers.js';
import { inferQuality } from '../_utils/quality.js';
import { labeled, groupByLanguage, resolveFirstLanguage } from '../_utils/labels.js';
import { tmdbApiKey } from '../_utils/tmdb.js';
import { parsePowPage, POW_LANGUAGES, POW_LANGUAGE_ORDER } from '../_utils/pow.js';

export const PROVIDER_NAME = 'Embed69';

// /video/ 302s to /f/ when the title is there, so it covers both layouts.
const EMBED_BASE = 'https://embed69.org/video/';
// Wikimedia answers 403 to browser-like User-Agents from non-browsers; it wants one naming the client.
const WIKIDATA_UA = 'nuvio-providers/1.0 (https://github.com/juampi20/providers)';
const LANGUAGES = POW_LANGUAGES;
const LANGUAGE_ORDER = POW_LANGUAGE_ORDER;
const SERVERS = { vidhide: 'Vidhide', streamwish: 'Streamwish' };

// Without a key, or when TMDB has no answer (e.g. a bad key), fall back to Wikidata, which needs no key.
export async function getImdbId(tmdbId, mediaType) {
    const key = tmdbApiKey();
    if (!key) return getImdbIdFromWikidata(tmdbId, mediaType);
    const path = mediaType === 'movie' ? '/movie/' + tmdbId : '/tv/' + tmdbId + '/external_ids';
    const data = await fetchBrowserJson('https://api.themoviedb.org/3' + path + '?api_key=' + encodeURIComponent(key));
    return (data && data.imdb_id) || getImdbIdFromWikidata(tmdbId, mediaType);
}

// P4947 / P4983 are Wikidata's TMDB movie / TV ids, P345 the IMDb id.
async function getImdbIdFromWikidata(tmdbId, mediaType) {
    const prop = mediaType === 'movie' ? 'P4947' : 'P4983';
    const query = 'SELECT ?imdb WHERE { ?item wdt:' + prop + ' "' + String(tmdbId).replace(/\D/g, '') + '"; wdt:P345 ?imdb } LIMIT 1';
    const response = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query), { headers: { 'User-Agent': WIKIDATA_UA } });
    const data = await response.json();
    const row = data && data.results && data.results.bindings[0];
    return row ? row.imdb.value : null;
}

export function embedId(imdbId, mediaType, season, episode) {
    if (mediaType === 'movie') return imdbId;
    return imdbId + '-' + season + 'x' + String(episode).padStart(2, '0');
}

/**
 * Returns [{ language, server, url }] from an embed69 page, or [] if the layout changed.
 */
export function parseEmbedPage(html) {
    return parsePowPage(html);
}

/**
 * Titles missing from /f/ (e.g. The 100) only exist on embed69's /video/ page, a plain list of
 * playServerVast('<url>') entries, each tagged with a data-lang index into the language tabs.
 */
export function parseVideoPage(html) {
    const languages = {};
    html.replace(/<li class="SLD_[A-Z]" data-lang="(\d+)">\s*<img src="[^"]*\/lang\/([A-Z]+)\.png/g, (m, index, lang) => {
        languages[index] = lang;
    });
    const result = [];
    html.replace(/playServerVast\('([^']+)'\);" data-lang="(\d+)"/g, (m, url, index) => {
        const host = hostOf(url);
        const server = host.indexOf('vidhide') >= 0 ? 'vidhide' : /streamwish|hglink/.test(host) ? 'streamwish' : host;
        result.push({ language: languages[index] || 'LAT', server, url });
    });
    return result;
}

export function parsePage(html) {
    return parseEmbedPage(html).concat(parseVideoPage(html));
}

/** streamwish mirrors go through vibuxer.com, which serves the same packed player as vidhide. */
export function playableEmbed(embed) {
    if (embed.server === 'vidhide') return embed.url;
    if (embed.server === 'streamwish') return vibuxerUrl(embed.url);
    return null;
}

async function resolveEmbed(embed) {
    const embedUrl = playableEmbed(embed);
    const resolver = resolverFor(embedUrl);
    if (!resolver) return [];
    try {
        const found = await resolver.resolve(embedUrl);
        return labeled(PROVIDER_NAME, LANGUAGES[embed.language] || embed.language, resolver.server, found);
    } catch (e) {
        return [];
    }
}

export async function extractStreams(tmdbId, mediaType, season, episode) {
    const imdbId = await getImdbId(tmdbId, mediaType);
    if (!imdbId) throw new Error('No IMDB id for TMDB ' + tmdbId);

    const html = await fetchBrowserText(EMBED_BASE + embedId(imdbId, mediaType, season, episode), 'https://sololatino.net/');
    const embeds = parsePage(html).filter((embed) => playableEmbed(embed));
    return resolveFirstLanguage(groupByLanguage(embeds, LANGUAGE_ORDER), 0, resolveEmbed);
}

/** Extracted links for a player URL, as plain strings (used by the live script). */
export async function extractHls(url) {
    const found = await resolveVidhide(url);
    return found.map((stream) => stream.url);
}

export const _test = {
    getImdbId,
    parseEmbedPage,
    parseVideoPage,
    parsePage,
    embedId,
    playableEmbed,
    extractHls,
    groupByLanguage: (embeds) => groupByLanguage(embeds, LANGUAGE_ORDER)
};
