/**
 * Stream shape and the language cut, so every provider reports to Nuvio the same way.
 */

import { formatStream } from './formatters.js';

/**
 * Contexto de la obra que se está buscando. Se aplica después de resolver, porque el resolver de cada
 * provider no lo conoce (está en `extractStreams` o en `getStreams`).
 * @typedef {{ mediaType?: string, season?: number, episode?: number, title?: string, year?: string }} MediaContext
 */

/** `S1E1` en series; vacío en películas. */
function seasonEpisodeOf(context) {
    if (!context || context.mediaType === 'movie' || context.season === undefined || context.season === null) return '';
    if (context.episode === undefined || context.episode === null) return '';
    return 'S' + parseInt(context.season, 10) + 'E' + parseInt(context.episode, 10);
}

/**
 * Shape a stream the way the client draws it. The formatter decides where each field goes — see
 * [formatters](formatters): `name` carries provider, episode, language and server, `quality` travels in its
 * own field because Nuvio draws it on the second line, and `description` repeats the context for clients that
 * show it.
 *
 * @param {string} provider
 * @param {string} language
 * @param {string} server
 * @param {Array<{url: string, quality?: string, resolution?: string, protocol?: string, headers?: object}>} found
 * @param {MediaContext} [context]
 */
export function labeled(provider, language, server, found, context) {
    return found.map((stream, i) => {
        const fields = {
            provider,
            language,
            server,
            quality: stream.quality || 'Auto',
            resolution: stream.resolution || '',
            protocol: stream.protocol || '',
            index: i + 1,
            title: (context && context.title) || '',
            year: (context && context.year) || '',
            seasonEpisode: seasonEpisodeOf(context)
        };
        const display = formatStream(fields);
        return {
            name: display.name,
            title: display.title,
            description: display.description,
            quality: display.quality,
            url: stream.url,
            headers: stream.headers,
            fields
        };
    });
}

/**
 * Vuelve a componer una lista ya etiquetada agregando el contexto de la obra (título, año, temporada y
 * episodio). Se llama al final, en la entrada del provider, donde ese contexto existe.
 * @param {Array} streams
 * @param {MediaContext} context
 */
export function applyContext(streams, context) {
    if (!streams || !streams.length) return streams;
    return streams.map((stream) => {
        if (!stream.fields) return stream;
        const fields = Object.assign({}, stream.fields, {
            title: context.title || stream.fields.title || '',
            year: context.year || stream.fields.year || '',
            seasonEpisode: seasonEpisodeOf(context) || stream.fields.seasonEpisode || ''
        });
        const display = formatStream(fields);
        return Object.assign({}, stream, {
            name: display.name,
            title: display.title,
            description: display.description,
            quality: display.quality,
            fields
        });
    });
}

/**
 * Group embeds by language in priority order; codes outside the order follow in page order.
 * @param {Array<{language: string}>} embeds
 * @param {string[]} order
 */
export function groupByLanguage(embeds, order) {
    const seen = [];
    embeds.forEach((embed) => {
        if (seen.indexOf(embed.language) < 0) seen.push(embed.language);
    });
    const known = order.filter((lang) => seen.indexOf(lang) >= 0);
    const rest = seen.filter((lang) => order.indexOf(lang) < 0);
    return known.concat(rest).map((lang) => ({
        language: lang,
        embeds: embeds.filter((embed) => embed.language === lang)
    }));
}

/**
 * Latino first: the first language that resolves ends the call, so the following ones are never fetched and
 * Nuvio's 60 s budget goes to one language instead of all of them.
 *
 * @param {Array<{language: string, embeds: any[]}>} groups
 * @param {number} index
 * @param {(embed: any) => Promise<object[]>} resolveEmbed
 */
export async function resolveFirstLanguage(groups, index, resolveEmbed) {
    if (index >= groups.length) return [];
    const streams = await Promise.all(groups[index].embeds.map(resolveEmbed));
    const found = streams.reduce((all, list) => all.concat(list), []);
    return found.length ? found : resolveFirstLanguage(groups, index + 1, resolveEmbed);
}
