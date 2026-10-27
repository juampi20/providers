// Goes straight to hackstore2.com's REST API: the site hands over the player list as JSON, so only the
// players themselves are parsed. Vimeos and StreamWish are the servers that resolve; VOE is skipped.

const core = require('../core');

const BASE = 'https://hackstore2.com';
const API = BASE + '/api/rest';
const LANGUAGE_ORDER = ['Latino', 'Español', 'Subtitulado'];
// Spellings the site uses for Castilian.
const LANGUAGE_ALIASES = { 'Castellano': 'Español', 'Latinoamericano': 'Latino' };
const SERVERS = { vimeos: 'Vimeos', streamwish: 'Streamwish' };

function onSettings() {
    return core.tmdbSettings('Required. The site is searched by the Spanish title and year, so the title has to come from TMDB.');
}

// The site is keyed by its own slug, built from the Spanish title plus the year for movies and from the
// series title plus season/episode for episodes — there is no search endpoint.
function getTitle(tmdbId, mediaType) {
    const key = core.tmdbApiKey();
    if (!key) return Promise.reject(new Error('No TMDB API key: hackstore is searched by title, so it cannot resolve without one'));
    return core.fetchJson('https://api.themoviedb.org/3/' + mediaType + '/' + tmdbId + '?api_key=' + encodeURIComponent(key) + '&language=es-MX')
        .then(function (data) {
            const title = data && (data.title || data.name);
            if (!title) throw new Error('TMDB has no title for ' + mediaType + ' ' + tmdbId);
            const date = data.release_date || data.first_air_date || '';
            return { title: title, year: date.slice(0, 4) };
        });
}

// Movies answer in data._id; episodes answer one level deeper, in data.episode._id.
function findPostId(slug, postType) {
    return core.fetchJson(API + '/single?post_name=' + encodeURIComponent(slug) + '&post_type=' + postType, { Referer: BASE + '/', Origin: BASE })
        .then(function (body) {
            const data = body && body.data;
            if (!data) return null;
            return (data._id || (data.episode && data.episode._id)) || null;
        });
}

function episodeSlug(title, season, episode) {
    return core.buildSlug(title) + '-temporada-' + parseInt(season, 10) + '-episodio-' + parseInt(episode, 10);
}

function normalizeLanguage(lang) {
    const name = String(lang || 'Latino').trim();
    return LANGUAGE_ALIASES[name] || name || 'Latino';
}

// The player endpoint answers [{ url, lang, quality }] — no HTML to scrape here.
function fetchEmbeds(postId) {
    return core.fetchJson(API + '/player?post_id=' + postId, { Referer: BASE + '/', Origin: BASE }).then(function (body) {
        return ((body && body.data) || []).filter(function (e) {
            return e && typeof e.url === 'string' && /^https?:\/\//.test(e.url);
        }).map(function (e) {
            return { url: e.url, language: normalizeLanguage(e.lang) };
        });
    });
}

function resolverFor(embedUrl) {
    const host = core.hostOf(embedUrl);
    if (host.indexOf('vimeos') >= 0) return { server: 'vimeos', resolve: core.resolveVimeos };
    if (/streamwish|hlswish|hglink|strwish/.test(host)) return { server: 'streamwish', resolve: core.resolveStreamWish };
    return null;
}

function resolveEmbed(embed) {
    const resolver = resolverFor(embed.url);
    if (!resolver) return [];
    return resolver.resolve(embed.url).then(function (found) {
        found.forEach(function (s) { s.quality = core.inferQuality(s.url, resolver.server); });
        return core.labeled('HackStore', embed.language, SERVERS[resolver.server], found);
    }).catch(function () { return []; });
}

function getStreams(tmdbId, mediaType, season, episode) {
    return getTitle(tmdbId, mediaType)
        .then(function (meta) {
            const postType = mediaType === 'movie' ? 'movies' : 'episodes';
            const slug = mediaType === 'movie'
                ? core.buildSlug(meta.title) + '-' + meta.year
                : episodeSlug(meta.title, season, episode);
            return findPostId(slug, postType);
        })
        .then(function (postId) {
            if (!postId) return [];
            return fetchEmbeds(postId);
        })
        .then(function (embeds) {
            const usable = embeds.filter(function (e) { return resolverFor(e.url); });
            return core.resolveFirstLanguage(core.groupByLanguage(usable, LANGUAGE_ORDER), 0, resolveEmbed);
        })
        .catch(function (err) {
            console.warn('[HackStore] ' + err.message);
            return [];
        });
}

module.exports = {
    getStreams: getStreams,
    onSettings: onSettings,
    _test: {
        onSettings: onSettings, getTitle: getTitle, buildSlug: core.buildSlug, episodeSlug: episodeSlug, findPostId: findPostId,
        fetchEmbeds: fetchEmbeds, unpack: core.unpack, inferQuality: core.inferQuality, resolveVimeos: core.resolveVimeos,
        resolveStreamWish: core.resolveStreamWish, resolverFor: resolverFor, playableLinks: core.playableLinks, vibuxerUrl: core.vibuxerUrl,
        groupByLanguage: function (embeds) { return core.groupByLanguage(embeds, LANGUAGE_ORDER); }
    }
};
