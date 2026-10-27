// Goes straight to embed69.org, the player sololatino.net embeds, since the site's search sits behind Cloudflare.
// Resolves vidhide and streamwish, which share the packed `var links` player.

const CryptoJS = require('crypto-js');
const core = require('../core');

// /video/ 302s to /f/ when the title is there, so it covers both layouts.
const EMBED_BASE = 'https://embed69.org/video/';
// Wikimedia answers 403 to browser-like User-Agents from non-browsers; it wants one naming the client.
const WIKIDATA_UA = 'nuvio-providers/1.0 (https://github.com/juampi20/providers)';
const LANGUAGES = { LAT: 'Latino', ESP: 'Castellano', SUB: 'Subtitulado' };
const LANGUAGE_ORDER = ['LAT', 'ESP', 'SUB'];
const SERVERS = { vidhide: 'Vidhide', streamwish: 'Streamwish' };

function onSettings() {
    return core.tmdbSettings('Optional. Needed on Nuvio builds that do not share their TMDB key with plugins; without it, titles missing from Wikidata are not found.');
}

// Without a key, or when TMDB has no answer (e.g. a bad key), fall back to Wikidata, which needs no key.
function getImdbId(tmdbId, mediaType) {
    const key = core.tmdbApiKey();
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
    const challenge = core.between(html, "const POW_CHALLENGE = '", "';");
    const difficulty = parseInt(core.between(html, 'const POW_DIFFICULTY = ', ';'), 10);
    const salt = core.between(html, "const POW_SALT = '", "';");
    const dataLink = core.between(html, 'dataLink = ', ';');
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
        const host = core.hostOf(url);
        const server = host.indexOf('vidhide') >= 0 ? 'vidhide' : /streamwish|hglink/.test(host) ? 'streamwish' : host;
        result.push({ language: languages[index] || 'LAT', server: server, url: url });
    });
    return result;
}

function parsePage(html) {
    return parseEmbedPage(html).concat(parseVideoPage(html));
}

// streamwish mirrors go through vibuxer.com, which serves the same packed player as vidhide.
function playableEmbed(embed) {
    if (embed.server === 'vidhide') return embed.url;
    if (embed.server === 'streamwish') return core.vibuxerUrl(embed.url);
    return null;
}

function resolveEmbed(embed) {
    const embedUrl = playableEmbed(embed);
    const found = embed.server === 'streamwish' ? core.resolveStreamWish(embedUrl) : core.resolveVidhide(embedUrl);
    return found.then(function (streams) {
        streams.forEach(function (s) { s.quality = core.inferQuality(s.url, embed.server); });
        return core.labeled('SoloLatino', LANGUAGES[embed.language] || embed.language, SERVERS[embed.server], streams);
    }).catch(function () { return []; });
}

function getStreams(tmdbId, mediaType, season, episode) {
    return getImdbId(tmdbId, mediaType)
        .then(function (imdbId) {
            if (!imdbId) throw new Error('No IMDB id for TMDB ' + tmdbId);
            return core.fetchText(EMBED_BASE + embedId(imdbId, mediaType, season, episode), 'https://sololatino.net/');
        })
        .then(function (html) {
            const embeds = parsePage(html).filter(function (e) { return playableEmbed(e); });
            return core.resolveFirstLanguage(core.groupByLanguage(embeds, LANGUAGE_ORDER), 0, resolveEmbed);
        })
        .catch(function (err) {
            console.warn('[SoloLatino] ' + err.message);
            return [];
        });
}

module.exports = {
    getStreams: getStreams,
    onSettings: onSettings,
    _test: {
        onSettings: onSettings, getImdbId: getImdbId, parseEmbedPage: parseEmbedPage, parseVideoPage: parseVideoPage,
        parsePage: parsePage, unpack: core.unpack, playableLinks: core.playableLinks, embedId: embedId,
        playableEmbed: playableEmbed, extractHls: function (url) { return core.resolveVidhide(url).then(function (s) { return s.map(function (x) { return x.url; }); }); },
        groupByLanguage: function (embeds) { return core.groupByLanguage(embeds, LANGUAGE_ORDER); }
    }
};
