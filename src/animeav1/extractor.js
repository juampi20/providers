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

/** Temporada que declara el slug de una serie, o 0 cuando no declara ninguna. */
export function declaredSeason(slug) {
    const text = String(slug || '');
    const ordinal = /-(\d+)(?:st|nd|rd|th)-season/.exec(text);
    if (ordinal) return parseInt(ordinal[1], 10);
    const plain = /-(?:season|temporada)-?(\d+)/.exec(text);
    if (plain) return parseInt(plain[1], 10);
    return 0;
}

/**
 * Ordena los candidatos por temporada: primero el que la declara igual a la pedida, después los que no
 * declaran ninguna (que son la temporada 1) y último el de otra temporada. El sitio devuelve primero la
 * temporada que está en emisión, así que sin esto una búsqueda de la 1 termina en la 2.
 */
export function seasonCandidates(candidates, season) {
    const wanted = parseInt(season, 10) || 1;
    const ranked = candidates.map((candidate, order) => {
        const declared = declaredSeason(candidate.slug);
        let rank;
        if (declared === wanted) rank = 3;
        else if (declared === 0) rank = wanted === 1 ? 2 : 1;
        else rank = -10;
        return { candidate, rank, order };
    });
    return ranked
        .filter((entry) => entry.rank > 0)
        .sort((a, b) => (b.rank - a.rank) || (a.order - b.order))
        .map((entry) => entry.candidate);
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
    declaredSeason,
    resolverFor,
    groupByLanguage: (embeds) => groupByLanguage(embeds, LANGUAGE_ORDER)
};
