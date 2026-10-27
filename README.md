# Nuvio Providers

Colección de providers de streaming para la app Nuvio. Cada provider es un módulo JavaScript que busca streams en un sitio y los devuelve en el formato que Nuvio espera.

**[Guía completa de desarrollo](DOCUMENTATION.md)**

## Inicio rápido

### Usarlo en Nuvio

1. Abrí **Nuvio** > **Settings** > **Plugins**.
2. Agregá la URL de este repositorio:

   ```
   https://raw.githubusercontent.com/juampi20/providers/main/manifest.json
   ```

3. Refrescá y habilitá los providers que quieras usar.

### Modo desarrollador

Para probar cambios locales, `npm start` levanta el repo por HTTP en el puerto 3000.

> Necesitás un **build de desarrollo** de Nuvio. Algunos providers andan en Node y fallan en el runtime real de la app.

- En la app: **Settings** > **Developer** > **Plugin Tester**.
- *Repo Tester*: `http://192.168.1.5:3000/manifest.json` (la IP de tu máquina).
- *Individual Plugin*: la URL de un provider compilado, por ejemplo `http://192.168.1.5:3000/providers/vimeus.js`.

### La key de TMDB

Nuvio inyecta `TMDB_API_KEY` en el runtime y `src/_utils/tmdb.js` la lee de ahí. Si tu build no la comparte con los plugins, pegá una key v3 en la configuración de los providers que la pidan. La key queda en Nuvio y nunca entra al repo.

Sin key no todo anda igual:

- **Vimeus** no la necesita: direcciona los títulos por el id de TMDB.
- **Embed69** busca el id de IMDb y cae a Wikidata cuando no hay key.
- **EntrePeliculasySeries** y **MegaDede** piden el id de IMDb a TMDB, así que sin key no devuelven nada.
- **HackStore** arma el slug de películas con título y año. Wikidata no da el año, así que sin key solo encuentra series.
- **CineCalidad** busca por slug de título y compara el año de la ficha cuando lo tiene. Anda sin key, con menos puntería.
- El resto resuelve títulos por Wikidata. Wikidata limita por ráfagas y devuelve 429, por eso `titlesFor` cachea lo ya resuelto mientras el plugin viva.

## Estructura del proyecto

```
nuvio-providers/
├── src/                          # Código fuente de los providers
│   ├── _template/                # Template para uno nuevo
│   ├── _utils/                   # Código compartido (http, resolvers, matcher, ...)
│   └── provider-one/
│       ├── index.js              # Entry point que llama Nuvio
│       ├── extractor.js          # Flujo del sitio
│       ├── log.js
│       └── scraper.json          # Entrada del manifest para este provider
│
├── providers/                    # Output del build: lo que Nuvio descarga
│   ├── provider-one.js
│   └── provider-two.js
│
├── manifest.json                 # Manifest generado (scrapers + metadata del repo)
├── scraper-defaults.json         # Defaults de las entradas generadas
├── build.js                      # Build con esbuild y generación del manifest
├── server.js                     # Servidor local para el Plugin Tester
└── docs/
    └── LICENSE-gpl-3.0.txt       # Licencia de la guía vendorizada
```

`providers/` y el bloque `scrapers` de `manifest.json` son salida de build. Se edita `src/` y se rebuildea: un cambio a mano en `providers/` se pierde en el próximo build.

## Build

### Default

```bash
npm run build
```

Compila cada carpeta de `src/` (menos `_template` y `_utils`) con esbuild en `providers/<provider>.js` y regenera `manifest.json`.

### Output

```bash
node build.js --out-dir build
```

Escribe en `build/` en vez de la raíz del repo. La salida tiene que quedar junto al manifest para que las rutas `providers/...` resuelvan.

### Metadata por provider

Cada `src/<provider>/scraper.json` se mergea sobre `scraper-defaults.json`. Si falta un campo, el build cae al template del `manifest.json` actual y después a los valores internos (tipos soportados, formatos, `enabled`). El `id` sale del campo `id` o del nombre de la carpeta, y `filename` se deriva de la salida.

### Comandos

```bash
# Todos los providers, sin minificar
npm run build

# Todos, minificados, para publicar
npm run build:min

# Uno solo
node build.js cinecalidad

# Varios
node build.js cinecalidad hackstore

# Output propio
node build.js --out-dir build
```

Un build por provider regenera `manifest.json` solo con los providers compilados en esa corrida. Antes de commitear, corré `npm run build` completo para que el manifest vuelva a tener las 15 entradas.

## Publicación

Este repo no usa GitHub Pages ni un workflow de publicación. Nuvio lee el manifest crudo de `main`:

1. `npm run build` (o `npm run build:min` si querés archivos más chicos).
2. Commiteá `src/`, `providers/` y `manifest.json` juntos.
3. Pusheá a `main`. La URL del manifest no cambia.

## Desarrollo

Este repo usa solo providers multi-archivo. La opción de un archivo suelto en `providers/` no aplica porque ese directorio se regenera en cada build.

### Crear un provider

1. Copiá el template:

   ```bash
   cp -r src/_template src/<name>
   ```

2. Renombrá `PROVIDER_NAME` en `extractor.js` y completá `scraper.json` con `id`, `name`, `description`, `version` y `supportedTypes`.

