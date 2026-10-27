// Shared plumbing for every provider: HTTP, the packed player, quality, the language cut and the pieces
// Nuvio's plugin contract forces on us. Compiled into each provider by `npm run build` — providers/*.js are
// generated artifacts, so a change here reaches every provider at once.

// Hermes on FireTV has no Buffer, may lack atob and String.prototype.normalize, and predates the newer
// Promise combinators: everything below sticks to what it does have.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const TIER_PRIORITY = ['x', 'o', 'h', 'n', 'l'];
const TIERS = {
    vimeos: { x: '1080p', o: '1080p', h: '720p', n: '480p', l: '360p' },
    streamwish: { x: '1080p', o: '1080p', h: '1080p', n: '720p', l: '480p' },
    vidhide: { x: '1080p', o: '1080p', h: '720p', n: '480p', l: '360p' }
};
const DIACRITICS = {
    'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u', 'ñ': 'n',
    'à': 'a', 'è': 'e', 'ì': 'i', 'ò': 'o', 'ù': 'u', 'ç': 'c', 'ä': 'a', 'ö': 'o', 'ï': 'i'
};
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function fetchText(url, referer) {
    const headers = { 'User-Agent': UA };
    if (referer) headers.Referer = referer;
    return fetch(url, { headers: headers }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
        return res.text();
    });
}

function fetchJson(url, headers) {
    const merged = { 'User-Agent': UA, Accept: 'application/json' };
    if (headers) for (const key in headers) merged[key] = headers[key];
    return fetch(url, { headers: merged }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
        return res.json();
    });
}

// Decoded by hand: Hermes has no Buffer and atob is not guaranteed either.
function decodeBase64(text) {
    let out = '';
    let buffer = 0;
    let bits = 0;
    for (let i = 0; i < text.length; i++) {
        const value = BASE64.indexOf(text.charAt(i));
        if (value < 0) continue;
        buffer = (buffer << 6) | value;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            out += String.fromCharCode((buffer >> bits) & 0xff);
        }
    }
    return out;
}

