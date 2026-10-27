/**
 * Cinemitas — cinemitas.org, WordPress con DooPlay.
 *
 * La ficha no trae iframes: trae un `<li class="dooplay_player_option">` por servidor y una llamada AJAX
 * (`admin-ajax.php`) que devuelve el embed. El idioma viaja en el texto del `<li>`; los embeds reales son
 * vimeos, uqload y, en series, un índice de vimeus.
 */

import { BROWSER_UA, fetchBrowserText } from '../_utils/http.js';
import { titlesFor, bestTitleMatch, slugVariants } from '../_utils/matcher.js';
import { resolverFor } from '../_utils/resolvers.js';
import { inferQuality } from '../_utils/quality.js';
import { labeled, groupByLanguage, resolveFirstLanguage } from '../_utils/labels.js';

export const PROVIDER_NAME = 'Cinemitas';

const HOST = 'https://cinemitas.org';
const LANGUAGE_ORDER = ['Latino', 'Español', 'Subtitulado'];

const LANGUAGES = {
    'latino hd': 'Latino',
    'latino': 'Latino',
    'castellano': 'Español',
    'español': 'Español',
    'subtitulado': 'Subtitulado'
};

export function normalizeLanguage(text) {
    const key = String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
    return LANGUAGES[key] || LANGUAGES[key.split(' ')[0]] || 'Latino';
}

/**
 * Pide una página y devuelve también la URL final: el sitio redirige slugs viejos y el episodio se arma con
 * el slug canónico, no con el que probamos.
 */
async function fetchPage(url) {
    const response = await fetch(url, { headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html', 'Accept-Language': 'es-MX,es;q=0.9' }, redirect: 'follow' });
    return { ok: response.ok, status: response.status, url: response.url, html: await response.text() };
}

/** Película: `/movies/<slug>/`. Serie: `/tvshows/<slug>/`. */
export function sectionUrl(slug, mediaType) {
    return HOST + (mediaType === 'movie' ? '/movies/' : '/tvshows/') + slug + '/';
}

/** Episodio: `/episodes/<slug>-<S>x<E>/`, sin relleno de ceros. */
export function episodeUrl(slug, season, episode) {
    return HOST + '/episodes/' + slug + '-' + parseInt(season, 10) + 'x' + parseInt(episode, 10) + '/';
}

/**
 * Opciones de servidor de una ficha: `{ post, nume, type, language }`.
 */
export function playerOptions(html) {
    const options = [];
    // El sitio emite los atributos con comillas simples, también el class.
    const pattern = /<li[^>]*class=['"][^'"]*dooplay_player_option[^'"]*['"][^>]*>([\s\S]*?)<\/li>/g;
    let match;
    while ((match = pattern.exec(html))) {
        const block = match[0];
        // El sitio emite los atributos con comillas simples.
        const post = /data-post=['"](\d+)['"]/.exec(block);
        const nume = /data-nume=['"]([^'"]+)['"]/.exec(block);
        const type = /data-type=['"]([^'"]+)['"]/.exec(block);
        if (!post || !nume || !type) continue;
        // El trailer es un embed de YouTube: no es una fuente.
        if (String(nume[1]).toLowerCase().indexOf('trailer') >= 0) continue;
        const label = block.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        options.push({ post: post[1], nume: nume[1], type: type[1], language: normalizeLanguage(label) });
    }
    return options;
}

/**
 * DooPlay resuelve el embed por AJAX y exige `Referer` (sin él Cloudflare contesta 406 en HTML, no JSON).
 */
export async function ajaxEmbed(option, pageUrl) {
    const response = await fetch(HOST + '/wp-admin/admin-ajax.php', {
        method: 'POST',
        headers: {
            'User-Agent': BROWSER_UA,
            'Content-Type': 'application/x-www-form-urlencoded',
            Referer: pageUrl
        },
        body: 'action=doo_player_ajax&post=' + option.post + '&nume=' + option.nume + '&type=' + option.type
    });
    if (!response.ok) return null;
    const body = await response.json().catch(() => null);
    if (!body || !body.embed_url) return null;
    const raw = String(body.embed_url);
    const src = /<iframe[^>]+src="([^"]+)"/i.exec(raw);
    const url = src ? src[1] : raw;
    return /^https?:\/\//.test(url) ? url : null;
}

/**
 * Busca la ficha probando los slugs que el sitio podría haber usado.
 */
export async function findPage(titles, year, mediaType) {
    const sections = [];
    for (const slug of slugVariants(titles, 3)) {
        sections.push(sectionUrl(slug, mediaType));
        if (year) sections.push(sectionUrl(slug + '-' + year, mediaType));
    }
    for (const url of sections) {
        const page = await fetchPage(url).catch(() => null);
        if (!page || !page.ok) continue;
        const match = bestTitleMatch(titles, year, [pageCandidate(page)], {});
        if (match) return page;
    }
    return null;
}

function pageCandidate(page) {
    const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(page.html);
    const text = (h1 ? h1[1] : '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    const year = /\((\d{4})\)/.exec(text);
    return { url: page.url, title: text.replace(/\s*\(\d{4}\)\s*/, '').trim(), year: year ? year[1] : null };
}

/**
 * La página de la serie lista los episodios, y su slug **no** coincide con el de la serie
 * (`breaking-badd` es la serie, `breaking-bad-1x1` el episodio), así que la URL sale de esa lista.
 */
export async function findEpisodeUrl(seriesUrl, season, episode) {
    const page = await fetchPage(seriesUrl).catch(() => null);
    if (!page) return null;
    const wanted = '-' + parseInt(season, 10) + 'x' + parseInt(episode, 10) + '/';
    const links = [...page.html.matchAll(/href=['"]([^'"]*\/episodes\/[^'"]+)['"]/g)].map((m) => m[1]);
    const hit = links.filter((href) => href.indexOf(wanted) >= 0).map((href) => (href.indexOf('http') === 0 ? href : HOST + href));
    return hit.length ? hit[0] : null;
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
    const page = await findPage(meta.titles, meta.year, mediaType);
    if (!page) return [];

    let target = page;
    if (mediaType !== 'movie') {
        const found = await findEpisodeUrl(page.url, season, episode);
        if (!found) return [];
        const fetched = await fetchPage(found).catch(() => null);
        if (!fetched || !fetched.ok) return [];
        target = fetched;
    }

    const options = playerOptions(target.html);
    const embeds = [];
    for (const option of options) {
        const url = await ajaxEmbed(option, target.url).catch(() => null);
        if (url) embeds.push({ url, language: option.language });
    }

    const usable = embeds.filter((embed) => resolverFor(embed.url));
    return resolveFirstLanguage(groupByLanguage(usable, LANGUAGE_ORDER), 0, resolveEmbed);
}

export const _test = {
    sectionUrl,
    episodeUrl,
    playerOptions,
    ajaxEmbed,
    findPage,
    findEpisodeUrl,
    normalizeLanguage,
    resolverFor,
    groupByLanguage: (embeds) => groupByLanguage(embeds, LANGUAGE_ORDER)
};
