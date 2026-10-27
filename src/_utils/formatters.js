/**
 * Stream formatters: how the fields we actually have become the lines a client draws.
 *
 * Nuvio draws `name` on the first line and `quality` on the second and never shows `title`, so the language
 * and the episode belong in `name`, and the quality only in its own field — putting it in both is what made
 * every row read "1080P" above and "1080p" below while the language stayed invisible.
 *
 * A formatter is a declarative list of parts per line, in the spirit of AIOStreams' formatters but limited to
 * fields this repo can measure: provider, server, language, quality, resolution, protocol, and the media it
 * belongs to (title, year, season/episode). A part that resolves to nothing is dropped, so the same config
 * reads right for a movie and for an episode.
 *
 * Shape of a part:
 *   'field'                 → the field's value
 *   ['fieldA', 'fieldB']    → a group, joined by `groupSeparator`
 * Lines are joined by `separator`; empty lines are dropped.
 */

/** Separador entre partes de una misma línea. */
export const SEPARATOR = ' \u2022 ';
/** Separador dentro de un grupo (título y año, por ejemplo). */
export const GROUP_SEPARATOR = ' \u00b7 ';

/**
 * Los presets. Todos dejan la calidad fuera de `name`: el cliente ya la dibuja.
 */
export const FORMATTERS = {
    /** `Provider • S1E1 • Idioma • Servidor`, con la obra y el episodio en la descripción. */
    standard: {
        name: ['provider', 'seasonEpisode', 'language', 'server'],
        title: ['language'],
        description: [['title', 'year'], ['seasonEpisode'], ['language', 'server', 'quality']]
    },
    /** Sin episodio en el nombre: para un cliente que solo dibuja `name` y no quiere ruido. */
    compact: {
        name: ['provider', 'language', 'server'],
        title: ['seasonEpisode'],
        description: [['title', 'year'], ['seasonEpisode'], ['language', 'server', 'quality']]
    },
    /** Con la calidad también en el nombre, para clientes que no dibujan `quality`. */
    verbose: {
        name: ['provider', 'seasonEpisode', 'language', 'server', 'quality'],
        title: ['language'],
        description: [['title', 'year'], ['seasonEpisode'], ['language', 'server', 'resolution']]
    }
};

/** Cuál está activo. Cambiarlo cambia el formato de todos los providers a la vez. */
export const DEFAULT_FORMATTER = 'standard';

/**
 * @typedef {object} StreamFields
 * @property {string} provider
 * @property {string} server
 * @property {string} language
 * @property {string} quality
 * @property {string} [resolution]  ancho x alto medido, o vacío
 * @property {string} [protocol]    hls | mp4
 * @property {number} [index]       número de link cuando un servidor entrega varios
 * @property {string} [title]
 * @property {string} [year]
 * @property {string} [seasonEpisode] `S1E1` en series, vacío en películas
 */

/** Valor de una parte, o '' cuando no hay nada que mostrar. */
function partValue(part, fields) {
    if (Array.isArray(part)) {
        const inner = part.map((key) => partValue(key, fields)).filter(Boolean).join(GROUP_SEPARATOR);
        return inner;
    }
    if (part === 'server' && fields.server && fields.index > 1) return fields.server + ' ' + fields.index;
    const value = fields[part];
    return value === undefined || value === null ? '' : String(value);
}

/** Línea a partir de una lista de partes. */
function line(parts, fields) {
    return (parts || []).map((part) => partValue(part, fields)).filter(Boolean).join(SEPARATOR);
}

/**
 * Compone las líneas de un stream con el formatter pedido.
 * @param {StreamFields} fields
 * @param {string} [name]
 */
export function formatStream(fields, name = DEFAULT_FORMATTER) {
    const formatter = FORMATTERS[name] || FORMATTERS[DEFAULT_FORMATTER];
    const description = (formatter.description || []).map((part) => line([part], fields)).filter(Boolean).join(GROUP_SEPARATOR);
    return {
        name: line(formatter.name, fields),
        title: line(formatter.title, fields),
        description,
        quality: fields.quality || 'Auto'
    };
}
