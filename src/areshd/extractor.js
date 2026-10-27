/**
 * AresHD — areshd.com, Next.js con páginas SSR.
 *
 * Se busca por texto (`/search/<query>`), la ficha trae un `<li data-tr>` por servidor agrupado por idioma,
 * y cada uno apunta a `player.areshd.com/player.php?h=<token>`, que imprime el embed final en una línea
 * (`var url = '...'`). El nombre del servidor que muestra el sitio miente, así que el servidor real sale del
 * host del embed.
 */

import { fetchBrowserText } from '../_utils/http.js';
import { titlesFor, bestTitleMatch } from '../_utils/matcher.js';
import { resolverFor } from '../_utils/resolvers.js';
import { inferQuality } from '../_utils/quality.js';
import { labeled, groupByLanguage, resolveFirstLanguage } from '../_utils/labels.js';

export const PROVIDER_NAME = 'AresHD';

const HOST = 'https://areshd.com';
const LANGUAGE_ORDER = ['Latino', 'Español', 'Subtitulado'];

const LANGUAGES = { latino: 'Latino', castellano: 'Español', 'español': 'Español', subtitulado: 'Subtitulado', vose: 'Subtitulado' };

/** @param {string} text */
function slugToTitle(text) {
    return String(text || '').replace(/-/g, ' ').trim();
}

/**
 * Resultados de búsqueda: `{ slug, kind, title }`, con el título derivado del slug porque el `alt` de la
 * imagen no siempre está en el mismo orden.
 * @param {string} query
 */
export async function search(query, mediaType) {
    const kind = mediaType === 'movie' ? 'pelicula' : 'serie';
    const html = await fetchBrowserText(HOST + '/search/' + encodeURIComponent(query).replace(/%20/g, '+'));
    const pattern = new RegExp('href="/(' + kind + ')/' + '([^"/]+)"', 'g');
    const found = [];
    let m;
    while ((m = pattern.exec(html))) {
        const slug = m[2];
        if (found.some((entry) => entry.slug === slug)) continue;
        found.push({ slug, kind: m[1], title: slugToTitle(slug) });
    }
    return found;
}

/** Película: `/pelicula/<slug>`. Episodio: `/episodio/<slug>-temporada-<S>-episodio-<E>`. */
export function pageUrl(slug, mediaType, season, episode) {
    if (mediaType === 'movie') return HOST + '/pelicula/' + slug;
    return HOST + '/episodio/' + slug + '-temporada-' + parseInt(season, 10) + '-episodio-' + parseInt(episode, 10);
}

/**
 * Lee la ficha: una lista de idiomas y, por idioma, sus servidores con el `data-tr` del player.
 * @param {string} html
 */
export function parsePage(html) {
    const languages = [...html.matchAll(/<li class="pres"><a class="playr">([^<]+)<\/a><\/li>/g)]
        .map((m) => LANGUAGES[m[1].trim().toLowerCase()] || m[1].trim());

    const blocks = [...html.matchAll(/<ul class="TbVideoNv nav nav-tabs hide"[^>]*>([\s\S]*?)<\/ul>/g)].map((m) => m[1]);
    const embeds = [];
    blocks.forEach((block, index) => {
        const language = languages[index] || languages[0] || 'Latino';
        const servers = [...block.matchAll(/<li class="pres"[^>]*data-tr="([^"]+)"[^>]*>[\s\S]*?<a class="playr">([^<]+)<\/a>/g)];
        servers.forEach((server) => {
            const label = server[2].trim().toLowerCase();
            if (label.indexOf('youtube') >= 0) return;
            embeds.push({ language, label, playerUrl: server[1] });
        });
    });
    return embeds;
}

/** El player imprime el embed en una línea: `var url = '...'`. */
export async function playerEmbed(playerUrl, referer) {
    const html = await fetchBrowserText(playerUrl, referer);
    const m = /var\s+url\s*=\s*['"]([^'"]+)['"]/.exec(html) || /https?:\/\/[^"'\s]+\.(?:m3u8|mp4)[^"'\s]*/.exec(html);
    return m ? m[1] : null;
}

async function resolveEmbed(embed) {
    const resolver = resolverFor(embed.url);
    if (!resolver) return [];
    try {
        const found = await resolver.resolve(embed.url);
        found.forEach((stream) => { stream.quality = inferQuality(stream.url, resolver.key); });
        return labeled(PROVIDER_NAME, embed.language, resolver.server, found);
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

    let candidates = [];
    for (const title of meta.titles.slice(0, 3)) {
        candidates = candidates.concat(await search(title, mediaType).catch(() => []));
        if (candidates.length) break;
    }
    const match = bestTitleMatch(meta.titles, meta.year, candidates, {});
    if (!match) return [];

    const page = pageUrl(match.slug, mediaType, season, episode);
    const html = await fetchBrowserText(page, HOST + '/');
    const entries = parsePage(html);

    // El player se pide una vez por servidor; el embed final decide qué resolver lo atiende.
    const withEmbeds = [];
    for (const entry of entries) {
        const url = await playerEmbed(entry.playerUrl, page).catch(() => null);
        if (url) withEmbeds.push({ language: entry.language, url });
    }

    const usable = withEmbeds.filter((embed) => resolverFor(embed.url));
    return resolveFirstLanguage(groupByLanguage(usable, LANGUAGE_ORDER), 0, resolveEmbed);
}

export const _test = {
    search,
    pageUrl,
    parsePage,
    playerEmbed,
    resolverFor,
    groupByLanguage: (embeds) => groupByLanguage(embeds, LANGUAGE_ORDER)
};
