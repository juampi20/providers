// Goes straight to embed69.org, the player sololatino.net embeds, since the site's search sits behind Cloudflare.
// Resolves vidhide and streamwish, which share the packed `var links` player.

const CryptoJS = require('crypto-js');

// TMDB_API_KEY and SCRAPER_SETTINGS are globals Nuvio injects; local declarations would shadow them.

// /video/ 302s to /f/ when the title is there, so it covers both layouts.
const EMBED_BASE = 'https://embed69.org/video/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
// Wikimedia answers 403 to browser-like User-Agents from non-browsers; it wants one naming the client.
const WIKIDATA_UA = 'nuvio-providers/1.0 (https://github.com/juampi20/providers)';
const LANGUAGES = { LAT: 'Latino', ESP: 'Castellano', SUB: 'Subtitulado' };
const SERVERS = { vidhide: 'Vidhide', streamwish: 'Streamwish' };

function fetchText(url, referer) {
    const headers = { 'User-Agent': UA };
    if (referer) headers.Referer = referer;
    return fetch(url, { headers: headers }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
        return res.text();
    });
}

// Nuvio shows this in the plugin's settings and hands the saved values back as SCRAPER_SETTINGS.
function onSettings() {
    return [{
        type: 'text',
        key: 'tmdbApiKey',
        label: 'TMDB API key',
        description: 'Optional. Needed on Nuvio builds that do not share their TMDB key with plugins; without it, titles missing from Wikidata are not found.',
        placeholder: 'TMDB v3 API key',
        isPassword: true
    }];
}

// The key saved in the plugin settings wins over the one Nuvio injects; older builds (e.g. desktop 1.1.21) inject none.
function tmdbApiKey() {
    const saved = typeof SCRAPER_SETTINGS !== 'undefined' && SCRAPER_SETTINGS && SCRAPER_SETTINGS.tmdbApiKey;
    if (saved && String(saved).trim()) return String(saved).trim();
    return typeof TMDB_API_KEY !== 'undefined' && TMDB_API_KEY ? TMDB_API_KEY : null;
}

// Without a key, or when TMDB has no answer (e.g. a bad key), fall back to Wikidata, which needs no key.
function getImdbId(tmdbId, mediaType) {
    const key = tmdbApiKey();
    if (!key) return getImdbIdFromWikidata(tmdbId, mediaType);
    const path = mediaType === 'movie' ? 'movie/' + tmdbId : 'tv/' + tmdbId + '/external_ids';
    return fetch('https://api.themoviedb.org/3/' + path + '?api_key=' + encodeURIComponent(key))
        .then(function (res) { return res.json(); })
        .then(function (data) { return (data && data.imdb_id) || getImdbIdFromWikidata(tmdbId, mediaType); });
}

// P4947 / P4983 are Wikidata's TMDB movie / TV ids, P345 the IMDb id.
function getImdbIdFromWikidata(tmdbId, mediaType) {
    const prop = mediaType === 'movie' ? 'P4947' : 'P4983';
    const query = 'SELECT ?imdb WHERE { ?item wdt:' + prop + ' "' + String(tmdbId).replace(/\D/g, '') + '"; wdt:P345 ?imdb } LIMIT 1';
    return fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query), { headers: { 'User-Agent': WIKIDATA_UA } })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            const row = data && data.results && data.results.bindings[0];
            return row ? row.imdb.value : null;
        });
}

function embedId(imdbId, mediaType, season, episode) {
    if (mediaType === 'movie') return imdbId;
    return imdbId + '-' + season + 'x' + String(episode).padStart(2, '0');
}

function between(text, start, end) {
    const i = text.indexOf(start);
    if (i < 0) return null;
    const j = text.indexOf(end, i + start.length);
    return j < 0 ? null : text.slice(i + start.length, j);
}

// Brute-force a nonce whose SHA-256 starts with `difficulty` zeros; the AES key
// is SHA-256(challenge + nonce + salt).
function deriveKey(challenge, difficulty, salt) {
    const prefix = '0'.repeat(difficulty);
    let nonce = 0;
    while (CryptoJS.SHA256(challenge + nonce).toString().indexOf(prefix) !== 0) nonce++;
    return CryptoJS.SHA256(challenge + nonce + salt);
}

