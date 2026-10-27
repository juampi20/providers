/* GENERADO por scripts/build.js desde src/ - no editar a mano */
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// src/core.js
var require_core = __commonJS({
  "src/core.js"(exports2, module2) {
    var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    var TIER_PRIORITY = ["x", "o", "h", "n", "l"];
    var TIERS = {
      vimeos: { x: "1080p", o: "1080p", h: "720p", n: "480p", l: "360p" },
      streamwish: { x: "1080p", o: "1080p", h: "1080p", n: "720p", l: "480p" },
      vidhide: { x: "1080p", o: "1080p", h: "720p", n: "480p", l: "360p" }
    };
    var DIACRITICS = {
      "\xE1": "a",
      "\xE9": "e",
      "\xED": "i",
      "\xF3": "o",
      "\xFA": "u",
      "\xFC": "u",
      "\xF1": "n",
      "\xE0": "a",
      "\xE8": "e",
      "\xEC": "i",
      "\xF2": "o",
      "\xF9": "u",
      "\xE7": "c",
      "\xE4": "a",
      "\xF6": "o",
      "\xEF": "i"
    };
    var BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    function fetchText(url, referer) {
      const headers = { "User-Agent": UA };
      if (referer) headers.Referer = referer;
      return fetch(url, { headers }).then(function(res) {
        if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
        return res.text();
      });
    }
    function fetchJson(url, headers) {
      const merged = { "User-Agent": UA, Accept: "application/json" };
      if (headers) for (const key in headers) merged[key] = headers[key];
      return fetch(url, { headers: merged }).then(function(res) {
        if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
        return res.json();
      });
    }
    function decodeBase64(text) {
      let out = "";
      let buffer = 0;
      let bits = 0;
      for (let i = 0; i < text.length; i++) {
        const value = BASE64.indexOf(text.charAt(i));
        if (value < 0) continue;
        buffer = buffer << 6 | value;
        bits += 6;
        if (bits >= 8) {
          bits -= 8;
          out += String.fromCharCode(buffer >> bits & 255);
        }
      }
      return out;
    }
    function unpack(html) {
      const m = html.match(/eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\('([\s\S]*?)',(\d+),(\d+),'([\s\S]*?)'\.split\('\|'\)/);
      if (!m) return null;
      const radix = parseInt(m[2], 10);
      const words = m[4].split("|");
      function encode(n) {
        const digit = n % radix;
        return (n < radix ? "" : encode(Math.floor(n / radix))) + (digit > 35 ? String.fromCharCode(digit + 29) : digit.toString(36));
      }
      return m[1].replace(/\b\w+\b/g, function(word) {
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
      if (ref.charAt(0) === "/") return base.match(/^https?:\/\/[^/]+/)[0] + ref;
      return base.replace(/[?#].*$/, "").replace(/[^/]*$/, "") + ref;
    }
    function hostOf(url) {
      return url.split("/")[2] || "";
    }
    function vibuxerUrl(embedUrl) {
      if (hostOf(embedUrl).indexOf("vibuxer") >= 0) return embedUrl;
      return "https://vibuxer.com/e/" + embedUrl.split("/").pop();
    }
    function playableLinks(links, embedUrl) {
      return ["hls2", "hls3"].filter(function(k) {
        return links[k];
      }).map(function(k) {
        return resolveUrl(links[k], embedUrl);
      });
    }
    function packedLinks(embedUrl, referer) {
      return fetchText(embedUrl, referer).then(function(html) {
        const script = unpack(html);
        const links = script && between(script, "var links=", ";");
        if (!links) return [];
        return playableLinks(JSON.parse(links), embedUrl).map(function(url) {
          return { url, headers: { "User-Agent": UA, Referer: referer } };
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
    function resolveVimeos(embedUrl) {
      return fetchText(embedUrl, "https://vimeos.net/").then(function(html) {
        const script = unpack(html) || html;
        const m = /["']([^"']+\.m3u8[^"']*)['"]/i.exec(script);
        if (!m) return [];
        return [{ url: resolveUrl(m[1], embedUrl), headers: { "User-Agent": UA, Referer: "https://vimeos.net/" } }];
      });
    }
    function inferQuality(url, server) {
      const tiers = TIERS[server] || {};
      const set = /_,([a-z,]+),\.urlset/.exec(url);
      if (set) {
        const available = set[1].split(",");
        for (let i = 0; i < TIER_PRIORITY.length; i++) {
          if (available.indexOf(TIER_PRIORITY[i]) >= 0 && tiers[TIER_PRIORITY[i]]) return tiers[TIER_PRIORITY[i]];
        }
      }
      const labelled = /[_\-/](\d{3,4})p/.exec(url);
      return labelled ? labelled[1] + "p" : "Auto";
    }
    function buildSlug(text) {
      return String(text).toLowerCase().replace(/[áéíóúüñàèìòùçäöï]/g, function(c) {
        return DIACRITICS[c];
      }).replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    }
    var TITLE_MATCH_THRESHOLD = 0.7;
    var TITLE_STOPWORDS = /^(the|a|an|of|and|el|la|los|las|de|del|y|e|un|una|le|les)$/;
    function foldTitle(text) {
      return String(text || "").toLowerCase().replace(/[áéíóúüñàèìòùçäöï]/g, function(c) {
        return DIACRITICS[c];
      }).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    }
    function titleWords(text) {
      return foldTitle(text).split(" ").filter(function(w) {
        return w && !TITLE_STOPWORDS.test(w);
      });
    }
    function splitTitleYear(text) {
      const source = String(text || "");
      const year = /\((\d{4})\)/.exec(source);
      return { title: source.replace(/\s*\(\d{4}\)\s*/, " ").replace(/\s+/g, " ").trim(), year: year ? year[1] : null };
    }
    function stripTrailingNumber(text) {
      return String(text || "").replace(/\s+\d+$/, "").trim();
    }
    function titleSimilarity(a, b) {
      const wa = titleWords(a);
      const wb = titleWords(b);
      if (!wa.length || !wb.length) return 0;
      if (wa.join(" ") === wb.join(" ")) return 1;
      const inB = {};
      const inA = {};
      const union = {};
      wb.forEach(function(w) {
        inB[w] = true;
        union[w] = true;
      });
      wa.forEach(function(w) {
        inA[w] = true;
        union[w] = true;
      });
      const inter = wa.filter(function(w) {
        return inB[w];
      }).length;
      const extra = wb.filter(function(w) {
        return !inA[w];
      }).length;
      let score = inter / Object.keys(union).length - extra * 0.05;
      if (wa.every(function(w) {
        return inB[w];
      })) score += 0.2;
      if (wa.length === 1 && wb.length > 1) score -= 0.4;
      return score;
    }
    function bestTitleMatch(titles, year, candidates, options) {
      const opts = options || {};
      const variants = [];
      (titles || []).forEach(function(t) {
        if (!t) return;
        variants.push(t);
        const bare = stripTrailingNumber(t);
        if (bare && bare !== t) variants.push(bare);
      });
      let best = null;
      let bestScore = 0;
      (candidates || []).forEach(function(candidate) {
        if (!candidate || !candidate.title) return;
        let score = 0;
        variants.forEach(function(t) {
          let s = titleSimilarity(t, candidate.title);
          if (foldTitle(t) === foldTitle(candidate.title)) s = 1;
          if (s > score) score = s;
        });
        if (year && candidate.year) {
          const dy = Math.abs(parseInt(year, 10) - parseInt(candidate.year, 10));
          const trailing = /\s(\d{1,4})$/.exec(String(candidate.title));
          if (trailing && trailing[1] !== String(year)) score -= 0.25;
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
    function titlesFor(tmdbId, mediaType) {
      const key = tmdbApiKey();
      if (!key) return Promise.reject(new Error("No TMDB API key: this provider is searched by title, so it cannot resolve without one"));
      const kind = mediaType === "movie" ? "movie" : "tv";
      const root = "https://api.themoviedb.org/3/" + kind + "/" + tmdbId;
      const query = "?api_key=" + encodeURIComponent(key);
      const calls = [
        fetchJson(root + query + "&language=es-MX"),
        fetchJson(root + query + "&language=en-US"),
        fetchJson(root + "/alternative_titles" + query)
      ].map(function(call) {
        return call.catch(function() {
          return null;
        });
      });
      return Promise.all(calls).then(function(results) {
        const primary = results[0] || results[1] || {};
        const year = String(primary.release_date || primary.first_air_date || "").slice(0, 4);
        const titles = [];
        const add = function(t) {
          if (!t || /[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/.test(t)) return;
          if (titles.indexOf(t) < 0) titles.push(t);
        };
        results.forEach(function(data) {
          if (!data) return;
          add(data.title || data.name);
          add(data.original_title || data.original_name);
        });
        const alternatives = results[2] && results[2].titles || [];
        alternatives.forEach(function(entry) {
          add(entry && entry.title);
        });
        if (!titles.length) throw new Error("TMDB has no title for " + kind + " " + tmdbId);
        return { titles, year };
      });
    }
    function slugVariants(titles, limit) {
      const out = [];
      (titles || []).forEach(function(title) {
        [title, stripTrailingNumber(title)].forEach(function(variant) {
          const slug = buildSlug(variant);
          if (slug.length > 1 && out.indexOf(slug) < 0) out.push(slug);
        });
      });
      return out.slice(0, limit || 6);
    }
    function tmdbApiKey() {
      const saved = typeof SCRAPER_SETTINGS !== "undefined" && SCRAPER_SETTINGS && SCRAPER_SETTINGS.tmdbApiKey;
      if (saved && String(saved).trim()) return String(saved).trim();
      return typeof TMDB_API_KEY !== "undefined" && TMDB_API_KEY ? TMDB_API_KEY : null;
    }
    function tmdbSettings(description) {
      return [{
        type: "text",
        key: "tmdbApiKey",
        label: "TMDB API key",
        description,
        placeholder: "TMDB v3 API key",
        isPassword: true
      }];
    }
    function groupByLanguage(embeds, order) {
      const seen = [];
      embeds.forEach(function(e) {
        if (seen.indexOf(e.language) < 0) seen.push(e.language);
      });
      const known = order.filter(function(lang) {
        return seen.indexOf(lang) >= 0;
      });
      const rest = seen.filter(function(lang) {
        return order.indexOf(lang) < 0;
      });
      return known.concat(rest).map(function(lang) {
        return { language: lang, embeds: embeds.filter(function(e) {
          return e.language === lang;
        }) };
      });
    }
    function resolveFirstLanguage(groups, index, resolveEmbed) {
      if (index >= groups.length) return Promise.resolve([]);
      return Promise.all(groups[index].embeds.map(resolveEmbed)).then(function(streams) {
        const found = [].concat.apply([], streams);
        return found.length ? found : resolveFirstLanguage(groups, index + 1, resolveEmbed);
      });
    }
    var LABEL_SEPARATOR = " \u2022 ";
    function labeled(name, language, server, found) {
      return found.map(function(s, i) {
        const parts = [name];
        if (s.quality && s.quality !== "Auto") parts.push(String(s.quality).toUpperCase());
        if (server) parts.push(server);
        return {
          name: parts.join(LABEL_SEPARATOR),
          title: language + (i ? " " + (i + 1) : ""),
          url: s.url,
          quality: s.quality || "Auto",
          headers: s.headers
        };
      });
    }
    module2.exports = {
      UA,
      fetchText,
      fetchJson,
      decodeBase64,
      unpack,
      between,
      resolveUrl,
      hostOf,
      vibuxerUrl,
      playableLinks,
      resolveVidhide,
      resolveStreamWish,
      resolveVimeos,
      inferQuality,
      buildSlug,
      titleSimilarity,
      bestTitleMatch,
      titlesFor,
      slugVariants,
      splitTitleYear,
      foldTitle,
      TITLE_MATCH_THRESHOLD,
      tmdbApiKey,
      tmdbSettings,
      groupByLanguage,
      resolveFirstLanguage,
      labeled
    };
  }
});

// src/cinecalidad/index.js
var core = require_core();
var BASE = "https://www.cinecalidad.vg";
var LANGUAGE = "Latino";
var SERVERS = { vimeos: "Vimeos", streamwish: "Streamwish" };
var SLUG_VARIANTS = ["", "-2", "-3"];
function onSettings() {
  return core.tmdbSettings("Required. The site is searched by a slug built from the Spanish title, so the title has to come from TMDB.");
}
function getTitles(tmdbId) {
  return core.titlesFor(tmdbId, "movie");
}
function movieUrl(slug) {
  return BASE + "/pelicula/" + slug + "/";
}
function pageTitle(html) {
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  return h1 ? core.splitTitleYear(h1[1].replace(/<[^>]*>/g, "")) : { title: "", year: null };
}
function pageYear(html) {
  return pageTitle(html).year;
}
function embedUrls(html) {
  const found = [];
  const re = /data-src="([A-Za-z0-9+/=]{20,})"/g;
  let m;
  while (m = re.exec(html)) {
    const url = core.decodeBase64(m[1]);
    if (/^https?:\/\//.test(url) && found.indexOf(url) < 0) found.push(url);
  }
  return found;
}
function findMoviePage(titleList, year) {
  const candidates = [];
  core.slugVariants(titleList, 3).forEach(function(slug) {
    SLUG_VARIANTS.forEach(function(variant) {
      candidates.push(slug + variant);
    });
  });
  return Promise.all(candidates.map(function(slug) {
    return core.fetchText(movieUrl(slug), BASE + "/").then(function(html) {
      const head = pageTitle(html);
      return { html, title: head.title, year: head.year };
    }).catch(function() {
      return null;
    });
  })).then(function(pages) {
    const usable = pages.filter(function(p) {
      return p && embedUrls(p.html).length;
    });
    const match = core.bestTitleMatch(titleList, year, usable, {});
    return match ? match.html : null;
  });
}
function resolverFor(embedUrl) {
  const host = core.hostOf(embedUrl);
  if (host.indexOf("vimeos") >= 0) return { server: "vimeos", resolve: core.resolveVimeos };
  if (/streamwish|hlswish|hglink|strwish/.test(host)) return { server: "streamwish", resolve: core.resolveStreamWish };
  return null;
}
function streamsFrom(embedUrl) {
  const resolver = resolverFor(embedUrl);
  if (!resolver) return Promise.resolve([]);
  return resolver.resolve(embedUrl).then(function(found) {
    found.forEach(function(s) {
      s.quality = core.inferQuality(s.url, resolver.server);
    });
    return core.labeled("CineCalidad", LANGUAGE, SERVERS[resolver.server], found);
  }).catch(function() {
    return [];
  });
}
function getStreams(tmdbId, mediaType, season, episode) {
  if (mediaType !== "movie") return Promise.resolve([]);
  return getTitles(tmdbId).then(function(meta) {
    return findMoviePage(meta.titles, meta.year);
  }).then(function(html) {
    if (!html) return [];
    return Promise.all(embedUrls(html).filter(resolverFor).map(streamsFrom));
  }).then(function(streams) {
    return [].concat.apply([], streams);
  }).catch(function(err) {
    console.warn("[CineCalidad] " + err.message);
    return [];
  });
}
module.exports = {
  getStreams,
  onSettings,
  _test: {
    onSettings,
    getTitles,
    buildSlug: core.buildSlug,
    movieUrl,
    pageYear,
    pageTitle,
    embedUrls,
    findMoviePage,
    decodeBase64: core.decodeBase64,
    unpack: core.unpack,
    inferQuality: core.inferQuality,
    resolveVimeos: core.resolveVimeos,
    resolveStreamWish: core.resolveStreamWish,
    resolverFor,
    playableLinks: core.playableLinks,
    vibuxerUrl: core.vibuxerUrl
  }
};
