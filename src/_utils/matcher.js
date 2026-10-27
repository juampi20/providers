/**
 * Title matching: sites are often addressed by a title the site itself chose, so one Spanish title is not
 * enough. Harvest every title TMDB knows, score the candidates, and refuse a doubtful match — another
 * movie's stream is worse than an empty result.
 */

import { tmdbApiKey, tmdbGet } from './tmdb.js';

/** A title is "similar enough" at this score; below it a provider reports nothing instead of guessing. */
export const TITLE_MATCH_THRESHOLD = 0.7;

const STOPWORDS = /^(the|a|an|of|and|el|la|los|las|de|del|y|e|un|una|le|les)$/;

// String.prototype.normalize is not safe on old Hermes builds, so accents are folded with a table.
const DIACRITICS = {
    'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u', 'ñ': 'n',
    'à': 'a', 'è': 'e', 'ì': 'i', 'ò': 'o', 'ù': 'u', 'ç': 'c', 'ä': 'a', 'ö': 'o', 'ï': 'i'
};

const CJK = /[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/;

/**
 * Fold a title for comparison: lowercase, no accents, no punctuation.
 */
export function foldTitle(text) {
    return String(text || '').toLowerCase()
        .replace(/[áéíóúüñàèìòùçäöï]/g, (c) => DIACRITICS[c])
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Slug built from a title, for sites that address content as `/pelicula/<slug>/`.
 */
export function buildSlug(text) {
    return foldTitle(text).replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Split `El Origen (2010)` into the title and the year a page or API hands back.
 */
export function splitTitleYear(text) {
    const source = String(text || '');
    const year = /\((\d{4})\)/.exec(source);
    return {
        title: source.replace(/\s*\(\d{4}\)\s*/, ' ').replace(/\s+/g, ' ').trim(),
        year: year ? year[1] : null
    };
}

export function stripTrailingNumber(text) {
    return String(text || '').replace(/\s+\d+$/, '').trim();
}

function words(text) {
    return foldTitle(text).split(' ').filter((w) => w && !STOPWORDS.test(w));
}

/**
 * Jaccard over word sets, plus a bonus when every query word is present and a penalty for words the
 * candidate adds ("origen" must not match "los miserables el origen").
 */
export function titleSimilarity(a, b) {
    const wa = words(a);
    const wb = words(b);
    if (!wa.length || !wb.length) return 0;
    if (wa.join(' ') === wb.join(' ')) return 1;
    const inB = {};
    const inA = {};
    const union = {};
    wb.forEach((w) => { inB[w] = true; union[w] = true; });
    wa.forEach((w) => { inA[w] = true; union[w] = true; });
    const inter = wa.filter((w) => inB[w]).length;
    const extra = wb.filter((w) => !inA[w]).length;
    let score = inter / Object.keys(union).length - extra * 0.05;
    if (wa.every((w) => inB[w])) score += 0.2;
    if (wa.length === 1 && wb.length > 1) score -= 0.4;
    return score;
}

/**
 * Pick the candidate whose title (and year, and season) best matches any harvested title.
 * Returns null below TITLE_MATCH_THRESHOLD.
 */
export function bestTitleMatch(titles, year, candidates, options = {}) {
    const variants = [];
    (titles || []).forEach((t) => {
        if (!t) return;
        variants.push(t);
        const bare = stripTrailingNumber(t);
        if (bare && bare !== t) variants.push(bare);
    });

    let best = null;
    let bestScore = 0;

    (candidates || []).forEach((candidate) => {
        if (!candidate || !candidate.title) return;
        let score = 0;
        variants.forEach((t) => {
            let s = titleSimilarity(t, candidate.title);
            if (foldTitle(t) === foldTitle(candidate.title)) s = 1;
            if (s > score) score = s;
        });

        if (year && candidate.year) {
            const dy = Math.abs(parseInt(year, 10) - parseInt(candidate.year, 10));
            const trailing = /\s(\d{1,4})$/.exec(String(candidate.title));
            if (trailing && trailing[1] !== String(year)) score -= 0.25;
            if (dy === 0) score += 0.2;
            else if (dy <= 1) score += 0.05;
            else if (dy <= 5) score -= 0.45;
            else score -= 0.6;
        }

        if (options.season) {
            const text = String(candidate.title).toLowerCase();
            const found = /temporada\s*(\d+)|season\s*(\d+)|s(\d+)/.exec(text);
            if (found) {
                const mentioned = parseInt(found[1] || found[2] || found[3], 10);
                score += mentioned === parseInt(options.season, 10) ? 0.5 : -0.8;
            }
        }

        if (score > bestScore) {
            bestScore = score;
            best = candidate;
        }
    });

    return bestScore >= TITLE_MATCH_THRESHOLD ? best : null;
}

/**
 * Every title a site might have used for this id — Spanish, original and the regional alternatives — in
 * three parallel requests, because each one is paid for out of Nuvio's 60 s budget.
 */
// Wikidata limita el ritmo (429): se guarda lo ya resuelto mientras el plugin viva.
const TITLE_CACHE = {};

export async function titlesFor(tmdbId, mediaType) {
    const cacheKey = mediaType + ':' + tmdbId;
    if (TITLE_CACHE[cacheKey]) return TITLE_CACHE[cacheKey];
    const resolved = await resolveTitles(tmdbId, mediaType);
    TITLE_CACHE[cacheKey] = resolved;
    return resolved;
}

async function resolveTitles(tmdbId, mediaType) {
    const key = tmdbApiKey();
    // Sin key (o si TMDB falla) los títulos salen de Wikidata, que no pide nada: sin esto cada provider que
    // busca por título exigiría una key propia, porque Nuvio no comparte la suya con los plugins.
    if (!key) return titlesFromWikidata(tmdbId, mediaType);

    const kind = mediaType === 'movie' ? 'movie' : 'tv';
    const root = '/' + kind + '/' + tmdbId;
    const results = await Promise.all([
        tmdbGet(root + '?language=es-MX', key).catch(() => null),
        tmdbGet(root + '?language=en-US', key).catch(() => null),
        tmdbGet(root + '/alternative_titles', key).catch(() => null)
    ]);

    const primary = results[0] || results[1] || {};
    const year = String(primary.release_date || primary.first_air_date || '').slice(0, 4);
    const titles = [];
    const add = (t) => {
        if (!t || CJK.test(t)) return;
        if (titles.indexOf(t) < 0) titles.push(t);
    };

    results.forEach((data) => {
        if (!data) return;
        add(data.title || data.name);
        add(data.original_title || data.original_name);
    });
    ((results[2] && results[2].titles) || []).forEach((entry) => add(entry && entry.title));

    if (!titles.length) return titlesFromWikidata(tmdbId, mediaType);
    return { titles, year };
}

// P4947 / P4983 son los ids de TMDB en Wikidata; las etiquetas es/en alcanzan para buscar en los sitios.
const WIKIDATA_UA = 'nuvio-providers/1.0 (https://github.com/juampi20/providers)';

/**
 * Títulos desde Wikidata por id de TMDB, sin key. Es el camino que hace que un provider que busca por
 * título funcione sin que el usuario pegue nada.
 */
export async function titlesFromWikidata(tmdbId, mediaType) {
    const prop = mediaType === 'movie' ? 'P4947' : 'P4983';
    const numeric = String(tmdbId).replace(/\D/g, '');
    const query = 'SELECT ?label ?lang WHERE { ?item wdt:' + prop + ' "' + numeric + '"; rdfs:label ?label . BIND(lang(?label) AS ?lang) FILTER(?lang IN ("es","en")) } LIMIT 12';
    let response = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query), {
        headers: { 'User-Agent': WIKIDATA_UA }
    });
    if (response.status === 429) {
        // Un reintento corto: el límite por ráfaga se libera en menos de un segundo.
        await new Promise((done) => setTimeout(done, 600));
        response = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query), {
            headers: { 'User-Agent': WIKIDATA_UA }
        });
    }
    if (!response.ok) throw new Error('Wikidata HTTP ' + response.status + ' for TMDB ' + tmdbId);
    const data = await response.json();
    const titles = [];
    const addTitle = (label) => {
        if (!label || titles.indexOf(label) >= 0) return;
        titles.push(label);
        // Los sitios buscan por el nombre pelado: "The Matrix" no encuentra "Matrix".
        const bare = label.replace(/^(the|a|an|el|la|los|las|il|le)\s+/i, '').trim();
        if (bare && bare !== label && titles.indexOf(bare) < 0) titles.push(bare);
    };
    ((data && data.results && data.results.bindings) || []).forEach((row) => addTitle(row.label && row.label.value));
    if (!titles.length) throw new Error('No Wikidata title for TMDB ' + tmdbId);
    return { titles, year: '' };
}

/**
 * Deduplicated slugs from every harvested title; capped because each one costs a request.
 */
export function slugVariants(titles, limit = 6) {
    const out = [];
    (titles || []).forEach((title) => {
        [title, stripTrailingNumber(title)].forEach((variant) => {
            const slug = buildSlug(variant);
            if (slug.length > 1 && out.indexOf(slug) < 0) out.push(slug);
        });
    });
    return out.slice(0, limit);
}
