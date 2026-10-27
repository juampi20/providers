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
    /**
     * Como AnimES: arriba el proveedor y el episodio, abajo el servidor con el idioma y la calidad.
     * La segunda línea viaja en el campo `quality`, que es el que Nuvio dibuja debajo del nombre.
     */
    standard: {
        name: ['+star', 'provider', 'seasonEpisode'],
        line2: ['server', 'languageTag', 'quality'],
        title: ['languageTag'],
        description: [['title', 'year'], ['seasonEpisode'], ['languageTag', 'server', 'quality']]
    },
    /** Todo en el nombre y la calidad sola abajo. */
    compact: {
        name: ['+star', 'provider', 'seasonEpisode', 'languageTag', 'server'],
        line2: ['quality'],
        title: ['languageTag'],
        description: [['title', 'year'], ['seasonEpisode'], ['languageTag', 'server', 'quality']]
    },
    /** La calidad también arriba, para un cliente que no dibuja la segunda línea. */
    verbose: {
        name: ['+star', 'provider', 'seasonEpisode', 'languageTag', 'server', 'quality'],
        line2: ['resolution'],
        title: ['languageTag'],
        description: [['title', 'year'], ['seasonEpisode'], ['languageTag', 'server', 'quality']]
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

/**
 * Línea a partir de una lista de partes. Una parte escrita `+campo` se pega al principio de la siguiente en
 * vez de separarse — así entra un emoji sin dejar el separador en medio.
 */
function line(parts, fields) {
    const chunks = [];
    let glued = '';
    (parts || []).forEach((part) => {
        if (typeof part === 'string' && part.charAt(0) === '+') {
            glued += partValue(part.slice(1), fields);
            return;
        }
        const value = partValue(part, fields);
        if (value) chunks.push(glued + value);
        glued = '';
    });
    if (glued) chunks.push(glued.trim());
    return chunks.join(SEPARATOR);
}

/**
 * Compone las líneas de un stream con el formatter pedido.
 * @param {StreamFields} fields
 * @param {string} [name]
 */
export function formatStream(fields, name = DEFAULT_FORMATTER) {
    const formatter = FORMATTERS[name] || FORMATTERS[DEFAULT_FORMATTER];
    const description = (formatter.description || []).map((part) => line([part], fields)).filter(Boolean).join(GROUP_SEPARATOR);
    // Lo que Nuvio dibuja en la segunda línea es el campo `quality`: ahí va la línea 2 del formatter.
    const second = (formatter.line2 || []).map((part) => partValue(part, fields)).filter(Boolean).join(GROUP_SEPARATOR);
    return {
        name: line(formatter.name, fields),
        title: line(formatter.title, fields),
        description,
        quality: second || fields.quality || 'Auto',
        measuredQuality: fields.quality || 'Auto'
    };
}
