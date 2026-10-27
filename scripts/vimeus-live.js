// Live check against vimeus.com, no TMDB key needed: node scripts/vimeus-live.js [tmdbId] [movie|tv] [season] [episode]
const { getStreams } = require('../providers/vimeus');

const tmdbId = process.argv[2] || '27205';
const mediaType = process.argv[3] === 'tv' ? 'tv' : 'movie';
const season = process.argv[4] || 1;
const episode = process.argv[5] || 1;

getStreams(tmdbId, mediaType, season, episode)
    .then((streams) => {
        console.log(`${mediaType} ${tmdbId}${mediaType === 'tv' ? ' s' + season + 'e' + episode : ''} -> ${streams.length} streams`);
        streams.forEach((s) => console.log('  ', s.name, '|', s.title, '|', s.quality, '|', s.url.slice(0, 70)));
    })
    .catch((err) => console.error('error:', err.message));
