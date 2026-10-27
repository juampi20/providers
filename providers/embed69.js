/**
 * embed69 - Built from src/embed69/ by build.js - do not edit by hand
 */
var __create = Object.create;
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
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

// src/embed69/index.js
var index_exports = {};
__export(index_exports, {
  _test: () => _testAll,
  _testAll: () => _testAll,
  getStreams: () => getStreams,
  onSettings: () => onSettings
});
module.exports = __toCommonJS(index_exports);

// src/embed69/extractor.js
var import_crypto_js = __toESM(require("crypto-js"));

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
function unpack(html) {
  const unpacker = new JsUnpacker(html);
  return unpacker.detect() ? unpacker.unpack() : null;
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
  return ["hls2", "hls3"].filter((k) => links[k]).map((k) => resolveUrl(links[k], embedUrl));
}

// src/_utils/resolvers.js
function unpack2(html) {
  const unpacker = new JsUnpacker(html);
  return unpacker.detect() ? unpacker.unpack() : null;
}
function resolveVidhide(embedUrl) {
  return __async(this, null, function* () {
    const html = yield fetchBrowserText(embedUrl, embedUrl);
    const script = unpack2(html);
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
    const script = unpack2(html);
    const links = script && between(script, "var links=", ";");
    if (!links) return [];
    return playableLinks(JSON.parse(links), target).map((url) => ({ url, headers: { "User-Agent": BROWSER_UA, Referer: target } }));
  });
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

// src/_utils/labels.js
var LABEL_SEPARATOR = " \u2022 ";
function labeled(provider, language, server, found) {
  return found.map((stream, i) => {
    const parts = [provider];
    if (stream.quality && stream.quality !== "Auto") parts.push(String(stream.quality).toUpperCase());
    if (server) parts.push(server);
    return {
      name: parts.join(LABEL_SEPARATOR),
      title: language + (i ? " " + (i + 1) : ""),
      url: stream.url,
      quality: stream.quality || "Auto",
      headers: stream.headers
    };
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

// src/_utils/tmdb.js
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

// src/embed69/extractor.js
var PROVIDER_NAME = "Embed69";
var EMBED_BASE = "https://embed69.org/video/";
var WIKIDATA_UA = "nuvio-providers/1.0 (https://github.com/juampi20/providers)";
var LANGUAGES = { LAT: "Latino", ESP: "Castellano", SUB: "Subtitulado" };
var LANGUAGE_ORDER = ["LAT", "ESP", "SUB"];
var SERVERS = { vidhide: "Vidhide", streamwish: "Streamwish" };
function getImdbId(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const key = tmdbApiKey();
    if (!key) return getImdbIdFromWikidata(tmdbId, mediaType);
    const path = mediaType === "movie" ? "/movie/" + tmdbId : "/tv/" + tmdbId + "/external_ids";
    const data = yield fetchBrowserJson("https://api.themoviedb.org/3" + path + "?api_key=" + encodeURIComponent(key));
    return data && data.imdb_id || getImdbIdFromWikidata(tmdbId, mediaType);
  });
}
function getImdbIdFromWikidata(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const prop = mediaType === "movie" ? "P4947" : "P4983";
    const query = "SELECT ?imdb WHERE { ?item wdt:" + prop + ' "' + String(tmdbId).replace(/\D/g, "") + '"; wdt:P345 ?imdb } LIMIT 1';
    const response = yield fetch("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query), { headers: { "User-Agent": WIKIDATA_UA } });
    const data = yield response.json();
    const row = data && data.results && data.results.bindings[0];
    return row ? row.imdb.value : null;
  });
}
function embedId(imdbId, mediaType, season, episode) {
  if (mediaType === "movie") return imdbId;
  return imdbId + "-" + season + "x" + String(episode).padStart(2, "0");
}
function deriveKey(challenge, difficulty, salt) {
  const prefix = "0".repeat(difficulty);
  let nonce = 0;
  while (import_crypto_js.default.SHA256(challenge + nonce).toString().indexOf(prefix) !== 0) nonce++;
  return import_crypto_js.default.SHA256(challenge + nonce + salt);
}
function decrypt(base64, key) {
  try {
    const raw = import_crypto_js.default.enc.Base64.parse(base64);
    const iv = import_crypto_js.default.lib.WordArray.create(raw.words.slice(0, 4), 16);
    const ciphertext = import_crypto_js.default.lib.WordArray.create(raw.words.slice(4), raw.sigBytes - 16);
    const plain = import_crypto_js.default.AES.decrypt({ ciphertext }, key, {
      iv,
      mode: import_crypto_js.default.mode.CBC,
      padding: import_crypto_js.default.pad.Pkcs7
    }).toString(import_crypto_js.default.enc.Utf8);
    return plain || null;
  } catch (e) {
    return null;
  }
}
function parseEmbedPage(html) {
  const challenge = between(html, "const POW_CHALLENGE = '", "';");
  const difficulty = parseInt(between(html, "const POW_DIFFICULTY = ", ";"), 10);
  const salt = between(html, "const POW_SALT = '", "';");
  const dataLink = between(html, "dataLink = ", ";");
  if (!challenge || isNaN(difficulty) || salt === null || !dataLink) return [];
  const key = deriveKey(challenge, difficulty, salt);
  const result = [];
  JSON.parse(dataLink).forEach((lang) => {
    (lang.sortedEmbeds || []).forEach((embed) => {
      const url = embed.link && decrypt(embed.link, key);
      if (url) result.push({ language: lang.video_language, server: embed.servername, url });
    });
  });
  return result;
}
function parseVideoPage(html) {
  const languages = {};
  html.replace(/<li class="SLD_[A-Z]" data-lang="(\d+)">\s*<img src="[^"]*\/lang\/([A-Z]+)\.png/g, (m, index, lang) => {
    languages[index] = lang;
  });
  const result = [];
  html.replace(/playServerVast\('([^']+)'\);" data-lang="(\d+)"/g, (m, url, index) => {
    const host = hostOf(url);
    const server = host.indexOf("vidhide") >= 0 ? "vidhide" : /streamwish|hglink/.test(host) ? "streamwish" : host;
    result.push({ language: languages[index] || "LAT", server, url });
  });
  return result;
}
function parsePage(html) {
  return parseEmbedPage(html).concat(parseVideoPage(html));
}
function playableEmbed(embed) {
  if (embed.server === "vidhide") return embed.url;
  if (embed.server === "streamwish") return vibuxerUrl(embed.url);
  return null;
}
function resolveEmbed(embed) {
  return __async(this, null, function* () {
    const embedUrl = playableEmbed(embed);
    try {
      const found = embed.server === "streamwish" ? yield resolveStreamWish(embedUrl) : yield resolveVidhide(embedUrl);
      found.forEach((stream) => {
        stream.quality = inferQuality(stream.url, embed.server);
      });
      return labeled(PROVIDER_NAME, LANGUAGES[embed.language] || embed.language, SERVERS[embed.server], found);
    } catch (e) {
      return [];
    }
  });
}
function extractStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    const imdbId = yield getImdbId(tmdbId, mediaType);
    if (!imdbId) throw new Error("No IMDB id for TMDB " + tmdbId);
    const html = yield fetchBrowserText(EMBED_BASE + embedId(imdbId, mediaType, season, episode), "https://sololatino.net/");
    const embeds = parsePage(html).filter((embed) => playableEmbed(embed));
    return resolveFirstLanguage(groupByLanguage(embeds, LANGUAGE_ORDER), 0, resolveEmbed);
  });
}
function extractHls(url) {
  return __async(this, null, function* () {
    const found = yield resolveVidhide(url);
    return found.map((stream) => stream.url);
  });
}
var _test = {
  getImdbId,
  parseEmbedPage,
  parseVideoPage,
  parsePage,
  embedId,
  playableEmbed,
  extractHls,
  groupByLanguage: (embeds) => groupByLanguage(embeds, LANGUAGE_ORDER)
};

// src/embed69/log.js
function log() {
  const args = Array.from(arguments);
  let method = "log";
  if (["error", "warn", "info", "debug"].includes(args[0])) {
    method = args[0];
    args.shift();
  }
  console[method](`[${PROVIDER_NAME}]`, ...args);
}

// src/embed69/index.js
function onSettings() {
  return tmdbSettings("Optional. Needed on Nuvio builds that do not share their TMDB key with plugins; without it, titles missing from Wikidata are not found.");
}
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
var _testAll = Object.assign({ onSettings, unpack, playableLinks }, _test);
