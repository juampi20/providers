/**
 * SeriesMetro — www3.seriesmetro.net, DooPlay.
 *
 * La ficha no trae el player: trae opciones numeradas (`#options-N`) y un `?trembed=&trid=&trtype=` que hay
 * que pedir para obtener el iframe. Todo lo que sirve es Fastream.
 */

import { BROWSER_UA, fetchBrowserText } from '../_utils/http.js';
import { titlesFor, bestTitleMatch, slugVariants } from '../_utils/matcher.js';
import { resolverFor } from '../_utils/resolvers.js';
import { inferQuality } from '../_utils/quality.js';
import { labeled, groupByLanguage, resolveFirstLanguage } from '../_utils/labels.js';

export const PROVIDER_NAME = 'SeriesMetro';

const HOST = 'https://www3.seriesmetro.net';
const LANGUAGE_ORDER = ['Latino', 'Español', 'Subtitulado'];

const LANGUAGES = { latino: 'Latino', lat: 'Latino', castellano: 'Español', 'español': 'Español', esp: 'Español', vose: 'Subtitulado', sub: 'Subtitulado', subtitulado: 'Subtitulado' };

/** @param {string} text */
export function normalizeLanguage(text) {
    const last = String(text || '').replace(/<[^>]*>/g, '').trim().split('-').pop().trim().toLowerCase();
    return LANGUAGES[last] || 'Latino';
}

/** Película: `/pelicula/<slug>/`. Serie: `/serie/<slug>/`. */
export function sectionUrl(slug, mediaType) {
    return HOST + '/' + (mediaType === 'movie' ? 'pelicula' : 'serie') + '/' + slug + '/';
}

/**
 * Busca la ficha probando los slugs de los títulos cosechados. El sitio responde 200 incluso cuando no
 * existe, así que la señal es que el cuerpo traiga opciones de player.
 * @param {string[]} titles
 */
export async function findPage(titles, mediaType) {
    for (const slug of slugVariants(titles, 4)) {
        const url = sectionUrl(slug, mediaType);
        const html = await fetchBrowserText(url, HOST + '/').catch(() => null);
        if (!html) continue;
        if (html.indexOf('trembed=') >= 0 || html.indexOf('data-post=') >= 0) return { url, html };
    }
    return null;
}

/** @param {string} html */
export function dataPost(html) {
    const m = /data-post="(\d+)"/.exec(html);
    return m ? m[1] : null;
}

/**
 * El episodio se pide por AJAX por temporada y se busca en la lista devuelta: la URL no se puede construir
 * porque el slug del capítulo no sigue el de la serie.
 * @param {string} seriesUrl
 */
export async function episodeUrl(seriesUrl, postId, season, episode) {
    const response = await fetch(HOST + '/wp-admin/admin-ajax.php', {
        method: 'POST',
        headers: { 'User-Agent': BROWSER_UA, 'Content-Type': 'application/x-www-form-urlencoded', Referer: seriesUrl },
        body: 'action=action_select_season&post=' + postId + '&season=' + parseInt(season, 10)
    });
    if (!response.ok) return null;
    const html = await response.text();
    const hrefs = [...html.matchAll(/href="([^"]+\/capitulo\/[^"]+)"/g)].map((m) => m[1]);
    const hit = hrefs.filter((href) => {
        const m = /temporada-(\d+)-capitulo-(\d+)/i.exec(href);
        return m && parseInt(m[1], 10) === parseInt(season, 10) && parseInt(m[2], 10) === parseInt(episode, 10);
    });
    if (!hit.length) return null;
    return hit[0].indexOf('http') === 0 ? hit[0] : HOST + hit[0];
}

/**
 * Opciones de la ficha: `{ nume, language }`, con `trid`/`trtype` que son de la página, no de cada opción.
 * @param {string} html
 */
export function playerOptions(html) {
    const params = /\?trembed=(\d+)(?:&#038;|&)trid=(\d+)(?:&#038;|&)trtype=(\d+)/.exec(html);
    if (!params) return [];
    const servers = [...html.matchAll(/href="#options-(\d+)"[^>]*>[\s\S]*?<span class="server">([\s\S]*?)<\/span>/g)];
    return servers.map((m) => ({ nume: m[1], language: normalizeLanguage(m[2]), trid: params[2], trtype: params[3] }));
}

/** El iframe de Fastream que devuelve `?trembed=`. */
export async function optionEmbed(option, pageUrl) {
    const url = HOST + '/?trembed=' + option.nume + '&trid=' + option.trid + '&trtype=' + option.trtype;
    const html = await fetchBrowserText(url, pageUrl).catch(() => null);
    if (!html) return null;
    const m = /<iframe[^>]*src="(https?:\/\/fastream\.to\/[^"]+)"/i.exec(html);
    return m ? m[1] : null;
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

/**
 * @param {string} tmdbId
 * @param {string} mediaType
 * @param {number} season
 * @param {number} episode
 */
export async function extractStreams(tmdbId, mediaType, season, episode) {
    const meta = await titlesFor(tmdbId, mediaType);
    const page = await findPage(meta.titles, mediaType);
    if (!page) return [];
    if (!bestTitleMatch(meta.titles, '', [pageCandidate(page.html)], {})) return [];

    let target = page;
    if (mediaType !== 'movie') {
        const postId = dataPost(page.html);
        if (!postId) return [];
        const url = await episodeUrl(page.url, postId, season, episode);
        if (!url) return [];
        const html = await fetchBrowserText(url, page.url).catch(() => null);
        if (!html) return [];
        target = { url, html };
    }

    const embeds = [];
    for (const option of playerOptions(target.html)) {
        const embedUrl = await optionEmbed(option, target.url).catch(() => null);
        if (embedUrl) embeds.push({ url: embedUrl, language: option.language });
    }

    const usable = embeds.filter((embed) => resolverFor(embed.url));
    return resolveFirstLanguage(groupByLanguage(usable, LANGUAGE_ORDER), 0, resolveEmbed);
}

function pageCandidate(html) {
    const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
    return { title: (h1 ? h1[1] : '').replace(/<[^>]*>/g, '').replace(/\s*\(\d{4}\)\s*/, ' ').replace(/\s+/g, ' ').trim(), year: null };
}

export const _test = {
    sectionUrl,
    findPage,
    dataPost,
    episodeUrl,
    playerOptions,
    optionEmbed,
    normalizeLanguage,
    resolverFor,
    groupByLanguage: (embeds) => groupByLanguage(embeds, LANGUAGE_ORDER)
};
