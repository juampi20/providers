/**
 * Extractor Logic
 * This file just returns the video streams.
 * 
 * It primarily includes Baechu Squad's torrent links. 
 */

// The name of the provider.
export const PROVIDER_NAME = 'Baechu Squad';

// https://docs.google.com/document/d/18y_qEMKr7FoedRlWPjUVWBQFGTjsP5D0TLSpwvMlJ0E/mobilebasic
// https://infohash.lol
// https://webtor.io
// https://luciopaiva.com/torrent-file-viewer/
const seasonTorrents = {
  54553: {
    // The Genius
    1: {
      magnet: 'torrent://874fc5daf1c0c4072c635ef9979d48f4400ba8d3',
      /*fileIdx: {
        10: 0,
        1: 9,
      },*/
    },
    2: {
      magnet: 'torrent://2e7ae32a2b8360ec4e14581e034858f794e3620e',
    },
    3: {
      magnet: 'torrent://0f687aa29600e3e2488cced69a879236ce642517',
    },
    4: {
      magnet: 'torrent://dfdf73554879d2805cdd1a70e8b776b11ea7952c',
    },
  },
  78276: {
    // Society game
    1: {
      magnet: 'torrent://f0e1e7c87701e561a0599f0025326bac07fb5ef7',
    },
    2: {
      // no magnet link available.
    },
  },
  80585: {
    // The Great Escape
    1: {
      magnet: 'torrent://5807006767883f688b4183d0f34810cc9fb4721f',
    },
    2: {
      magnet: 'torrent://606af0f9b74eca5d500e214e668c703cc2f8e798',
    },
    3: {
      magnet: 'torrent://6eda8a54ea0a249779ce74de4d37fe6e1a2246cb',
    },
    4: {
      magnet: 'torrent://d6cf5c3b9165d8dbfff670e3671087ceb821d83a',
    },
  },
  215536: {
    // Treasure Hunt
    1: {
      episodes: {
        1: {
          magnet: 'torrent://57e8b38d270be61a6e08659e21364706c1d76827',
          fileIdx: 0,
        },
      },
    },
  },
  224362: {
    // Time hotel
    1: {
      magnet: 'torrent://11e5e1f3c1a401245eca4a490a2fb65c2dffe1cc',
    },
  },
  137640: {
    // Game of blood
    1: {
      magnet: 'torrent://5248acfe249ea9c24ca39a57b4bd2a2afd4db3d3',
    },
    2: {
      magnet: 'torrent://55d88ad1dc0ddf6beea7e1f14a4cf438b39f2c26',
    },
  },
  201908: {
    // Black sheep game
    1: {
      magnet: 'torrent://984cf4cd977d5babfe56c337536a6e3af1213168',
    },
  },
  71908: {
    // Crime Scene.
    4: {
      // Crime scene returns.
      fileIdx: {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
        6: 0,
        7: 0,
        8: 0,
        9: 0,
        10: 0,
      },
      episodes: {
        1: {
          magnet: 'torrent://4ed50e1ddc7ff73a657c2297c9259a99d7d97b55',
        },
        2: {
          magnet: 'torrent://adc24ce105aaa5bf361562d2962c2f5d55a0d0f1',
        },
        3: {
          magnet: 'torrent://a56edd7b7d4643dd687f68e3f6eea588108b7219',
        },
        4: {
          magnet: 'torrent://5ceaab1a97ff770230046fbb6caf1ac92eb4e65a',
        },
        5: {
          magnet: 'torrent://8d36a4fbe37e105ad009387b4fa92319d3a08b70',
        },
        6: {
          magnet: 'torrent://a78c9bd00645887e964ceb65431af66b82cbeab4',
        },
        7: {
          magnet: 'torrent://9c6084918a2029edcbda3629869679ea06888a9a',
        },
        8: {
          magnet: 'torrent://fec2135418fa325ed6c1998739504008b7d04887',
        },
        9: {
          magnet: 'torrent://f1f5dd4383a3571ac01fc64aefd5be21b694f948',
        },
        10: {
          magnet: 'torrent://e121a23b53d0b1b8aee73eb7001bf10ac4e7153d',
        },
      },
    },
  },
  116013: {
    1: {
      magnet: 'torrent://a0519d11fd2abf3248c6bf93d2c2c3f1acd783b8',
    },
    2: {
      episodes: {
        0: {
          magnet: 'torrent://1c90027eef52f68287163f1528570c80ff676a58',
          fileIdx: 0,
        },
        1: {
          magnet: 'torrent://2d7e51cedca78733ba2744bffcc7809664b54cde',
          fileIdx: 0,
        },
        2: {
          magnet: 'torrent://a723fc55c839181ffc2a9cea5e03fdddeaf15087',
          fileIdx: 0,
        },
        3: {
          magnet: 'torrent://6179d28ba7a26270cfd99faf7181fa3f3e41926c',
          fileIdx: 0,
        },
        4: {
          magnet: 'torrent://b16198038f844519976475aee3118a616b9e2fbd',
          fileIdx: 0,
        },
        5: {
          magnet: 'torrent://9d33a91e7d147ffb335f8c6dbfe018375292cb07',
          fileIdx: 0,
        },
        6: {
          magnet: 'torrent://2835de31e725f60ede5511a18e636eb3bc32bfbf',
          fileIdx: 0,
        },
        7: {
          magnet: 'torrent://0b6caec865d0792e6230eeef18c68d97925f7617',
          fileIdx: 0,
        },
        8: {
          magnet: 'torrent://7aaa2be2aae5b52d89e567380b9b9a595c8b00cd',
          fileIdx: 0,
        },
        9: {
          magnet: 'torrent://33cdcfa36b28cb0bdd67084f9b88371cd31aebcd',
          fileIdx: 0,
        },
      }
    }
  },
  // Bloody Game X - https://filecrypt.cc/Container/73708C9BD9.html
}

export async function extractStreams(tmdbId, mediaType, season, episode) {
    if (seasonTorrents[tmdbId] && seasonTorrents[tmdbId][season]) {
        let magnetLink = seasonTorrents[tmdbId][season].magnet;
        if (magnetLink) {
            episode = episode || 1; // Default to episode 1 if not provided
            // If fileIdx is defined for the season, use it to get the correct file index for the episode
            let fileIdx = episode - 1;
            if (seasonTorrents[tmdbId][season].fileIdx && seasonTorrents[tmdbId][season].fileIdx[episode] !== undefined) {
                fileIdx = seasonTorrents[tmdbId][season].fileIdx[episode];
            }
            magnetLink += `/${fileIdx}`;
            return [
                {
                    name: PROVIDER_NAME,
                    title: `[${PROVIDER_NAME}] torrent`,
                    url: magnetLink,
                    fileIdx: fileIdx,
                    description: 'Torrent sourced from Baechu Squad.',
                    quality: '1080p',
                },
            ];
        }
    }
    return [];
}
