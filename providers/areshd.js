/**
 * areshd - Built from src/areshd/ by build.js - do not edit by hand
 */
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/areshd/index.js
var index_exports = {};
__export(index_exports, {
  _test: () => _testAll,
  _testAll: () => _testAll,
  getStreams: () => getStreams
});
module.exports = __toCommonJS(index_exports);

// src/_utils/http.js
var BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
function browserHeaders(referer) {
  const headers = { "User-Agent": BROWSER_UA };
  if (referer) headers.Referer = referer;
  return headers;
}
function fetchBrowserText(url, referer) {
  return __async(this, null, function* () {
    const response = yield fetch(url, { headers: browserHeaders(referer) });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return response.text();
  });
}
function fetchBrowserJson(url, headers) {
  return __async(this, null, function* () {
    const response = yield fetch(url, { headers: __spreadValues(__spreadProps(__spreadValues({}, browserHeaders()), { Accept: "application/json" }), headers) });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return response.json();
  });
}

// src/_utils/tmdb.js
function tmdbApiKey() {
  const saved = typeof SCRAPER_SETTINGS !== "undefined" && SCRAPER_SETTINGS && SCRAPER_SETTINGS.tmdbApiKey;
  if (saved && String(saved).trim()) return String(saved).trim();
  return typeof TMDB_API_KEY !== "undefined" && TMDB_API_KEY ? TMDB_API_KEY : null;
}
function tmdbGet(path, key) {
  const separator = path.indexOf("?") >= 0 ? "&" : "?";
  return fetchBrowserJson("https://api.themoviedb.org/3" + path + separator + "api_key=" + encodeURIComponent(key));
}

