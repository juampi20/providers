/**
 * entrepeliculasyseries - Built from src/entrepeliculasyseries/ by build.js - do not edit by hand
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

// src/entrepeliculasyseries/index.js
var index_exports = {};
__export(index_exports, {
  _test: () => _testAll,
  _testAll: () => _testAll,
  getStreams: () => getStreams
});
module.exports = __toCommonJS(index_exports);

// src/_utils/pow.js
var import_crypto_js = __toESM(require("crypto-js"));

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

// src/_utils/pow.js
function deriveKey(challenge, difficulty, salt) {
  const prefix = "0".repeat(difficulty);
  let nonce = 0;
  while (import_crypto_js.default.SHA256(challenge + nonce).toString().indexOf(prefix) !== 0) nonce++;
  return import_crypto_js.default.SHA256(challenge + nonce + salt);
}
function decryptLink(base64, key) {
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
function dataLinkOf(html) {
  const raw = between(html, "dataLink = ", ";");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}
function hasPuzzle(html) {
  return /POW_CHALLENGE\s*=/.test(html) && /POW_DIFFICULTY\s*=/.test(html);
}
function parsePowPage(html, options = {}) {
  const challenge = between(html, "const POW_CHALLENGE = '", "';") || between(html, 'POW_CHALLENGE = "', '";');
  const difficulty = parseInt(between(html, "const POW_DIFFICULTY = ", ";") || between(html, "POW_DIFFICULTY = ", ";"), 10);
  const salt = between(html, "const POW_SALT = '", "';") || between(html, 'POW_SALT = "', '";');
  const blocks = dataLinkOf(html);
  if (!challenge || isNaN(difficulty) || salt === null || !blocks) return [];
  const key = deriveKey(challenge, difficulty, salt);
  const result = [];
  blocks.forEach((block) => {
    (block.sortedEmbeds || []).forEach((embed) => {
      if (embed.type && embed.type !== "video") return;
      if (options.skipServers && options.skipServers.test(embed.servername || "")) return;
      const url = embed.link && decryptLink(embed.link, key);
      if (url && /^https?:\/\//.test(url)) {
        result.push({ language: block.video_language, server: embed.servername, url });
      }
    });
  });
  return result;
}
var POW_LANGUAGES = { LAT: "Latino", ESP: "Castellano", SUB: "Subtitulado" };
var POW_LANGUAGE_ORDER = ["LAT", "ESP", "SUB"];
function fetchPowEmbeds(host, path) {
  return __async(this, null, function* () {
    const response = yield fetch(host + path, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,*/*",
        "Accept-Language": "es-MX,es;q=0.9",
        Referer: host + "/"
      }
    });
    if (!response.ok) throw new Error("HTTP " + response.status + " for " + host + path);
    const html = yield response.text();
    if (!hasPuzzle(html)) {
      if (html.length < 2e3) return [];
      throw new Error("la p\xE1gina no trae el puzzle PoW (\xBFcambi\xF3 el sitio?)");
    }
    return parsePowPage(html, { skipServers: /filemoon|1fichier|fireload/i });
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
function imdbIdFor(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const key = tmdbApiKey();
    if (!key) throw new Error("No TMDB API key: this provider resolves the IMDb id from TMDB");
    const path = mediaType === "movie" ? "/movie/" + tmdbId : "/tv/" + tmdbId + "/external_ids";
    const data = yield tmdbGet(path, key);
    return data && data.imdb_id || null;
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

// src/_utils/mp4.js
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var WINDOW = 65536;
function readTkhd(bytes) {
  const view = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let searchFrom = 0;
  while (searchFrom < view.length) {
    const at = view.indexOf("tkhd", searchFrom, "latin1");
    if (at < 0) return null;
    const size = view.readUInt32BE(at - 4);
    const end = at - 4 + size;
    if (size >= 84 && end <= view.length) {
      const width = view.readUInt32BE(end - 8) / 65536;
      const height = view.readUInt32BE(end - 4) / 65536;
      if (width >= 100 && height >= 100) return { width, height };
    }
    searchFrom = at + 4;
  }
  return null;
}
function heightLabel(height) {
  if (height >= 2e3) return "4K";
  if (height >= 1e3) return "1080p";
  if (height >= 700) return "720p";
  if (height >= 460) return "480p";
  if (height > 0) return "360p";
  return "Auto";
}
function mp4Resolution(url, headers) {
  return __async(this, null, function* () {
    const ranges = [{ Range: "bytes=0-" + (WINDOW - 1) }, { Range: "bytes=-" + WINDOW }];
    for (const range of ranges) {
      let response;
      try {
        response = yield fetch(url, { headers: Object.assign({ "User-Agent": UA }, headers || {}, range) });
      } catch (e) {
        return null;
      }
      if (!response.ok) continue;
      if (response.status !== 206) {
        return null;
      }
      const buffer = new Uint8Array(yield response.arrayBuffer());
      const size = readTkhd(buffer);
      if (size) return size;
    }
    return null;
  });
}

// src/_utils/variants.js
var labelForHeight = heightLabel;
function isDirectFile(url) {
  return !/(\.m3u8|\.txt(\?|$)|\/m3u8\/)/i.test(String(url));
}
function bestPlayable(url) {
  return __async(this, null, function* () {
    let body;
    try {
      body = yield fetchBrowserText(url);
    } catch (e) {
      return { url, quality: "Auto", height: 0 };
    }
    if (body.indexOf("#EXT-X-STREAM-INF") < 0) {
      return { url, quality: inferQuality(url), height: 0 };
    }
    const lines = body.split("\n");
    let best = null;
    lines.forEach((line2, i) => {
      if (line2.indexOf("#EXT-X-STREAM-INF") !== 0) return;
      const uri = lines.slice(i + 1).filter((next) => next && next.charAt(0) !== "#")[0];
      if (!uri) return;
      const resolution = /RESOLUTION=(\d+)x(\d+)/.exec(line2);
      const bandwidth = /BANDWIDTH=(\d+)/.exec(line2);
      const height = resolution ? parseInt(resolution[2], 10) : 0;
      const bitrate = bandwidth ? parseInt(bandwidth[1], 10) : 0;
      const score = height * 1e6 + bitrate;
      if (!best || score > best.score) best = { url: resolveUrl(uri.trim(), url), height, score };
    });
    if (!best) return { url, quality: "Auto", height: 0 };
    return { url: best.url, quality: labelForHeight(best.height), height: best.height };
  });
}
function withRealQuality(found) {
  return __async(this, null, function* () {
    return Promise.all(found.map((stream) => __async(null, null, function* () {
      if (isDirectFile(stream.url)) {
        const size = yield mp4Resolution(stream.url, stream.headers).catch(() => null);
        const quality = size ? labelForHeight(size.height) : inferQuality(stream.url);
        return {
          url: stream.url,
          headers: stream.headers,
          quality,
          resolution: size ? size.width + "x" + size.height : "",
          protocol: "mp4",
          kind: "direct",
          best: !!size && size.height >= 720
        };
      }
      const resolved = yield bestPlayable(stream.url);
      return {
        url: resolved.url,
        headers: stream.headers,
        quality: resolved.quality,
        resolution: resolved.height ? "x" + resolved.height : "",
        protocol: "hls",
        kind: "web",
        best: !!resolved.height && resolved.height >= 1080
      };
    })));
  });
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
    return [{ url: resolveUrl(m[1], embedUrl), headers: { "User-Agent": BROWSER_UA } }];
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
function resolveVimeusEmbed(embedUrl) {
  return __async(this, null, function* () {
    const html = yield fetchBrowserText(embedUrl, "https://vimeus.com/");
    const m = /<script[^>]*type=["']text\/json["'][^>]*id=["']data["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
    if (!m) return [];
    let payload;
    try {
      payload = JSON.parse(m[1]);
    } catch (e) {
      return [];
    }
    const inner = (payload.embeds || []).map((embed) => String(embed && embed.url || "")).filter((url) => /^https?:\/\//.test(url) && hostOf(url).indexOf("vimeus") < 0);
    for (const url of inner) {
      const resolver = resolverFor(url);
      if (resolver) return resolver.resolve(url);
    }
    return [];
  });
}
function resolveStreamtape(embedUrl) {
  return __async(this, null, function* () {
    const html = yield fetchBrowserText(embedUrl, "https://streamtape.com/");
    const parts = /innerHTML\s*=\s*["']([^"']+)["']\s*\+\s*(?:["'][^"']*["']\s*\+\s*)?["']([^"']+)["']/i.exec(html);
    if (parts) {
      return [{ url: "https:" + parts[1] + parts[2], headers: { "User-Agent": BROWSER_UA, Referer: "https://streamtape.com/" } }];
    }
    const mp4 = /https?:\/\/(?:cdn|streamtape)\.streamtape\.com\/[^"'<\s]+\.mp4[^"'<\s]*/i.exec(html);
    return mp4 ? [{ url: mp4[0], headers: { "User-Agent": BROWSER_UA, Referer: "https://streamtape.com/" } }] : [];
  });
}
function resolveFastream(embedUrl) {
  return __async(this, null, function* () {
    const html = yield fetchBrowserText(embedUrl, "https://fastream.to/");
    const unpacked = unpack(html) || html;
    const file = /file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i.exec(unpacked);
    const url = file ? file[1] : firstM3u8(unpacked);
    if (!url) return [];
    return [{ url, headers: { "User-Agent": BROWSER_UA, Referer: "https://fastream.to/" } }];
  });
}
function resolveZilla(embedUrl) {
  return __async(this, null, function* () {
    const url = String(embedUrl).replace("/play/", "/m3u8/");
    return /\/m3u8\//.test(url) ? [{ url, headers: { "User-Agent": BROWSER_UA } }] : [];
  });
}
function resolveMp4upload(embedUrl) {
  return __async(this, null, function* () {
    const html = yield fetchBrowserText(embedUrl, embedUrl);
    const file = /src\s*:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i.exec(html) || /(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i.exec(html);
    if (!file) return [];
    return [{ url: file[1], headers: { "User-Agent": BROWSER_UA, Referer: embedUrl } }];
  });
}
function resolveYourUpload(embedUrl) {
  return __async(this, null, function* () {
    const html = yield fetchBrowserText(embedUrl, "https://yourupload.com/");
    const tag = /property\s*=\s*["']og:video["'][^>]*content\s*=\s*["']([^"']+)["']/i.exec(html) || /content\s*=\s*["']([^"']+)["'][^>]*property\s*=\s*["']og:video["']/i.exec(html);
    if (!tag || tag[1].indexOf("/embed/novideo.mp4") >= 0) return [];
    return [{ url: tag[1], headers: { "User-Agent": BROWSER_UA, Referer: "https://yourupload.com/" } }];
  });
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
var STREAMWISH_HOSTS = /streamwish|hlswish|hglink|hglamioz|strwish|wishfast|awish|flaswish|wishembed|dhcplay|vibuxer|bysefu|bysedika|bysevipa/;
function resolverFor(embedUrl) {
  const base = baseResolverFor(embedUrl);
  if (!base) return null;
  return Object.assign({}, base, {
    resolve: (url) => __async(null, null, function* () {
      return withRealQuality(yield base.resolve(url));
    })
  });
}
function baseResolverFor(embedUrl) {
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
  if (/zilla-networks/.test(host)) return { key: "zilla", server: "HLS", resolve: resolveZilla };
  if (/yourupload/.test(host)) return { key: "yourupload", server: "YourUpload", resolve: resolveYourUpload, dynamic: true };
  if (/mp4upload/.test(host)) return { key: "mp4upload", server: "MP4Upload", resolve: resolveMp4upload, dynamic: true };
  if (/streamtape/.test(host)) return { key: "streamtape", server: "StreamTape", resolve: resolveStreamtape, dynamic: true };
  if (/fastream/.test(host)) return { key: "fastream", server: "Fastream", resolve: resolveFastream, dynamic: true };
  if (host.indexOf("vimeus") >= 0) return { key: "vimeus", server: "Vimeus", resolve: resolveVimeusEmbed, dynamic: true };
  if (/ok\.ru|okcdn|odnoklassniki/.test(host)) return { key: "okru", server: "OK.ru", resolve: resolveOkru, dynamic: true };
  if (/doodstream|dood\.|ds2play|do7go/.test(host)) return { key: "dood", server: "Doodstream", resolve: resolveDood, dynamic: true };
  return null;
}

// src/_utils/formatters.js
var SEPARATOR = " \u2022 ";
var GROUP_SEPARATOR = " \xB7 ";
var FORMATTERS = {
  /**
   * Como AnimES: arriba el proveedor y el episodio, abajo el servidor con el idioma y la calidad.
   * La segunda línea viaja en el campo `quality`, que es el que Nuvio dibuja debajo del nombre.
   */
  standard: {
    name: ["+star", "provider", "seasonEpisode"],
    line2: ["server", "web", "languageTag", "quality"],
    title: ["languageTag"],
    description: [["title", "year"], ["seasonEpisode"], ["languageTag", "server", "web", "quality"]]
  },
  /** Todo en el nombre y la calidad sola abajo. */
  compact: {
    name: ["+star", "provider", "seasonEpisode", "languageTag", "server"],
    line2: ["quality"],
    title: ["languageTag"],
    description: [["title", "year"], ["seasonEpisode"], ["languageTag", "server", "quality"]]
  },
  /** La calidad también arriba, para un cliente que no dibuja la segunda línea. */
  verbose: {
    name: ["+star", "provider", "seasonEpisode", "languageTag", "server", "quality"],
    line2: ["resolution"],
    title: ["languageTag"],
    description: [["title", "year"], ["seasonEpisode"], ["languageTag", "server", "quality"]]
  }
};
var DEFAULT_FORMATTER = "standard";
function partValue(part, fields) {
  if (Array.isArray(part)) {
    const inner = part.map((key) => partValue(key, fields)).filter(Boolean).join(GROUP_SEPARATOR);
    return inner;
  }
  if (part === "server" && fields.server && fields.index > 1) return fields.server + " " + fields.index;
  const value = fields[part];
  return value === void 0 || value === null ? "" : String(value);
}
function line(parts, fields) {
  const chunks = [];
  let glued = "";
  (parts || []).forEach((part) => {
    if (typeof part === "string" && part.charAt(0) === "+") {
      glued += partValue(part.slice(1), fields);
      return;
    }
    const value = partValue(part, fields);
    if (value) chunks.push(glued + value);
    glued = "";
  });
  if (glued) chunks.push(glued.trim());
  return chunks.join(SEPARATOR);
}
function formatStream(fields, name = DEFAULT_FORMATTER) {
  const formatter = FORMATTERS[name] || FORMATTERS[DEFAULT_FORMATTER];
  const description = (formatter.description || []).map((part) => line([part], fields)).filter(Boolean).join(GROUP_SEPARATOR);
  const second = (formatter.line2 || []).map((part) => partValue(part, fields)).filter(Boolean).join(GROUP_SEPARATOR);
  return {
    name: line(formatter.name, fields),
    title: line(formatter.title, fields),
    description,
    quality: second || fields.quality || "Auto",
    measuredQuality: fields.quality || "Auto"
  };
}

// src/_utils/labels.js
function rank(stream) {
  return stream.kind === "web" || stream.protocol === "hls" ? 1 : 0;
}
function seasonEpisodeOf(context) {
  if (!context || context.mediaType === "movie" || context.season === void 0 || context.season === null) return "";
  if (context.episode === void 0 || context.episode === null) return "";
  return "S" + parseInt(context.season, 10) + "E" + parseInt(context.episode, 10);
}
function labeled(provider, language, server, found, context) {
  const ordered = found.slice().sort((a, b) => rank(a) - rank(b));
  return ordered.map((stream, i) => {
    const fields = {
      provider,
      language,
      server,
      quality: stream.quality || "Auto",
      resolution: stream.resolution || "",
      protocol: stream.protocol || "",
      // Prefijo visual para la mejor fuente medida de la lista.
      star: stream.best ? "\u2B50 " : "",
      // El idioma solo se muestra cuando no es latino: en un catálogo latino es el caso normal.
      languageTag: language && language !== "Latino" ? language : "",
      // `Web` marca lo que viene de un HLS/embed, que rinde menos que un archivo directo.
      web: stream.kind === "web" || stream.protocol === "hls" ? "Web" : "",
      index: i + 1,
      title: context && context.title || "",
      year: context && context.year || "",
      seasonEpisode: seasonEpisodeOf(context)
    };
    const display = formatStream(fields);
    return {
      name: display.name,
      title: display.title,
      description: display.description,
      quality: display.quality,
      url: stream.url,
      headers: stream.headers,
      fields
    };
  });
}
function applyContext(streams, context) {
  if (!streams || !streams.length) return streams;
  return streams.map((stream) => {
    if (!stream.fields) return stream;
    const fields = Object.assign({}, stream.fields, {
      title: context.title || stream.fields.title || "",
      year: context.year || stream.fields.year || "",
      seasonEpisode: seasonEpisodeOf(context) || stream.fields.seasonEpisode || ""
    });
    const display = formatStream(fields);
    return Object.assign({}, stream, {
      name: display.name,
      title: display.title,
      description: display.description,
      quality: display.quality,
      fields
    });
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

// src/entrepeliculasyseries/extractor.js
var PROVIDER_NAME = "EntrePeliculasySeries";
var HOST = "https://entrepeliculasyseries.nz";
function vidurlPath(imdbId, mediaType, season, episode) {
  if (mediaType === "movie") return "/vidurl/" + imdbId + "/";
  return "/vidurl/" + imdbId + "-" + parseInt(season, 10) + "x" + String(episode).padStart(2, "0") + "/";
}
function resolveEmbed(embed) {
  return __async(this, null, function* () {
    const resolver = resolverFor(embed.url);
    if (!resolver) return [];
    try {
      const found = yield resolver.resolve(embed.url);
      return labeled(PROVIDER_NAME, POW_LANGUAGES[embed.language] || embed.language, resolver.server, found);
    } catch (e) {
      return [];
    }
  });
}
function extractStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    const imdbId = yield imdbIdFor(tmdbId, mediaType);
    if (!imdbId) throw new Error("TMDB has no IMDb id for " + mediaType + " " + tmdbId);
    const embeds = (yield fetchPowEmbeds(HOST, vidurlPath(imdbId, mediaType, season, episode))).filter((embed) => resolverFor(embed.url));
    return resolveFirstLanguage(groupByLanguage(embeds, POW_LANGUAGE_ORDER), 0, resolveEmbed);
  });
}
var _test = {
  vidurlPath,
  resolverFor,
  groupByLanguage: (embeds) => groupByLanguage(embeds, POW_LANGUAGE_ORDER)
};

// src/entrepeliculasyseries/log.js
function log() {
  const args = Array.from(arguments);
  let method = "log";
  if (["error", "warn", "info", "debug"].includes(args[0])) {
    method = args[0];
    args.shift();
  }
  console[method](`[${PROVIDER_NAME}]`, ...args);
}

// src/entrepeliculasyseries/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      log(mediaType === "movie" ? `Request: ${mediaType} ${tmdbId}` : `Request: ${mediaType} ${tmdbId}: S${season}E${episode}`);
      const streams = yield extractStreams(tmdbId, mediaType, season, episode);
      return applyContext(streams, { mediaType, season, episode });
    } catch (error) {
      log("warn", error.message);
      return [];
    }
  });
}
var _testAll = _test;
