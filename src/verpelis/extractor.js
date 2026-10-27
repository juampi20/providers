/**
 * VerPelis — verpelis.gratis, DooPlay.
 *
 * Se busca por texto (`/?s=`), la ficha trae `.dooplay_player_option` y el embed sale por la ruta
 * `wp-json/dooplayer/v2/<post>/<type>/<nume>` (con «r»: la ruta `dooplay` no existe acá). El idioma no está
 * en un campo: se deduce del ícono del panel (`lat.png`, `es.png`, `sub.png`).
 */

import { BROWSER_UA, fetchBrowserText, fetchBrowserJson } from '../_utils/http.js';
import { titlesFor, bestTitleMatch } from '../_utils/matcher.js';
import { resolverFor } from '../_utils/resolvers.js';
import { inferQuality } from '../_utils/quality.js';
import { labeled, groupByLanguage, resolveFirstLanguage } from '../_utils/labels.js';

export const PROVIDER_NAME = 'VerPelis';

const HOST = 'https://verpelis.gratis';
const LANGUAGE_ORDER = ['Latino', 'Español', 'Subtitulado'];

/** El idioma se deduce del nombre de la imagen del panel. */
export function normalizeLanguage(text) {
    const t = String(text || '').toLowerCase();
    if (/cas|castellano|espa|es\.png/.test(t)) return 'Español';
    if (/sub|vose/.test(t)) return 'Subtitulado';
    return 'Latino';
}

/**
 * Resultados de búsqueda: `{ url, title, kind }`.
 */
export async function search(query) {
    const html = await fetchBrowserText(HOST + '/?s=' + encodeURIComponent(query), HOST + '/');
    const found = [];
    const pattern = /<article[^>]*>[\s\S]*?<a href="([^"]+)"[\s\S]*?(?:alt="([^"]*)"|<h2 class="entry-title">([^<]+)<\/h2>)/g;
    let m;
    while ((m = pattern.exec(html))) {
        const url = m[1];
        if (url.indexOf(HOST) !== 0) continue;
        const title = (m[2] || m[3] || '').trim();
        if (!title || found.some((entry) => entry.url === url)) continue;
        found.push({ url, title, kind: url.indexOf('/series/') >= 0 || url.indexOf('/serie') >= 0 ? 'tv' : 'movie' });
    }
    return found;
}

/** Opciones del player: `{ post, nume, type, language }`. */
export function playerOptions(html) {
    const options = [];
    const pattern = /<li[^>]*class=['"][^'"]*dooplay_player_option[^'"]*['"][^>]*>([\s\S]*?)<\/li>/g;
    let m;
    while ((m = pattern.exec(html))) {
        const block = m[0];
        const post = /data-post=['"](\d+)['"]/.exec(block);
        const nume = /data-nume=['"]([^'"]+)['"]/.exec(block);
        const type = /data-type=['"]([^'"]+)['"]/.exec(block);
        if (!post || !nume || !type) continue;
        if (String(nume[1]).toLowerCase().indexOf('trailer') >= 0) continue;
        options.push({ post: post[1], nume: nume[1], type: type[1], language: normalizeLanguage(block) });
    }
    return options;
}

/** El embed sale por `dooplayer` (con «r»), con el `Referer` de la página. */
export async function ajaxEmbed(option, pageUrl) {
    const url = HOST + '/wp-json/dooplayer/v2/' + option.post + '/' + option.type + '/' + option.nume;
    const body = await fetchBrowserJson(url, { Accept: 'application/json, text/plain, */*', Referer: pageUrl }).catch(() => null);
    if (!body || !body.embed_url) return null;
    const raw = String(body.embed_url);
    const src = /<iframe[^>]+src="([^"]+)"/i.exec(raw);
    const embed = src ? src[1] : raw;
    if (!/^https?:\/\//.test(embed)) return null;
    return embed;
}

/**
 * Episodio dentro de la página de la serie: bloque de la temporada pedida y `<a>` cuyo `numerando`
 * corresponde al capítulo.
 */
export function episodeLink(html, season, episode) {
    const block = new RegExp("class=['\"]se-t.*?['\"]>" + parseInt(season, 10) + '</span>([\\s\\S]*?)(?:</ul>|$)', 'i').exec(html);
    if (!block) return null;
    const pattern = /<div class=['"]numerando['"]>([^<]+)<\/div>[\s\S]*?<a href=['"]([^'"]+)['"]/g;
    let m;
    while ((m = pattern.exec(block[1]))) {
        const label = m[1].trim();
        if (new RegExp('(?:^|[-x\\s])' + parseInt(episode, 10) + '$').test(label)) {
            return m[2].indexOf('http') === 0 ? m[2] : HOST + m[2];
        }
    }
    return null;
}

async function resolveEmbed(embed) {
    const resolver = resolverFor(embed.url);
    if (!resolver) return [];
    try {
        const found = await resolver.resolve(embed.url);
        return labeled(PROVIDER_NAME, embed.language, resolver.server, found);
    } catch (e) {
        return [];
    }
}

export async function extractStreams(tmdbId, mediaType, season, episode) {
    const meta = await titlesFor(tmdbId, mediaType);

    let candidates = [];
    for (const title of meta.titles.slice(0, 3)) {
        candidates = (await search(title).catch(() => [])).filter((entry) => entry.kind === (mediaType === 'movie' ? 'movie' : 'tv'));
        if (candidates.length) break;
    }
    const match = bestTitleMatch(meta.titles, meta.year, candidates, {});
    if (!match) return [];

    let pageUrl = match.url;
    let html = await fetchBrowserText(pageUrl, HOST + '/').catch(() => null);
    if (!html) return [];

    if (mediaType !== 'movie') {
        const url = episodeLink(html, season, episode);
        if (!url) return [];
        pageUrl = url;
        html = await fetchBrowserText(pageUrl, match.url).catch(() => null);
        if (!html) return [];
    }

    const embeds = [];
    for (const option of playerOptions(html)) {
        const embedUrl = await ajaxEmbed(option, pageUrl).catch(() => null);
        if (embedUrl) embeds.push({ url: embedUrl, language: option.language });
    }

    const usable = embeds.filter((embed) => resolverFor(embed.url));
    return resolveFirstLanguage(groupByLanguage(usable, LANGUAGE_ORDER), 0, resolveEmbed);
}

export const _test = {
    search,
    playerOptions,
    ajaxEmbed,
    episodeLink,
    normalizeLanguage,
    resolverFor,
    groupByLanguage: (embeds) => groupByLanguage(embeds, LANGUAGE_ORDER)
};