// Payload is base64(iv[16] + ciphertext), AES-256-CBC.
function decrypt(base64, key) {
    try {
        const raw = CryptoJS.enc.Base64.parse(base64);
        const iv = CryptoJS.lib.WordArray.create(raw.words.slice(0, 4), 16);
        const ciphertext = CryptoJS.lib.WordArray.create(raw.words.slice(4), raw.sigBytes - 16);
        const plain = CryptoJS.AES.decrypt({ ciphertext: ciphertext }, key, {
            iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7
        }).toString(CryptoJS.enc.Utf8);
        return plain || null;
    } catch (e) {
        return null;
    }
}

// Returns [{ language, server, url }] from an embed69 page, or [] if the layout changed.
function parseEmbedPage(html) {
    const challenge = between(html, "const POW_CHALLENGE = '", "';");
    const difficulty = parseInt(between(html, 'const POW_DIFFICULTY = ', ';'), 10);
    const salt = between(html, "const POW_SALT = '", "';");
    const dataLink = between(html, 'dataLink = ', ';');
    if (!challenge || isNaN(difficulty) || salt === null || !dataLink) return [];

    const key = deriveKey(challenge, difficulty, salt);
    const result = [];
    JSON.parse(dataLink).forEach(function (lang) {
        (lang.sortedEmbeds || []).forEach(function (embed) {
            const url = embed.link && decrypt(embed.link, key);
            if (url) result.push({ language: lang.video_language, server: embed.servername, url: url });
        });
    });
    return result;
}

// Titles missing from /f/ (e.g. The 100) only exist on embed69's /video/ page, a plain list of
// playServerVast('<url>') entries, each tagged with a data-lang index into the language tabs.
function parseVideoPage(html) {
    const languages = {};
    html.replace(/<li class="SLD_[A-Z]" data-lang="(\d+)">\s*<img src="[^"]*\/lang\/([A-Z]+)\.png/g, function (m, index, lang) {
        languages[index] = lang;
    });
    const result = [];
    html.replace(/playServerVast\('([^']+)'\);" data-lang="(\d+)"/g, function (m, url, index) {
        const host = url.split('/')[2] || '';
        const server = host.indexOf('vidhide') >= 0 ? 'vidhide' : /streamwish|hglink/.test(host) ? 'streamwish' : host;
        result.push({ language: languages[index] || 'LAT', server: server, url: url });
    });
    return result;
}

function parsePage(html) {
    return parseEmbedPage(html).concat(parseVideoPage(html));
}

// Dean Edwards' p,a,c,k,e,d packer.
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

// streamwish mirrors serve an obfuscated loader; vibuxer.com serves the same file as a packed player.
function playableEmbed(embed) {
    if (embed.server === 'vidhide') return embed.url;
    if (embed.server === 'streamwish') return 'https://vibuxer.com/e/' + embed.url.split('/').pop();
    return null;
}

function extractHls(embedUrl) {
    return fetchText(embedUrl, 'https://embed69.org/').then(function (html) {
        const script = unpack(html);
        const links = script && between(script, 'var links=', ';');
        if (!links) return [];
        return playableLinks(JSON.parse(links), embedUrl, { 'User-Agent': UA, Referer: embedUrl });
    });
}

