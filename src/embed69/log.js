import { PROVIDER_NAME } from './extractor.js';

/**
 * Provider logger: prefixes every line so Nuvio's Plugin Tester shows which provider said what.
 * The first argument may be a console method name (`error`, `warn`, `info`, `debug`).
 */
export default function log() {
    const args = Array.from(arguments);
    let method = 'log';
    if (['error', 'warn', 'info', 'debug'].includes(args[0])) {
        method = args[0];
        args.shift();
    }
    console[method](`[${PROVIDER_NAME}]`, ...args);
}