// Dean Edwards' p,a,c,k,e,d packer, used by vidhide, vibuxer, vimeos and most mirrors of that family.
function unpack(html) {
    const m = html.match(/eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\('([\s\S]*?)',(\d+),(\d+),'([\s\S]*?)'\.split\('\|'\)/);
    if (!m) return null;
    const radix = parseInt(m[2], 10);
    const words = m[4].split('|');
    function encode(n) {
        const digit = n % radix;
        return (n < radix ? '' : encode(Math.floor(n / radix))) +
            (digit > 35 ? String.fromCharCode(digit + 29) : digit.toString(36));
    }
    return m[1].replace(/\b\w+\b/g, function (word) {
        const n = parseInt(word, radix);
        return encode(n) === word && words[n] ? words[n] : word;
    });
}

function between(text, start, end) {
    const i = text.indexOf(start);
    if (i < 0) return null;
    const j = text.indexOf(end, i + start.length);
    return j < 0 ? null : text.slice(i + start.length, j);
}

function resolveUrl(ref, base) {
    if (/^https?:\/\//.test(ref)) return ref;
    if (ref.charAt(0) === '/') return base.match(/^https?:\/\/[^/]+/)[0] + ref;
    return base.replace(/[?#].*$/, '').replace(/[^/]*$/, '') + ref;
}

function hostOf(url) {
    return url.split('/')[2] || '';
}

// streamwish mirrors serve an obfuscated loader; vibuxer.com serves the same file as a packed player.
function vibuxerUrl(embedUrl) {
    if (hostOf(embedUrl).indexOf('vibuxer') >= 0) return embedUrl;
    return 'https://vibuxer.com/e/' + embedUrl.split('/').pop();
}

// hls4 segments carry a PNG header that Nuvio's libmpv refuses; nothing is probed: Nuvio waits for every
// pending request before showing results, and a dead CDN outlasts its 60 s plugin limit.
function playableLinks(links, embedUrl) {
    return ['hls2', 'hls3']
        .filter(function (k) { return links[k]; })
        .map(function (k) { return resolveUrl(links[k], embedUrl); });
}

function packedLinks(embedUrl, referer) {
    return fetchText(embedUrl, referer).then(function (html) {
        const script = unpack(html);
        const links = script && between(script, 'var links=', ';');
        if (!links) return [];
        return playableLinks(JSON.parse(links), embedUrl).map(function (url) {
            return { url: url, headers: { 'User-Agent': UA, Referer: referer } };
        });
    });
}

function resolveVidhide(embedUrl) {
    return packedLinks(embedUrl, embedUrl);
}

function resolveStreamWish(embedUrl) {
    const target = vibuxerUrl(embedUrl);
    return packedLinks(target, target);
}

// Vimeos serves a packed player too, but its m3u8 sits in the unpacked source as a bare string.
function resolveVimeos(embedUrl) {
    return fetchText(embedUrl, 'https://vimeos.net/').then(function (html) {
        const script = unpack(html) || html;
        const m = /["']([^"']+\.m3u8[^"']*)['"]/i.exec(script);
        if (!m) return [];
        return [{ url: resolveUrl(m[1], embedUrl), headers: { 'User-Agent': UA, Referer: 'https://vimeos.net/' } }];
    });
}

// Quality comes from the tier list in a multi-quality master URL, so it costs no request.
function inferQuality(url, server) {
    const tiers = TIERS[server] || {};
    const set = /_,([a-z,]+),\.urlset/.exec(url);
    if (set) {
        const available = set[1].split(',');
        for (let i = 0; i < TIER_PRIORITY.length; i++) {
            if (available.indexOf(TIER_PRIORITY[i]) >= 0 && tiers[TIER_PRIORITY[i]]) return tiers[TIER_PRIORITY[i]];
        }
    }
    const labelled = /[_\-/](\d{3,4})p/.exec(url);
    return labelled ? labelled[1] + 'p' : 'Auto';
}

// Slugs are folded by a table because String.prototype.normalize is not safe on old Hermes builds.
function buildSlug(text) {
    return String(text).toLowerCase()
        .replace(/[áéíóúüñàèìòùçäöï]/g, function (c) { return DIACRITICS[c]; })
        .replace(/[^a-z0-9\s-]/g, ' ')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

// The key saved in the plugin settings wins over the one Nuvio injects; older builds (e.g. desktop 1.1.21)
// inject none. A local declaration would shadow the injected global, so both are read through typeof.
function tmdbApiKey() {
    const saved = typeof SCRAPER_SETTINGS !== 'undefined' && SCRAPER_SETTINGS && SCRAPER_SETTINGS.tmdbApiKey;
    if (saved && String(saved).trim()) return String(saved).trim();
    return typeof TMDB_API_KEY !== 'undefined' && TMDB_API_KEY ? TMDB_API_KEY : null;
}

// Nuvio shows the field in the plugin's settings and hands the saved values back as SCRAPER_SETTINGS.
function tmdbSettings(description) {
    return [{
        type: 'text',
        key: 'tmdbApiKey',
        label: 'TMDB API key',
        description: description,
        placeholder: 'TMDB v3 API key',
        isPassword: true
    }];
}

// Groups embeds by language in priority order; codes outside the order follow in page order.
function groupByLanguage(embeds, order) {
    const seen = [];
    embeds.forEach(function (e) {
        if (seen.indexOf(e.language) < 0) seen.push(e.language);
    });
    const known = order.filter(function (lang) { return seen.indexOf(lang) >= 0; });
    const rest = seen.filter(function (lang) { return order.indexOf(lang) < 0; });
    return known.concat(rest).map(function (lang) {
        return { language: lang, embeds: embeds.filter(function (e) { return e.language === lang; }) };
    });
}

// Latino first: a language that resolves means the following ones are never fetched, so Nuvio's 60 s budget
// goes to one language instead of all of them.
function resolveFirstLanguage(groups, index, resolveEmbed) {
    if (index >= groups.length) return Promise.resolve([]);
    return Promise.all(groups[index].embeds.map(resolveEmbed)).then(function (streams) {
        const found = [].concat.apply([], streams);
        return found.length ? found : resolveFirstLanguage(groups, index + 1, resolveEmbed);
    });
}

function labeled(name, language, server, found) {
    return found.map(function (s, i) {
        return {
            name: name,
            title: language + ' - ' + server + (i ? ' ' + (i + 1) : ''),
            url: s.url,
            quality: s.quality || 'Auto',
            headers: s.headers
        };
    });
}

module.exports = {
    UA: UA,
    fetchText: fetchText,
    fetchJson: fetchJson,
    decodeBase64: decodeBase64,
    unpack: unpack,
    between: between,
    resolveUrl: resolveUrl,
    hostOf: hostOf,
    vibuxerUrl: vibuxerUrl,
    playableLinks: playableLinks,
    resolveVidhide: resolveVidhide,
    resolveStreamWish: resolveStreamWish,
    resolveVimeos: resolveVimeos,
    inferQuality: inferQuality,
    buildSlug: buildSlug,
    tmdbApiKey: tmdbApiKey,
    tmdbSettings: tmdbSettings,
    groupByLanguage: groupByLanguage,
    resolveFirstLanguage: resolveFirstLanguage,
    labeled: labeled
};