function resolveUrl(ref, base) {
    if (/^https?:\/\//.test(ref)) return ref;
    if (ref.charAt(0) === '/') return base.match(/^https?:\/\/[^/]+/)[0] + ref;
    return base.replace(/[?#].*$/, '').replace(/[^/]*$/, '') + ref;
}

// URI of the highest-bandwidth entry (what the player picks), or null when it is not a playlist (CDN error pages are HTML).
function bestUri(text) {
    if (!text || String(text).trim().indexOf('#EXTM3U') !== 0) return null;
    const lines = String(text).split('\n').map(function (l) { return l.trim(); });
    let best = null;
    let bestBandwidth = -1;
    lines.forEach(function (line, i) {
        if (!line || line.charAt(0) === '#') return;
        const info = /BANDWIDTH=(\d+)/.exec(lines[i - 1] || '');
        const bandwidth = info ? parseInt(info[1], 10) : 0;
        if (bandwidth > bestBandwidth) { best = line; bestBandwidth = bandwidth; }
    });
    return best;
}

// 'ts' for clean MPEG-TS, 'wrapped' for TS behind a fake header (the tiktokcdn copies prepend a PNG), else null.
function segmentKind(b) {
    if (b.length > 188 && b[0] === 0x47 && b[188] === 0x47) return 'ts';
    for (let i = 1; i + 376 < b.length && i < 400; i++) {
        if (b[i] === 0x47 && b[i + 188] === 0x47 && b[i + 376] === 0x47) return 'wrapped';
    }
    return null;
}

// Walks master -> best variant -> first 1 KB of its first segment, since a CDN can serve the playlists and fail the segments.
function probeHls(master, headers) {
    const get = function (url) {
        return fetch(url, { headers: headers }).then(function (res) { return res.ok ? res.text() : null; });
    };
    return get(master).then(function (text) {
        const variantRef = bestUri(text);
        if (!variantRef) return null;
        const variant = resolveUrl(variantRef, master);
        return get(variant).then(function (text2) {
            const segmentRef = bestUri(text2);
            if (!segmentRef) return null;
            return fetch(resolveUrl(segmentRef, variant), { headers: Object.assign({ Range: 'bytes=0-1023' }, headers) })
                .then(function (res) { return res.ok ? res.arrayBuffer() : null; })
                .then(function (buf) { return buf ? segmentKind(new Uint8Array(buf)) : null; });
        });
    }).catch(function () { return null; });
}

// hls4's PNG-wrapped segments never play in Nuvio's libmpv, and hls2/hls3 CDNs fail or hang, so probe hls2/hls3
// in parallel and keep the clean ones. Without setTimeout (desktop 1.1.21) a dead CDN takes 30 s+ to fail, so skip probing.
function playableLinks(links, embedUrl, headers, deadlineMs) {
    const candidates = ['hls2', 'hls3']
        .filter(function (k) { return links[k]; })
        .map(function (k) { return resolveUrl(links[k], embedUrl); });
    if (typeof setTimeout !== 'function') return Promise.resolve(candidates);
    return new Promise(function (resolve) {
        const passed = [];
        let pending = candidates.length;
        let done = false;
        function finish() {
            if (!done) { done = true; resolve(passed.slice()); }
        }
        if (!pending) return finish();
        setTimeout(finish, deadlineMs === undefined ? 5000 : deadlineMs);
        candidates.forEach(function (url) {
            probeHls(url, headers).then(function (kind) {
                if (kind === 'ts') passed.push(url);
                if (--pending === 0) finish();
            });
        });
    });
}

function getStreams(tmdbId, mediaType, season, episode) {
    return getImdbId(tmdbId, mediaType)
        .then(function (imdbId) {
            if (!imdbId) throw new Error('No IMDB id for TMDB ' + tmdbId);
            return fetchText(EMBED_BASE + embedId(imdbId, mediaType, season, episode), 'https://sololatino.net/');
        })
        .then(function (html) {
            const embeds = parsePage(html).filter(function (e) { return playableEmbed(e); });
            return Promise.all(embeds.map(function (e) {
                const embedUrl = playableEmbed(e);
                return extractHls(embedUrl).then(function (urls) {
                    return urls.map(function (url, i) {
                        return {
                            name: 'SoloLatino',
                            title: (LANGUAGES[e.language] || e.language) + ' - ' + SERVERS[e.server] + (i ? ' ' + (i + 1) : ''),
                            url: url,
                            quality: 'Auto',
                            headers: { 'User-Agent': UA, Referer: embedUrl }
                        };
                    });
                }).catch(function () { return []; });
            }));
        })
        .then(function (streams) { return [].concat.apply([], streams); })
        .catch(function (err) {
            console.warn('[SoloLatino] ' + err.message);
            return [];
        });
}

module.exports = { getStreams: getStreams, onSettings: onSettings, _test: { onSettings: onSettings, getImdbId: getImdbId, parseEmbedPage: parseEmbedPage, parseVideoPage: parseVideoPage, parsePage: parsePage, unpack: unpack, segmentKind: segmentKind, playableLinks: playableLinks, embedId: embedId, playableEmbed: playableEmbed, extractHls: extractHls } };
