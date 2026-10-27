/**
 * Stream shape and the language cut, so every provider reports to Nuvio the same way.
 */

/** Separator latinuvio uses between the metadata fields of the name line. */
export const LABEL_SEPARATOR = ' \u2022 ';

/**
 * Shape a stream the way Nuvio renders it: `name` carries what qualifies the source
 * (provider, quality, server) and `title` carries the language. Quality is dropped when unknown instead of
 * printing AUTO on every row, and the numeric suffix that separates two links from one server goes in the
 * title, the only slot left.
 *
 * @param {string} provider
 * @param {string} language
 * @param {string} server
 * @param {Array<{url: string, quality?: string, headers?: object}>} found
 */
export function labeled(provider, language, server, found) {
    return found.map((stream, i) => {
        const parts = [provider];
        if (stream.quality && stream.quality !== 'Auto') parts.push(String(stream.quality).toUpperCase());
        if (server) parts.push(server);
        return {
            name: parts.join(LABEL_SEPARATOR),
            title: language + (i ? ' ' + (i + 1) : ''),
            url: stream.url,
            quality: stream.quality || 'Auto',
            headers: stream.headers
        };
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