// src/_utils/matcher.js
var TITLE_MATCH_THRESHOLD = 0.7;
var STOPWORDS = /^(the|a|an|of|and|el|la|los|las|de|del|y|e|un|una|le|les)$/;
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
var CJK = /[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/;
function foldTitle(text) {
  return String(text || "").toLowerCase().replace(/[áéíóúüñàèìòùçäöï]/g, (c) => DIACRITICS[c]).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function stripTrailingNumber(text) {
  return String(text || "").replace(/\s+\d+$/, "").trim();
}
function words(text) {
  return foldTitle(text).split(" ").filter((w) => w && !STOPWORDS.test(w));
}
function titleSimilarity(a, b) {
  const wa = words(a);
  const wb = words(b);
  if (!wa.length || !wb.length) return 0;
  if (wa.join(" ") === wb.join(" ")) return 1;
  const inB = {};
  const inA = {};
  const union = {};
  wb.forEach((w) => {
    inB[w] = true;
    union[w] = true;
  });
  wa.forEach((w) => {
    inA[w] = true;
    union[w] = true;
  });
  const inter = wa.filter((w) => inB[w]).length;
  const extra = wb.filter((w) => !inA[w]).length;
  let score = inter / Object.keys(union).length - extra * 0.05;
  if (wa.every((w) => inB[w])) score += 0.2;
  if (wa.length === 1 && wb.length > 1) score -= 0.4;
  return score;
}
function bestTitleMatch(titles, year, candidates, options = {}) {
  const variants = [];
  (titles || []).forEach((t) => {
    if (!t) return;
    variants.push(t);
    const bare = stripTrailingNumber(t);
    if (bare && bare !== t) variants.push(bare);
  });
  let best = null;
  let bestScore = 0;
  (candidates || []).forEach((candidate) => {
    if (!candidate || !candidate.title) return;
    let score = 0;
    variants.forEach((t) => {
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
    if (options.season) {
      const text = String(candidate.title).toLowerCase();
      const found = /temporada\s*(\d+)|season\s*(\d+)|s(\d+)/.exec(text);
      if (found) {
        const mentioned = parseInt(found[1] || found[2] || found[3], 10);
        score += mentioned === parseInt(options.season, 10) ? 0.5 : -0.8;
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
  return __async(this, null, function* () {
    const key = tmdbApiKey();
    if (!key) throw new Error("No TMDB API key: this provider is searched by title, so it cannot resolve without one");
    const kind = mediaType === "movie" ? "movie" : "tv";
    const root = "/" + kind + "/" + tmdbId;
    const results = yield Promise.all([
      tmdbGet(root + "?language=es-MX", key).catch(() => null),
      tmdbGet(root + "?language=en-US", key).catch(() => null),
      tmdbGet(root + "/alternative_titles", key).catch(() => null)
    ]);
    const primary = results[0] || results[1] || {};
    const year = String(primary.release_date || primary.first_air_date || "").slice(0, 4);
    const titles = [];
    const add = (t) => {
      if (!t || CJK.test(t)) return;
      if (titles.indexOf(t) < 0) titles.push(t);
    };
    results.forEach((data) => {
      if (!data) return;
      add(data.title || data.name);
      add(data.original_title || data.original_name);
    });
    (results[2] && results[2].titles || []).forEach((entry) => add(entry && entry.title));
    if (!titles.length) throw new Error("TMDB has no title for " + kind + " " + tmdbId);
    return { titles, year };
  });
}

// src/_utils/jsunpack.js
var Unbase = class {
  constructor(radix) {
    __publicField(this, "ALPHABET_62", "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ");
    __publicField(this, "ALPHABET_95", " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~");
    __publicField(this, "radix");
    __publicField(this, "alphabet", null);
    __publicField(this, "dictionary", {});
    this.radix = radix;
    if (radix > 36) {
      if (radix < 62) {
        this.alphabet = this.ALPHABET_62.substring(0, radix);
      } else if (radix > 62 && radix < 95) {
        this.alphabet = this.ALPHABET_95.substring(0, radix);
      } else if (radix === 62) {
        this.alphabet = this.ALPHABET_62;
      } else if (radix === 95) {
        this.alphabet = this.ALPHABET_95;
      }
      if (this.alphabet) {
        for (let i = 0; i < this.alphabet.length; i++) {
          this.dictionary[this.alphabet[i]] = i;
        }
      }
    }
  }
  unbase(str) {
    var _a;
    if (this.alphabet === null) {
      return parseInt(str, this.radix);
    }
    const tmp = str.split("").reverse().join("");
    let ret = 0;
    for (let i = 0; i < tmp.length; i++) {
      ret += Math.pow(this.radix, i) * ((_a = this.dictionary[tmp[i]]) != null ? _a : 0);
    }
    return ret;
  }
};
var JsUnpacker = class {
  constructor(packedJS) {
    __publicField(this, "packedJS");
    this.packedJS = packedJS;
  }
  // returns true if the input looks like p.a.c.k.e.r encoded js
  detect() {
    const js = this.packedJS.replace(/\s/g, "");
    return /eval\(function\(p,a,c,k,e,[rd]/.test(js);
  }
  // decodes packed js back to readable source
  unpack() {
    const js = this.packedJS;
    try {
      const regex = new RegExp("}\\s*\\('(.*)',\\s*(.*?),\\s*(\\d+),\\s*'(.*?)'\\.split\\('\\|'\\)", "s");
      const match = js.match(regex);
      if (!match || match.length !== 5) return null;
      let payload = match[1].replace(/\\'/g, "'");
      const radix = parseInt(match[2]) || 36;
      const count = parseInt(match[3]) || 0;
      const symtab = match[4].split("|");
      if (symtab.length !== count) return null;
      const unbase = new Unbase(radix);
      const wordRegex = /\b\w+\b/g;
      let decoded = payload;
      let replaceOffset = 0;
      let wordMatch;
      while ((wordMatch = wordRegex.exec(payload)) !== null) {
        const word = wordMatch[0];
        const x = unbase.unbase(word);
        const value = x < symtab.length ? symtab[x] : null;
        if (value && value.length > 0) {
          const start = wordMatch.index + replaceOffset;
          const end = start + word.length;
          decoded = decoded.substring(0, start) + value + decoded.substring(end);
          replaceOffset += value.length - word.length;
        }
      }
      return decoded;
    } catch (e) {
      return null;
    }
  }
};

// src/_utils/packed.js
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
  return ["hls2", "hls3"].filter((k) => links[k]).map((k) => resolveUrl(links[k], embedUrl));
}

// src/_utils/resolvers.js
function unpack(html) {
  const unpacker = new JsUnpacker(html);
  return unpacker.detect() ? unpacker.unpack() : null;
}
function firstM3u8(text) {
  const m = /["']?(https?:\/\/[^"'\s<>\\]+\.m3u8[^"'\s<>\\]*)["']?/i.exec(text || "");
  return m ? m[1] : null;
}
function resolveVidhide(embedUrl) {
  return __async(this, null, function* () {
    const html = yield fetchBrowserText(embedUrl, embedUrl);
    const script = unpack(html);
    if (script) {
      const links = between(script, "var links=", ";");
      if (links) {
        const urls = playableLinks(JSON.parse(links), embedUrl);
        if (urls.length) return urls.map((url) => ({ url, headers: { "User-Agent": BROWSER_UA, Referer: embedUrl } }));
      }
      const direct = /"(hls2|hls3)"\s*:\s*"([^"]+)"/.exec(script);
      if (direct) return [{ url: resolveUrl(direct[2], embedUrl), headers: { "User-Agent": BROWSER_UA, Referer: embedUrl } }];
    }
    return [];
  });
}
function resolveStreamWish(embedUrl) {
  return __async(this, null, function* () {
    const target = vibuxerUrl(embedUrl);
    const html = yield fetchBrowserText(target, target);
    const script = unpack(html);
    const links = script && between(script, "var links=", ";");
    if (!links) return [];
    return playableLinks(JSON.parse(links), target).map((url) => ({ url, headers: { "User-Agent": BROWSER_UA, Referer: target } }));
  });
}
function resolveVimeos(embedUrl) {
  return __async(this, null, function* () {
    const html = yield fetchBrowserText(embedUrl, "https://vimeos.net/");
    const script = unpack(html) || html;
    const m = /["']([^"']+\.m3u8[^"']*)['"]/i.exec(script);
    if (!m) return [];
    const master = resolveUrl(m[1], embedUrl);
    const headers = { "User-Agent": BROWSER_UA };
    return [{ url: yield bestVariant(master, headers), headers }];
  });
}
function bestVariant(masterUrl, headers) {
  return __async(this, null, function* () {
    let body;
    try {
      body = yield fetchBrowserText(masterUrl);
    } catch (e) {
      return masterUrl;
    }
    const lines = body.split("\n");
    const variants = [];
    lines.forEach((line, i) => {
      if (line.indexOf("#EXT-X-STREAM-INF") !== 0) return;
      const bandwidth = /BANDWIDTH=(\d+)/.exec(line);
      const uri = lines.slice(i + 1).filter((l) => l && l.charAt(0) !== "#")[0];
      if (uri) variants.push({ bandwidth: bandwidth ? parseInt(bandwidth[1], 10) : 0, url: resolveUrl(uri.trim(), masterUrl) });
    });
    if (variants.length < 2) return masterUrl;
    variants.sort((a, b) => b.bandwidth - a.bandwidth);
    return variants[0].url;
  });
}
function resolveGoodstream(embedUrl) {
  return __async(this, null, function* () {
    const html = yield fetchBrowserText(embedUrl, "https://goodstream.one/");
    const unpacked = unpack(html) || html;
    const file = /file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i.exec(unpacked);
    const url = file ? file[1] : firstM3u8(unpacked);
    if (!url) return [];
    return [{ url, headers: { "User-Agent": BROWSER_UA, Referer: "https://goodstream.one/" } }];
  });
}
function resolveUqload(embedUrl) {
  return __async(this, null, function* () {
    const html = yield fetchBrowserText(embedUrl, "https://uqload.com/");
    const unpacked = unpack(html) || html;
    const url = firstM3u8(unpacked);
    if (!url) return [];
    return [{ url, headers: { "User-Agent": BROWSER_UA, Referer: "https://uqload.com/" } }];
  });
}
function resolveAudinifer(embedUrl) {
  return __async(this, null, function* () {
    const html = yield fetchBrowserText(embedUrl, embedUrl);
    const unpacked = unpack(html) || html;
    const file = /(?:file|src)\s*[:=]\s*["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/i.exec(unpacked);
    const url = file ? file[1] : firstM3u8(unpacked);
    if (!url) return [];
    return [{ url, headers: { "User-Agent": BROWSER_UA, Referer: embedUrl } }];
  });
}
function resolveVoe(embedUrl) {
  return __async(this, null, function* () {
    const html = yield fetchBrowserText(embedUrl, embedUrl);
    const redirected = /window\.location\.href\s*=\s*["']([^"']+)["']/i.exec(html);
    if (redirected && html.length < 4e3) return resolveVoe(redirected[1]);
    const scriptJson = /<script type="application\/json">([\s\S]*?)<\/script>/.exec(html);
    if (scriptJson) {
      let encoded = null;
      try {
        encoded = JSON.parse(scriptJson[1].trim());
        if (Array.isArray(encoded)) encoded = encoded[0];
      } catch (e) {
        encoded = null;
      }
      if (typeof encoded === "string") {
        const url = decodeVoe(encoded);
        if (url) return [{ url, headers: { "User-Agent": BROWSER_UA, Referer: embedUrl } }];
      }
    }
    const raw = firstM3u8(html);
    if (!raw) return [];
    return [{ url: raw, headers: { "User-Agent": BROWSER_UA, Referer: embedUrl } }];
  });
}
function decodeVoe(encoded) {
  try {
    let text = encoded.replace(/[a-zA-Z]/g, (c) => {
      const code = c.charCodeAt(0);
      const limit = c <= "Z" ? 90 : 122;
      const shifted2 = code + 13;
      return String.fromCharCode(limit >= shifted2 ? shifted2 : shifted2 - 26);
    });
    ["@$", "^^", "~@", "%?", "*~", "!!", "#&"].forEach((noise) => {
      text = text.split(noise).join("");
    });
    const first = decodeBase64(text);
    let shifted = "";
    for (let i = 0; i < first.length; i++) shifted += String.fromCharCode(first.charCodeAt(i) - 3);
    const payload = JSON.parse(decodeBase64(shifted.split("").reverse().join("")));
    return payload && (payload.source || payload.direct_access_url) || null;
  } catch (e) {
    return null;
  }
}
function resolveDood(embedUrl) {
  return __async(this, null, function* () {
    const host = (embedUrl.match(/^(https?:\/\/[^/]+)/) || [])[1] || "https://dood.to";
    const html = yield fetchBrowserText(embedUrl, embedUrl);
    const path = /\$\.get\(\s*["']\/pass_md5\/([^"']+)["']/.exec(html);
    if (!path) {
      const direct = firstM3u8(html);
      return direct ? [{ url: direct, headers: { "User-Agent": BROWSER_UA, Referer: embedUrl } }] : [];
    }
    const token = (yield fetchBrowserText(host + "/pass_md5/" + path[1], embedUrl)).trim();
    if (!token) return [];
    const random = Math.random().toString(36).slice(2, 12);
    return [{ url: token + random + "?token=" + path[1] + "&expiry=" + Date.now(), headers: { "User-Agent": BROWSER_UA, Referer: host + "/" } }];
  });
}
function resolveOkru(embedUrl) {
  return __async(this, null, function* () {
    const id = /(?:ok\.ru|odnoklassniki\.ru)\/(?:videoembed|video|live)\/(\d+)/i.exec(embedUrl) || /[?&]mid=(\d+)/i.exec(embedUrl);
    if (!id) return [];
    const response = yield fetch("https://www.ok.ru/dk", {
      method: "POST",
      headers: {
        "User-Agent": BROWSER_UA,
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: "https://ok.ru/videoembed/" + id[1],
        Origin: "https://ok.ru"
      },
      body: "cmd=videoPlayerMetadata&mid=" + id[1]
    });
    const data = yield response.json().catch(() => null);
    if (!data || data.error) return [];
    const url = data.hlsManifestUrl || data.hlsMasterPlaylistUrl || data.videos && data.videos[0] && data.videos[0].url;
    if (!url) return [];
    return [{ url, headers: { "User-Agent": BROWSER_UA, Referer: "https://ok.ru/" } }];
  });
}
var BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
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
function unwrapEmbedShortener(url) {
  if (!/embedshortener\.|fkplayer\./i.test(String(url || ""))) return null;
  const token = String(url).split("/e/").pop().split(/[?#]/)[0];
  const parts = token.split(".");
  if (parts.length < 2) return null;
  let payload = null;
  try {
    payload = JSON.parse(decodeBase64(parts[1]));
  } catch (e) {
    return null;
  }
  if (!payload) return null;
  if (payload.embed && /^https?:/i.test(payload.embed)) return payload.embed;
  if (payload.link) {
    const decoded = decodeBase64(payload.link);
    if (/^https?:/i.test(decoded)) return decoded;
  }
  return null;
}
var VIDHIDE_HOSTS = /vidhide|dintezuvio|minochinos|morencius|movearnpre|luluvdo|filelions/;
var STREAMWISH_HOSTS = /streamwish|hlswish|hglink|hglamioz|strwish|wishfast|awish|flaswish|wishembed|dhcplay|vibuxer/;
function resolverFor(embedUrl) {
  const host = hostOf(embedUrl);
  const shortener = unwrapEmbedShortener(embedUrl);
  if (shortener) return resolverFor(shortener);
  if (host.indexOf("vimeos") >= 0) return { key: "vimeos", server: "Vimeos", resolve: resolveVimeos };
  if (STREAMWISH_HOSTS.test(host)) return { key: "streamwish", server: "Streamwish", resolve: resolveStreamWish };
  if (VIDHIDE_HOSTS.test(host)) return { key: "vidhide", server: "Vidhide", resolve: resolveVidhide };
  if (host.indexOf("voe") >= 0) return { key: "voe", server: "VOE", resolve: resolveVoe, dynamic: true };
  if (host.indexOf("goodstream") >= 0) return { key: "goodstream", server: "GoodStream", resolve: resolveGoodstream, dynamic: true };
  if (host.indexOf("uqload") >= 0 || host.indexOf("oneupload") >= 0) return { key: "uqload", server: "Uqload", resolve: resolveUqload, dynamic: true };
  if (host.indexOf("audinifer") >= 0) return { key: "audinifer", server: "Audinifer", resolve: resolveAudinifer, dynamic: true };
  if (/ok\.ru|okcdn|odnoklassniki/.test(host)) return { key: "okru", server: "OK.ru", resolve: resolveOkru, dynamic: true };
  if (/doodstream|dood\.|ds2play/.test(host)) return { key: "dood", server: "Doodstream", resolve: resolveDood, dynamic: true };
  return null;
}

// src/_utils/quality.js
var TIER_PRIORITY = ["x", "o", "h", "n", "l"];
var TIERS = {
  vimeos: { x: "1080p", o: "1080p", h: "720p", n: "480p", l: "360p" },
  streamwish: { x: "1080p", o: "1080p", h: "1080p", n: "720p", l: "480p" },
  vidhide: { x: "1080p", o: "1080p", h: "720p", n: "480p", l: "360p" }
};
function inferQuality(url, server) {
  const tiers = TIERS[server] || {};
  const set = /_,([a-z,]+),\.urlset/.exec(url);
  if (set) {
    const available = set[1].split(",");
    for (let i = 0; i < TIER_PRIORITY.length; i++) {
      const tier = TIER_PRIORITY[i];
      if (available.indexOf(tier) >= 0 && tiers[tier]) return tiers[tier];
    }
  }
  const labelled = /[_\-/](\d{3,4})p/.exec(url);
  return labelled ? labelled[1] + "p" : "Auto";
}

// src/_utils/formatters.js
var SEPARATOR = " \u2022 ";
function serverWithIndex(fields) {
  if (!fields.server) return "";
  return fields.index > 1 ? fields.server + " " + fields.index : fields.server;
}
var join = (parts) => parts.filter(Boolean).join(SEPARATOR);
var FORMATTERS = {
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
    name: (fields) => join([fields.provider, fields.language, serverWithIndex(fields), fields.quality && fields.quality !== "Auto" ? String(fields.quality).toUpperCase() : ""]),
    title: (fields) => fields.language,
    quality: (fields) => fields.quality
  }
};
var DEFAULT_FORMATTER = "standard";
function formatStream(fields, name = DEFAULT_FORMATTER) {
  const formatter = FORMATTERS[name] || FORMATTERS[DEFAULT_FORMATTER];
  return {
    name: formatter.name(fields),
    title: formatter.title(fields),
    quality: formatter.quality(fields)
  };
}

// src/_utils/labels.js
function labeled(provider, language, server, found) {
  return found.map((stream, i) => {
    const quality = stream.quality || "Auto";
    return Object.assign(
      formatStream({ provider, language, server, quality, index: i + 1 }),
      { url: stream.url, headers: stream.headers }
    );
  });
}
function groupByLanguage(embeds, order) {
  const seen = [];
  embeds.forEach((embed) => {
    if (seen.indexOf(embed.language) < 0) seen.push(embed.language);
  });
  const known = order.filter((lang) => seen.indexOf(lang) >= 0);
  const rest = seen.filter((lang) => order.indexOf(lang) < 0);
  return known.concat(rest).map((lang) => ({
    language: lang,
    embeds: embeds.filter((embed) => embed.language === lang)
  }));
}
function resolveFirstLanguage(groups, index, resolveEmbed2) {
  return __async(this, null, function* () {
    if (index >= groups.length) return [];
    const streams = yield Promise.all(groups[index].embeds.map(resolveEmbed2));
    const found = streams.reduce((all, list) => all.concat(list), []);
    return found.length ? found : resolveFirstLanguage(groups, index + 1, resolveEmbed2);
  });
}

// src/areshd/extractor.js
var PROVIDER_NAME = "AresHD";
var HOST = "https://areshd.com";
var LANGUAGE_ORDER = ["Latino", "Espa\xF1ol", "Subtitulado"];
var LANGUAGES = { latino: "Latino", castellano: "Espa\xF1ol", "espa\xF1ol": "Espa\xF1ol", subtitulado: "Subtitulado", vose: "Subtitulado" };
function slugToTitle(text) {
  return String(text || "").replace(/-/g, " ").trim();
}
function search(query, mediaType) {
  return __async(this, null, function* () {
    const kind = mediaType === "movie" ? "pelicula" : "serie";
    const html = yield fetchBrowserText(HOST + "/search/" + encodeURIComponent(query).replace(/%20/g, "+"));
    const pattern = new RegExp('href="/(' + kind + ')/([^"/]+)"', "g");
    const found = [];
    let m;
    while (m = pattern.exec(html)) {
      const slug = m[2];
      if (found.some((entry) => entry.slug === slug)) continue;
      found.push({ slug, kind: m[1], title: slugToTitle(slug) });
    }
    return found;
  });
}
function pageUrl(slug, mediaType, season, episode) {
  if (mediaType === "movie") return HOST + "/pelicula/" + slug;
  return HOST + "/episodio/" + slug + "-temporada-" + parseInt(season, 10) + "-episodio-" + parseInt(episode, 10);
}
function parsePage(html) {
  const languages = [...html.matchAll(/<li class="pres"><a class="playr">([^<]+)<\/a><\/li>/g)].map((m) => LANGUAGES[m[1].trim().toLowerCase()] || m[1].trim());
  const blocks = [...html.matchAll(/<ul class="TbVideoNv nav nav-tabs hide"[^>]*>([\s\S]*?)<\/ul>/g)].map((m) => m[1]);
  const embeds = [];
  blocks.forEach((block, index) => {
    const language = languages[index] || languages[0] || "Latino";
    const servers = [...block.matchAll(/<li class="pres"[^>]*data-tr="([^"]+)"[^>]*>[\s\S]*?<a class="playr">([^<]+)<\/a>/g)];
    servers.forEach((server) => {
      const label = server[2].trim().toLowerCase();
      if (label.indexOf("youtube") >= 0) return;
      embeds.push({ language, label, playerUrl: server[1] });
    });
  });
  return embeds;
}
function playerEmbed(playerUrl, referer) {
  return __async(this, null, function* () {
    const html = yield fetchBrowserText(playerUrl, referer);
    const m = /var\s+url\s*=\s*['"]([^'"]+)['"]/.exec(html) || /https?:\/\/[^"'\s]+\.(?:m3u8|mp4)[^"'\s]*/.exec(html);
    return m ? m[1] : null;
  });
}
function resolveEmbed(embed) {
  return __async(this, null, function* () {
    const resolver = resolverFor(embed.url);
    if (!resolver) return [];
    try {
      const found = yield resolver.resolve(embed.url);
      found.forEach((stream) => {
        stream.quality = inferQuality(stream.url, resolver.key);
      });
      return labeled(PROVIDER_NAME, embed.language, resolver.server, found);
    } catch (e) {
      return [];
    }
  });
}
function extractStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    const meta = yield titlesFor(tmdbId, mediaType);
    let candidates = [];
    for (const title of meta.titles.slice(0, 3)) {
      candidates = candidates.concat(yield search(title, mediaType).catch(() => []));
      if (candidates.length) break;
    }
    const match = bestTitleMatch(meta.titles, meta.year, candidates, {});
    if (!match) return [];
    const page = pageUrl(match.slug, mediaType, season, episode);
    const html = yield fetchBrowserText(page, HOST + "/");
    const entries = parsePage(html);
    const withEmbeds = [];
    for (const entry of entries) {
      const url = yield playerEmbed(entry.playerUrl, page).catch(() => null);
      if (url) withEmbeds.push({ language: entry.language, url });
    }
    const usable = withEmbeds.filter((embed) => resolverFor(embed.url));
    return resolveFirstLanguage(groupByLanguage(usable, LANGUAGE_ORDER), 0, resolveEmbed);
  });
}
var _test = {
  search,
  pageUrl,
  parsePage,
  playerEmbed,
  resolverFor,
  groupByLanguage: (embeds) => groupByLanguage(embeds, LANGUAGE_ORDER)
};

// src/areshd/log.js
function log() {
  const args = Array.from(arguments);
  let method = "log";
  if (["error", "warn", "info", "debug"].includes(args[0])) {
    method = args[0];
    args.shift();
  }
  console[method](`[${PROVIDER_NAME}]`, ...args);
}

// src/areshd/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      log(mediaType === "movie" ? `Request: ${mediaType} ${tmdbId}` : `Request: ${mediaType} ${tmdbId}: S${season}E${episode}`);
      return yield extractStreams(tmdbId, mediaType, season, episode);
    } catch (error) {
      log("warn", error.message);
      return [];
    }
  });
}
var _testAll = _test;
