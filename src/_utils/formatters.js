/**
 * Stream formatters: how a stream's fields become what the client draws.
 *
 * Nuvio draws `name` on the first line and `quality` on the second — it does not show `title` — so the
 * language belongs in `name` and the quality only in its own field. Putting the quality in both is what made
 * every row read "1080P" above and "1080p" below while the language was invisible.
 *
 * The presets mirror the AIOStreams idea: a formatter is a named way of composing the same fields, and a
 * provider never decides it — `labeled` asks the active one.
 */

/** Separador de campos que usa Nuvio en la lista de fuentes. */
export const SEPARATOR = ' \u2022 ';

/**
 * Campos que un formatter puede usar.
 * @typedef {{ provider: string, language: string, server: string, quality: string, index: number }} StreamFields
 */

/** El servidor con el número cuando un mismo servidor entrega varios links. */
function serverWithIndex(fields) {
    if (!fields.server) return '';
    return fields.index > 1 ? fields.server + ' ' + fields.index : fields.server;
}

const join = (parts) => parts.filter(Boolean).join(SEPARATOR);

/**
 * Los presets. Todos dejan la calidad fuera de `name`: el cliente ya la dibuja.
 */
export const FORMATTERS = {
    /** `Provider • Idioma • Servidor`. Pensado para Nuvio: name + quality. */
    standard: {
        name: (fields) => join([fields.provider, fields.language, serverWithIndex(fields)]),
        title: (fields) => fields.language,
        quality: (fields) => fields.quality
    },
    /** `Provider • Idioma` con el servidor en el título, para clientes que sí muestran `title`. */
    compact: {
        name: (fields) => join([fields.provider, fields.language]),
        title: (fields) => join([serverWithIndex(fields)]),
        quality: (fields) => fields.quality
    },
    /** `Provider • Idioma • Servidor • CALIDAD`, para clientes que no dibujan la calidad. */
    verbose: {
        name: (fields) => join([fields.provider, fields.language, serverWithIndex(fields), fields.quality && fields.quality !== 'Auto' ? String(fields.quality).toUpperCase() : '']),
        title: (fields) => fields.language,
        quality: (fields) => fields.quality
    }
};

/** Cuál está activo. Cambiarlo cambia el formato de todos los providers a la vez. */
export const DEFAULT_FORMATTER = 'standard';

/**
 * Compone los campos de un stream con el formatter pedido.
 * @param {StreamFields} fields
 * @param {string} [name]
 */
export function formatStream(fields, name = DEFAULT_FORMATTER) {
    const formatter = FORMATTERS[name] || FORMATTERS[DEFAULT_FORMATTER];
    return {
        name: formatter.name(fields),
        title: formatter.title(fields),
        quality: formatter.quality(fields)
    };
}
