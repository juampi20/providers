/**
 * HackStore — hackstore2.com's REST API.
 *
 * The site hands over the player list as JSON, so only the players themselves are parsed. Vimeos and
 * StreamWish resolve; VOE is skipped.
 */

import { fetchBrowserJson } from '../_utils/http.js';
import { resolveVimeos, resolveStreamWish, playableLinks, vibuxerUrl } from '../_utils/packed.js';
import { inferQuality } from '../_utils/quality.js';
import { labeled, groupByLanguage, resolveFirstLanguage } from '../_utils/labels.js';
import { titlesFor, bestTitleMatch, buildSlug, slugVariants, splitTitleYear } from '../_utils/matcher.js';

export const PROVIDER_NAME = 'HackStore';

const BASE = 'https://hackstore2.com';
const API = BASE + '/api/rest';
const LANGUAGE_ORDER = ['Latino', 'Español', 'Subtitulado'];
// Spellings the site uses for Castilian.
const LANGUAGE_ALIASES = { 'Castellano': 'Español', 'Latinoamericano': 'Latino' };
const SERVERS = { vimeos: 'Vimeos', streamwish: 'Streamwish' };

/**
 * Movies answer in data._id; episodes answer one level deeper, in data.episode._id. The title comes back
 * too, and it is what decides whether the slug found the right thing.
 * @param {string} slug
 * @param {'movies'|'episodes'} postType
 */
export async function findPostId(slug, postType) {
    const body = await fetchBrowserJson(
        API + '/single?post_name=' + encodeURIComponent(slug) + '&post_type=' + postType,
        { Referer: BASE + '/', Origin: BASE }
    );
    const data = body && body.data;
    if (!data) return null;
    const entry = data._id ? data : (data.episode || null);
    if (!entry || !entry._id) return null;
    return { id: entry._id, title: String(entry.title || '') };
}

/** @param {string} title */
export function episodeSlug(title, season, episode) {
    return buildSlug(title) + '-temporada-' + parseInt(season, 10) + '-episodio-' + parseInt(episode, 10);
}

/**
 * Every harvested title is tried as a slug at once, and the post is accepted only when the title the API
 * returns matches: a colliding slug would otherwise serve another movie.
 * @param {string[]} titles
 * @param {string} year
 * @param {'movies'|'episodes'} postType
 */
export async function findPost(titles, year, postType, season, episode) {
    const slugs = slugVariants(titles, 3).map((slug) => {
        if (postType === 'movies') return slug + '-' + year;
        return slug + '-temporada-' + parseInt(season, 10) + '-episodio-' + parseInt(episode, 10);
    });

    const found = await Promise.all(slugs.map((slug) => findPostId(slug, postType).catch(() => null)));
    const candidates = found.filter((entry) => entry).map((entry) => {
        const head = splitTitleYear(entry.title);
        return { id: entry.id, title: head.title, year: head.year };
    });

    const match = bestTitleMatch(titles, postType === 'movies' ? year : '', candidates, { season });
    return match ? match.id : null;
}

function normalizeLanguage(lang) {
    const name = String(lang || 'Latino').trim();
    return LANGUAGE_ALIASES[name] || name || 'Latino';
}

/**
 * The player endpoint answers [{ url, lang, quality }] — no HTML to scrape here.
 * @param {number} postId
 */
export async function fetchEmbeds(postId) {
    const body = await fetchBrowserJson(API + '/player?post_id=' + postId, { Referer: BASE + '/', Origin: BASE });
    return ((body && body.data) || [])
        .filter((embed) => embed && typeof embed.url === 'string' && /^https?:\/\//.test(embed.url))
        .map((embed) => ({ url: embed.url, language: normalizeLanguage(embed.lang) }));
}

/** @param {string} embedUrl */
export function resolverFor(embedUrl) {
    const host = embedUrl.split('/')[2] || '';
    if (host.indexOf('vimeos') >= 0) return { server: 'vimeos', resolve: resolveVimeos };
    if (/streamwish|hlswish|hglink|strwish/.test(host)) return { server: 'streamwish', resolve: resolveStreamWish };
    return null;
}

async function resolveEmbed(embed) {
    const resolver = resolverFor(embed.url);
    if (!resolver) return [];
    try {
        const found = await resolver.resolve(embed.url);
        found.forEach((stream) => { stream.quality = inferQuality(stream.url, resolver.server); });
        return labeled(PROVIDER_NAME, embed.language, SERVERS[resolver.server], found);
    } catch (e) {
        return [];
    }
}

/**
 * @param {string} tmdbId
 * @param {string} mediaType
 * @param {number} season
 * @param {number} episode
 */
export async function extractStreams(tmdbId, mediaType, season, episode) {
    const meta = await titlesFor(tmdbId, mediaType);
    const postType = mediaType === 'movie' ? 'movies' : 'episodes';
    const postId = await findPost(meta.titles, meta.year, postType, season, episode);
    if (!postId) return [];

    const embeds = (await fetchEmbeds(postId)).filter((embed) => resolverFor(embed.url));
    return resolveFirstLanguage(groupByLanguage(embeds, LANGUAGE_ORDER), 0, resolveEmbed);
}

export const _test = {
    getTitles: titlesFor,
    buildSlug,
    episodeSlug,
    findPostId,
    findPost,
    fetchEmbeds,
    inferQuality,
    resolveVimeos,
    resolveStreamWish,
    resolverFor,
    playableLinks,
    vibuxerUrl,
    groupByLanguage: (embeds) => groupByLanguage(embeds, LANGUAGE_ORDER)
};
