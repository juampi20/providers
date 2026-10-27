/**
 * AnimeAV1 — animeav1.com, SvelteKit.
 *
 * La página de cada episodio no es HTML: es un `__data.json` con el payload de devalue (un array plano con
 * índices), donde el bloque `embeds` viene por idioma (`SUB`/`DUB`). El servidor "HLS" apunta a
 * zilla-networks, que sirve la playlist con solo cambiar `/play/` por `/m3u8/`.
 */

import { BROWSER_UA } from '../_utils/http.js';
import { titlesFor } from '../_utils/matcher.js';
import { resolverFor } from '../_utils/resolvers.js';
import { inferQuality } from '../_utils/quality.js';
import { labeled, groupByLanguage, resolveFirstLanguage } from '../_utils/labels.js';

export const PROVIDER_NAME = 'AnimeAV1';

const HOST = 'https://animeav1.com';
const LANGUAGE_ORDER = ['Latino', 'Español', 'Subtitulado'];
const LANGUAGES = { SUB: 'Subtitulado', DUB: 'Latino' };
const HEADERS = { 'User-Agent': BROWSER_UA, Accept: 'text/html,application/json', 'Accept-Language': 'es-MX,es;q=0.9' };

/**
 * Resultados del catálogo: `{ slug, title, kind }`. El `href` del listado viene **después** del `<h3>`, así
 * que se parte por artículo en vez de buscar un orden fijo.
 * @param {string} query
 */
export async function search(query) {
    const response = await fetch(HOST + '/catalogo?search=' + encodeURIComponent(query), { headers: HEADERS });
    if (!response.ok) return [];
    const html = await response.text();
    return html.split('<article').slice(1).map((chunk) => {
        const title = /<h3[^>]*>([\s\S]*?)<\/h3>/i.exec(chunk);
        const href = /href="\/media\/([^"?#]+)"/.exec(chunk);
        if (!title || !href) return null;
        const kind = /TV Anime|Pel[ií]cula|Especial|OVA/i.exec(chunk);
        return {
            slug: href[1],
            title: title[1].replace(/<[^>]*>/g, '').trim(),
            kind: kind ? kind[0].toLowerCase() : ''
        };
    }).filter(Boolean);
}

/**
 * Payload de un episodio (o de la película, que va como episodio 1).
 * @param {string} slug
 * @param {number} number
 */
export async function payload(slug, number) {
    const response = await fetch(HOST + '/media/' + slug + '/' + parseInt(number, 10) + '/__data.json', { headers: HEADERS });
    if (!response.ok) return null;
    const body = await response.json().catch(() => null);
    const node = body && body.nodes && body.nodes[2];
    // Un episodio fuera de rango responde 200 con un nodo de error, no un 404.
    if (!node || node.type !== 'data' || !Array.isArray(node.data)) return null;
    return node.data;
}

/**
 * Camina los índices de devalue: `arr[0].embeds` → `{ SUB: i, DUB: i }`, `arr[i]` → lista de índices,
 * cada item `{ server, url }` con sus valores también indexados.
 * @param {Array} arr
 */
export function parseEmbeds(arr) {
    const schema = arr && arr[0];
    if (!schema || schema.embeds === undefined) return [];
    const byLanguage = arr[schema.embeds] || {};
    const embeds = [];
    Object.keys(byLanguage).forEach((code) => {
        const list = arr[byLanguage[code]];
        if (!Array.isArray(list)) return;
        list.forEach((itemIndex) => {
            const item = arr[itemIndex];
            if (!item || item.url === undefined) return;
            const url = arr[item.url];
            const server = arr[item.server];
            if (typeof url !== 'string' || !/^https?:\/\//.test(url) || url.indexOf('/undef') >= 0) return;
            embeds.push({ url, language: LANGUAGES[code] || 'Subtitulado', server: String(server || '') });
        });
    });
    return embeds;
}

/**
 * Las temporadas son slugs distintos (`…-2nd-season`) con episodios numerados desde 1, así que para una
 * temporada mayor a la primera se prefiere el candidato cuyo slug lo declare.
 * @param {Array} candidates
 */
export function seasonCandidates(candidates, season) {
    if (parseInt(season, 10) <= 1) return candidates;
    const ordinals = { 2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 6: '6th' };
    const wanted = ordinals[parseInt(season, 10)];
    const hit = candidates.filter((c) => {
        const m = /-(\d+)(?:st|nd|rd|th)-season/.exec(c.slug);
        return m && parseInt(m[1], 10) === parseInt(season, 10);
    });
    return hit.length ? hit : candidates.filter((c) => c.slug.indexOf(wanted || '-') >= 0);
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

    let candidates = [];
    for (const title of meta.titles.slice(0, 3)) {
        candidates = await search(title).catch(() => []);
        if (candidates.length) break;
    }
    if (!candidates.length) return [];

    // La película vive como episodio 1; la serie, en el episodio pedido.
    const number = mediaType === 'movie' ? 1 : parseInt(episode, 10);
    const pool = mediaType === 'movie' ? candidates : seasonCandidates(candidates, season);
    for (const candidate of pool.slice(0, 4)) {
        const arr = await payload(candidate.slug, number).catch(() => null);
        if (!arr) continue;
        const usable = parseEmbeds(arr).filter((embed) => resolverFor(embed.url));
        if (!usable.length) continue;
        const streams = await resolveFirstLanguage(groupByLanguage(usable, LANGUAGE_ORDER), 0, resolveEmbed);
        if (streams.length) return streams;
    }
    return [];
}

export const _test = {
    search,
    payload,
    parseEmbeds,
    seasonCandidates,
    resolverFor,
    groupByLanguage: (embeds) => groupByLanguage(embeds, LANGUAGE_ORDER)
};
