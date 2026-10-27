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

// A title is "similar enough" at this score; below it a provider reports nothing instead of guessing.
const TITLE_MATCH_THRESHOLD = 0.7;
const TITLE_STOPWORDS = /^(the|a|an|of|and|el|la|los|las|de|del|y|e|un|una|le|les)$/;

function foldTitle(text) {
    return String(text || '').toLowerCase()
        .replace(/[áéíóúüñàèìòùçäöï]/g, function (c) { return DIACRITICS[c]; })
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function titleWords(text) {
    return foldTitle(text).split(' ').filter(function (w) {
        return w && !TITLE_STOPWORDS.test(w);
    });
}

// Splits "El Origen (2010)" into the title and the year a page or API hands back.
function splitTitleYear(text) {
    const source = String(text || '');
    const year = /\((\d{4})\)/.exec(source);
    return { title: source.replace(/\s*\(\d{4}\)\s*/, ' ').replace(/\s+/g, ' ').trim(), year: year ? year[1] : null };
}

function stripTrailingNumber(text) {
    return String(text || '').replace(/\s+\d+$/, '').trim();
}

// Jaccard over word sets, with a bonus when every query word is present and a penalty when the
// candidate carries words the query does not ("origen" must not match "los miserables el origen").
function titleSimilarity(a, b) {
    const wa = titleWords(a);
    const wb = titleWords(b);
    if (!wa.length || !wb.length) return 0;
    if (wa.join(' ') === wb.join(' ')) return 1;
    const inB = {};
    const inA = {};
    const union = {};
    wb.forEach(function (w) { inB[w] = true; union[w] = true; });
    wa.forEach(function (w) { inA[w] = true; union[w] = true; });
    const inter = wa.filter(function (w) { return inB[w]; }).length;
    const extra = wb.filter(function (w) { return !inA[w]; }).length;
    let score = inter / Object.keys(union).length - extra * 0.05;
    if (wa.every(function (w) { return inB[w]; })) score += 0.2;
    // A one-word query must not swallow a longer title ("matrix" against "matrix reloaded").
    if (wa.length === 1 && wb.length > 1) score -= 0.4;
    return score;
}

// Picks the candidate whose title (and year, and season) best matches any harvested title.
// Returns null below TITLE_MATCH_THRESHOLD: no result beats another movie's streams.
function bestTitleMatch(titles, year, candidates, options) {
    const opts = options || {};
    const variants = [];
    (titles || []).forEach(function (t) {
        if (!t) return;
        variants.push(t);
        const bare = stripTrailingNumber(t);
        if (bare && bare !== t) variants.push(bare);
    });
    let best = null;
    let bestScore = 0;
    (candidates || []).forEach(function (candidate) {
        if (!candidate || !candidate.title) return;
        let score = 0;
        variants.forEach(function (t) {
            let s = titleSimilarity(t, candidate.title);
            if (foldTitle(t) === foldTitle(candidate.title)) s = 1;
            if (s > score) score = s;
        });
        if (year && candidate.year) {
            const dy = Math.abs(parseInt(year, 10) - parseInt(candidate.year, 10));
            const trailing = /\s(\d{1,4})$/.exec(String(candidate.title));
            if (trailing && trailing[1] !== String(year)) score -= 0.25;
            // A same-title page from another year is a remake, not this movie: push it under the threshold.
            if (dy === 0) score += 0.2;
            else if (dy <= 1) score += 0.05;
            else if (dy <= 5) score -= 0.45;
            else score -= 0.6;
        }
        if (opts.season) {
            const text = String(candidate.title).toLowerCase();
            const found = /temporada\s*(\d+)|season\s*(\d+)|s(\d+)/.exec(text);
            if (found) {
                const mentioned = parseInt(found[1] || found[2] || found[3], 10);
                score += mentioned === parseInt(opts.season, 10) ? 0.5 : -0.8;
            }
        }
        if (score > bestScore) {
            bestScore = score;
            best = candidate;
        }
    });
    return bestScore >= TITLE_MATCH_THRESHOLD ? best : null;
}

// Every title a site might have used for this id: Spanish, original, and the regional alternatives.
// Three requests in parallel, because each one is paid for out of Nuvio's 60 s budget.
function titlesFor(tmdbId, mediaType) {
    const key = tmdbApiKey();
    if (!key) return Promise.reject(new Error('No TMDB API key: this provider is searched by title, so it cannot resolve without one'));
    const kind = mediaType === 'movie' ? 'movie' : 'tv';
    const root = 'https://api.themoviedb.org/3/' + kind + '/' + tmdbId;
    const query = '?api_key=' + encodeURIComponent(key);
    const calls = [
        fetchJson(root + query + '&language=es-MX'),
        fetchJson(root + query + '&language=en-US'),
        fetchJson(root + '/alternative_titles' + query)
    ].map(function (call) { return call.catch(function () { return null; }); });
    return Promise.all(calls).then(function (results) {
        const primary = results[0] || results[1] || {};
        const year = String(primary.release_date || primary.first_air_date || '').slice(0, 4);
        const titles = [];
        const add = function (t) {
            if (!t || /[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/.test(t)) return;
            if (titles.indexOf(t) < 0) titles.push(t);
        };
        results.forEach(function (data) {
            if (!data) return;
            add(data.title || data.name);
            add(data.original_title || data.original_name);
        });
        const alternatives = (results[2] && results[2].titles) || [];
        alternatives.forEach(function (entry) { add(entry && entry.title); });
        if (!titles.length) throw new Error('TMDB has no title for ' + kind + ' ' + tmdbId);
        return { titles: titles, year: year };
    });
}

// Deduplicated slugs from every harvested title; capped because each one costs a request.
function slugVariants(titles, limit) {
    const out = [];
    (titles || []).forEach(function (title) {
        [title, stripTrailingNumber(title)].forEach(function (variant) {
            const slug = buildSlug(variant);
            if (slug.length > 1 && out.indexOf(slug) < 0) out.push(slug);
        });
    });
    return out.slice(0, limit || 6);
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

// Nuvio shows two lines per stream. Following latinuvio's split: the `name` carries what qualifies the
// source (provider, quality, server) and the `title` carries the language. Quality is uppercased in the name
// and dropped from it when unknown — `AUTO` in every row would be noise, and we never invent a value. The
// numeric suffix that separates two links from one server goes in the title, which is the only slot left.
const LABEL_SEPARATOR = ' \u2022 ';

function labeled(name, language, server, found) {
    return found.map(function (s, i) {
        const parts = [name];
        if (s.quality && s.quality !== 'Auto') parts.push(String(s.quality).toUpperCase());
        if (server) parts.push(server);
        return {
            name: parts.join(LABEL_SEPARATOR),
            title: language + (i ? ' ' + (i + 1) : ''),
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
    titleSimilarity: titleSimilarity,
    bestTitleMatch: bestTitleMatch,
    titlesFor: titlesFor,
    slugVariants: slugVariants,
    splitTitleYear: splitTitleYear,
    foldTitle: foldTitle,
    TITLE_MATCH_THRESHOLD: TITLE_MATCH_THRESHOLD,
    tmdbApiKey: tmdbApiKey,
    tmdbSettings: tmdbSettings,
    groupByLanguage: groupByLanguage,
    resolveFirstLanguage: resolveFirstLanguage,
    labeled: labeled
};