3. Escribí el extractor: URLs del sitio, parseo, qué embeds acepta. Si necesitás un helper nuevo, sumalo a `src/_utils/` solo cuando lo use un segundo sitio.

4. Buildeá:

   ```bash
   node build.js <name>
   ```

5. Probá en el Plugin Tester antes de dar la versión por buena.

### Restricciones del runtime

Nuvio corre los providers en QuickJS en desktop y en Hermes en TV y mobile, envueltos en una función. Hermes no tiene `Buffer` y puede no tener `AbortController`, `String.prototype.normalize` ni los helpers nuevos de `Promise`. Por eso los providers pliegan acentos con una tabla y arman las URLs a mano.

`async`/`await` sí se permite en `src/`: esbuild lo baja a generadores al compilar. Lo que se prueba siempre es el archivo de `providers/`, no la fuente.

`cheerio`, `crypto-js`, `axios` y los paquetes de cheerio para React Native quedan externos en el bundle porque los trae el runtime.

## Testing

El test que vale es en la app, con el Plugin Tester contra el servidor local. Para una comprobación suelta contra el sitio real, un script temporal en la raíz:

```js
// test-vimeus.js
const { getStreams } = require('./providers/vimeus.js');

getStreams('27205', 'movie').then((streams) => {
  console.log('Streams:', streams.length);
  console.log(streams[0]);
}).catch(console.error);
```

```bash
node test-vimeus.js
```

`test/`, `test.js` y `_test_*.js` están en `.gitignore`, así que no se publican.

## Formato del stream

Cada provider devuelve un array de streams:

```js
{
  name: "CineCalidad",                   // primera línea que dibuja Nuvio
  quality: "1080p • Vimeos • Latino",    // segunda línea
  title: "",                             // espejo del idioma; Nuvio no lo muestra
  description: "El origen · 2010 · ...", // detalle para logs y clientes que lo usen
  url: "https://.../master.m3u8",
  headers: { Referer: "https://cinecalidad.vg/" },
  fields: {
    provider: "CineCalidad",
    server: "Vimeos",
    language: "Latino",
    quality: "1080p",
    resolution: "1920x1080",
    protocol: "hls",
    index: 1,
    title: "El origen",
    year: "2010",
    seasonEpisode: ""
  }
}
```

`src/_utils/formatters.js` decide qué entra en cada línea (`standard`, `compact`, `verbose`). `src/_utils/labels.js` arma el objeto.

### Qué garantiza cada provider

- **Un idioma por llamada.** Los embeds se agrupan por idioma en orden latino primero y la búsqueda corta en el primero que resuelve, para no gastar los 60 s de Nuvio en todos.
- **Nunca `hls4`.** Los segmentos de ese tag traen cabecera PNG y libmpv, el player de Nuvio, los rechaza.
- **La calidad es la medida.** `variants.js` lee el master HLS y etiqueta con la resolución real de la mejor variante, no con lo que diga la URL.
- **Se descarta lo que falló.** `verify.js` usa el request que el resolver ya hizo. No se sondea ningún link de más, porque Nuvio espera a todos los pedidos pendientes antes de mostrar resultados.

## Módulos disponibles

Los providers acceden a estos módulos por `require()`:

| Módulo | Uso |
|--------|-----|
| `cheerio-without-node-native` | Parsing de HTML |
| `crypto-js` | Encryption / decryption (páginas con proof of work) |
| `axios` | Requests HTTP |

`fetch` y `console` están disponibles como globales.

## Opciones del manifest

Cada entrada del manifest se genera desde `scraper.json`. Estos son los campos que usa este repo:

```json
{
  "id": "cinemitas",
  "name": "Cinemitas",
  "description": "Movies and series in Latin Spanish via cinemitas.org (vimeos, uqload, vimeus).",
  "version": "1.0.0",
  "author": "chester",
  "supportedTypes": ["movie", "tv"],
  "filename": "providers/cinemitas.js",
  "enabled": true,
  "logo": "https://www.google.com/s2/favicons?domain=cinemitas.org&sz=128",
  "contentLanguage": ["es"],
  "formats": ["m3u8"],
  "limited": false,
  "disabledPlatforms": [],
  "hasSettings": true,
  "supportsExternalPlayer": true
}
```

`hasSettings` tiene que ser `true` si el provider exporta `onSettings`. Si no lo exporta, Nuvio no muestra campos y no hay dónde guardar la key.

## Licencia

Este repo no incluye un archivo de licencia propio. `DOCUMENTATION.md` es una copia vendorizada de [autovalue/nuvio-plugins](https://github.com/autovalue/nuvio-plugins) bajo **GNU General Public License v3.0**; el texto está en [`docs/LICENSE-gpl-3.0.txt`](docs/LICENSE-gpl-3.0.txt).

## Disclaimer

- Este repositorio no aloja contenido.
- Los providers consultan contenido público de sitios de terceros.
- Cada usuario es responsable de cumplir la ley de su jurisdicción.
- Los reclamos de DMCA van al sitio que aloja el contenido, no a este repo.

## Agradecimientos

Gracias a [autovalue/nuvio-plugins](https://github.com/autovalue/nuvio-plugins) por la guía de desarrollo y por el template del que salió `src/baechu-squad/`.
