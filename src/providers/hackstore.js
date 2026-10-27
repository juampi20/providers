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

// Movies answer in data._id; episodes answer one level deeper, in data.episode._id. The title comes back too,
// and it is what decides whether the slug found the right thing.
function findPostId(slug, postType) {
    return core.fetchJson(API + '/single?post_name=' + encodeURIComponent(slug) + '&post_type=' + postType, { Referer: BASE + '/', Origin: BASE })
        .then(function (body) {
            const data = body && body.data;
            if (!data) return null;
            const entry = data._id ? data : (data.episode || null);
            if (!entry || !entry._id) return null;
            return { id: entry._id, title: String(entry.title || '') };
        });
}

function episodeSlug(title, season, episode) {
    return core.buildSlug(title) + '-temporada-' + parseInt(season, 10) + '-episodio-' + parseInt(episode, 10);
}

// Every harvested title is tried as a slug at once, and the post is accepted only when the title the API
// returns matches: a colliding slug would otherwise serve another movie.
function findPost(titles, year, postType, season, episode) {
    const slugs = core.slugVariants(titles, 3).map(function (slug) {
        if (postType === 'movies') return slug + '-' + year;
        return slug + '-temporada-' + parseInt(season, 10) + '-episodio-' + parseInt(episode, 10);
    });
    return Promise.all(slugs.map(function (slug) {
        return findPostId(slug, postType).catch(function () { return null; });
    })).then(function (found) {
        const candidates = found.filter(function (entry) { return entry; }).map(function (entry) {
            const head = core.splitTitleYear(entry.title);
            return { id: entry.id, title: head.title, year: head.year };
        });
        const match = core.bestTitleMatch(titles, postType === 'movies' ? year : '', candidates, { season: season });
        return match ? match.id : null;
    });
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
    return core.titlesFor(tmdbId, mediaType)
        .then(function (meta) {
            const postType = mediaType === 'movie' ? 'movies' : 'episodes';
            return findPost(meta.titles, meta.year, postType, season, episode);
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
        onSettings: onSettings, getTitles: core.titlesFor, buildSlug: core.buildSlug, episodeSlug: episodeSlug, findPostId: findPostId,
        findPost: findPost, fetchEmbeds: fetchEmbeds, unpack: core.unpack, inferQuality: core.inferQuality, resolveVimeos: core.resolveVimeos,
        resolveStreamWish: core.resolveStreamWish, resolverFor: resolverFor, playableLinks: core.playableLinks, vibuxerUrl: core.vibuxerUrl,
        groupByLanguage: function (embeds) { return core.groupByLanguage(embeds, LANGUAGE_ORDER); }
    }
};
