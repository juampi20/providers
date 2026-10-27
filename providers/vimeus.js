/**
 * vimeus - Built from src/vimeus/ by build.js - do not edit by hand
 */
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
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

// src/vimeus/index.js
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
function packedLinks(embedUrl, referer) {
  return __async(this, null, function* () {
    const html = yield fetchBrowserText(embedUrl, referer);
    const script = unpack(html);
    const links = script && between(script, "var links=", ";");
    if (!links) return [];
    return playableLinks(JSON.parse(links), embedUrl).map((url) => ({
      url,
      headers: { "User-Agent": BROWSER_UA, Referer: referer }
    }));
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
  return __async(this, null, function* () {
    const referer = "https://vimeos.net/";
    const html = yield fetchBrowserText(embedUrl, referer);
    const script = unpack(html) || html;
    const m = /["']([^"']+\.m3u8[^"']*)['"]/i.exec(script);
    if (!m) return [];
    return [{ url: resolveUrl(m[1], embedUrl), headers: { "User-Agent": BROWSER_UA, Referer: referer } }];
  });
}
var RESOLVERS = {
  vimeos: { key: "vimeos", server: "Vimeos", resolve: resolveVimeos },
  streamwish: { key: "streamwish", server: "Streamwish", resolve: resolveStreamWish },
  vidhide: { key: "vidhide", server: "Vidhide", resolve: resolveVidhide }
};
function resolverFor(embedUrl) {
  const host = hostOf(embedUrl);
  if (host.indexOf("vimeos") >= 0) return RESOLVERS.vimeos;
  if (/streamwish|hlswish|hglink|strwish/.test(host)) return RESOLVERS.streamwish;
  if (/vidhide|dintezuvio|filelions/.test(host)) return RESOLVERS.vidhide;
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

// src/vimeus/extractor.js
var PROVIDER_NAME = "Vimeus";
var BASE = "https://vimeus.com";
var VIEW_KEY = "ttapaNFkp2YbIFMawxmnqCPcs0pRVzbjrI5r1-da5M4";
var LANGUAGE = "Latino";
function embedPageUrl(tmdbId, mediaType, season, episode) {
  const query = "?tmdb=" + encodeURIComponent(tmdbId) + (mediaType === "movie" ? "" : "&se=" + season + "&ep=" + episode);
  const path = mediaType === "movie" ? "/e/movie" : "/e/serie";
  return BASE + path + query + "&view_key=" + VIEW_KEY;
}
function parseDataScript(html) {
  const m = /<script[^>]*type=["']text\/json["'][^>]*id=["']data["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch (e) {
    return null;
  }
}
function payloadEmbeds(payload) {
  return (payload && payload.embeds || []).map((embed) => {
    const url = String(embed && embed.url || "");
    if (!url) return null;
    const absolute = url.indexOf("//") === 0 ? "https:" + url : url;
    return /^https?:\/\//.test(absolute) ? { url: absolute, server: embed.server || "" } : null;
  }).filter(Boolean);
}
function fetchPayload(url) {
  return __async(this, null, function* () {
    const response = yield fetch(url, { headers: browserHeaders(BASE + "/") });
    if (!response.ok) {
      if (response.status === 400) throw new Error("view_key rechazada (400): el sitio rot\xF3 VIEW_KEY");
      throw new Error("HTTP " + response.status + " for " + url);
    }
    const payload = parseDataScript(yield response.text());
    if (!payload) throw new Error("la p\xE1gina no trae el bloque text/json de datos");
    return payload;
  });
}
function streamsFrom(embedUrl) {
  return __async(this, null, function* () {
    const resolver = resolverFor(embedUrl);
    if (!resolver) return [];
    try {
      const found = yield resolver.resolve(embedUrl);
      found.forEach((stream) => {
        stream.quality = inferQuality(stream.url, resolver.key);
      });
      return labeled(PROVIDER_NAME, LANGUAGE, resolver.server, found);
    } catch (e) {
      return [];
    }
  });
}
function extractStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    const payload = yield fetchPayload(embedPageUrl(tmdbId, mediaType, season, episode));
    const embeds = payloadEmbeds(payload).filter((embed) => resolverFor(embed.url));
    if (!embeds.length) return [];
    const lists = yield Promise.all(embeds.map((embed) => streamsFrom(embed.url)));
    return lists.reduce((all, list) => all.concat(list), []);
  });
}
var _test = {
  embedPageUrl,
  parseDataScript,
  payloadEmbeds,
  fetchPayload,
  resolverFor,
  playableLinks,
  unpack,
  resolveVimeos,
  resolveStreamWish,
  inferQuality
};

// src/vimeus/log.js
function log() {
  const args = Array.from(arguments);
  let method = "log";
  if (["error", "warn", "info", "debug"].includes(args[0])) {
    method = args[0];
    args.shift();
  }
  console[method](`[${PROVIDER_NAME}]`, ...args);
}

// src/vimeus/index.js
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
