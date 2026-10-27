/**
 * Stream shape and the language cut, so every provider reports to Nuvio the same way.
 */

import { formatStream } from './formatters.js';

/**
 * Shape a stream the way the client draws it. The formatter decides where each field goes — see
 * [formatters](formatters): `name` carries provider, language and server, `quality` travels in its own field
 * because Nuvio draws it on the second line, and `title` mirrors the language for clients that read it.
 *
 * @param {string} provider
 * @param {string} language
 * @param {string} server
 * @param {Array<{url: string, quality?: string, headers?: object}>} found
 */
export function labeled(provider, language, server, found) {
    return found.map((stream, i) => {
        const quality = stream.quality || 'Auto';
        return Object.assign(
            formatStream({ provider, language, server, quality, index: i + 1 }),
            { url: stream.url, headers: stream.headers }
        );
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
