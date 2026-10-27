// Goes straight to cinecalidad.vg: the movie page carries each player as a base64 `data-src`, so one
// request per candidate slug is all the scraping there is. Vimeos and StreamWish resolve; VOE is skipped.

const core = require('../core');

const BASE = 'https://www.cinecalidad.vg';
// The site has no language metadata; it is a Latino catalogue, so every stream is labelled Latino.
const LANGUAGE = 'Latino';
const SERVERS = { vimeos: 'Vimeos', streamwish: 'Streamwish' };
// Slugs are guessed from the title, so the site's own numbering (-2, -3, …) has to be tried too.
const SLUG_VARIANTS = ['', '-2', '-3'];

function onSettings() {
    return core.tmdbSettings('Required. The site is searched by a slug built from the Spanish title, so the title has to come from TMDB.');
}

// The site's own title rarely matches TMDB's, so the Spanish title is tried first and the original title
// second; both carry the release year, which the page's <h1> has to agree with.
function getTitles(tmdbId) {
    const key = core.tmdbApiKey();
    if (!key) return Promise.reject(new Error('No TMDB API key: cinecalidad is searched by title, so it cannot resolve without one'));
    return core.fetchJson('https://api.themoviedb.org/3/movie/' + tmdbId + '?api_key=' + encodeURIComponent(key) + '&language=es-MX')
        .then(function (data) {
            const year = String((data && data.release_date) || '').slice(0, 4);
            const names = data ? [data.title, data.original_title] : [];
            const titles = [];
            names.forEach(function (name) {
                if (name && !titles.filter(function (t) { return t.title === name; }).length) {
                    titles.push({ title: name, year: year });
                }
            });
            if (!titles.length) throw new Error('TMDB has no title for movie ' + tmdbId);
            return titles;
        });
}

function movieUrl(slug) {
    return BASE + '/pelicula/' + slug + '/';
}

// The page's <h1> carries the title and its release year; a page whose year disagrees is the wrong movie.
function pageYear(html) {
    const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
    const year = h1 && /\((\d{4})\)/.exec(h1[1]);
    return year ? year[1] : null;
}

function embedUrls(html) {
    const found = [];
    const re = /data-src="([A-Za-z0-9+/=]{20,})"/g;
    let m;
    while ((m = re.exec(html))) {
        const url = core.decodeBase64(m[1]);
        if (/^https?:\/\//.test(url) && found.indexOf(url) < 0) found.push(url);
    }
    return found;
}

// Tries every title × slug variant at once and keeps the page whose year matches. A page whose year
// contradicts TMDB is dropped instead of used: another movie's streams are worse than none. A page whose
// <h1> carries no year can't be checked, so it is allowed.
function findMoviePage(titles) {
    const candidates = [];
    titles.forEach(function (entry) {
        SLUG_VARIANTS.forEach(function (variant) {
            candidates.push({ slug: core.buildSlug(entry.title) + variant, year: entry.year });
        });
    });
    return Promise.all(candidates.map(function (candidate) {
        return core.fetchText(movieUrl(candidate.slug), BASE + '/')
            .then(function (html) { return { html: html, year: candidate.year, pageYear: pageYear(html) }; })
            .catch(function () { return null; });
    })).then(function (pages) {
        const usable = pages.filter(function (p) { return p && embedUrls(p.html).length; });
        const trusted = usable.filter(function (p) { return !p.year || !p.pageYear || p.pageYear === p.year; });
        return trusted.length ? trusted[0].html : null;
    });
}

function resolverFor(embedUrl) {
    const host = core.hostOf(embedUrl);
    if (host.indexOf('vimeos') >= 0) return { server: 'vimeos', resolve: core.resolveVimeos };
    if (/streamwish|hlswish|hglink|strwish/.test(host)) return { server: 'streamwish', resolve: core.resolveStreamWish };
    return null;
}

function streamsFrom(embedUrl) {
    const resolver = resolverFor(embedUrl);
    if (!resolver) return Promise.resolve([]);
    return resolver.resolve(embedUrl).then(function (found) {
        found.forEach(function (s) { s.quality = core.inferQuality(s.url, resolver.server); });
        return core.labeled('CineCalidad', LANGUAGE, SERVERS[resolver.server], found);
    }).catch(function () { return []; });
}

function getStreams(tmdbId, mediaType, season, episode) {
    if (mediaType !== 'movie') return Promise.resolve([]);
    return getTitles(tmdbId)
        .then(findMoviePage)
        .then(function (html) {
            if (!html) return [];
            return Promise.all(embedUrls(html).filter(resolverFor).map(streamsFrom));
        })
        .then(function (streams) { return [].concat.apply([], streams); })
        .catch(function (err) {
            console.warn('[CineCalidad] ' + err.message);
            return [];
        });
}

module.exports = {
    getStreams: getStreams,
    onSettings: onSettings,
    _test: {
        onSettings: onSettings, getTitles: getTitles, buildSlug: core.buildSlug, movieUrl: movieUrl, pageYear: pageYear,
        embedUrls: embedUrls, findMoviePage: findMoviePage, decodeBase64: core.decodeBase64, unpack: core.unpack,
        inferQuality: core.inferQuality, resolveVimeos: core.resolveVimeos, resolveStreamWish: core.resolveStreamWish,
        resolverFor: resolverFor, playableLinks: core.playableLinks, vibuxerUrl: core.vibuxerUrl
    }
};
