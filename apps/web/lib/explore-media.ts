/**
 * Illustrative photos of places in Ghana for the marketplace's discovery
 * sections (kinds of stay, destinations). They show towns and campuses,
 * never a listed property: listing photos only ever come from owners (see
 * DirectoryListing.hero_image_url). Every file is from Wikimedia Commons
 * under the licence below, credited wherever it appears.
 */

export type ExplorePhoto = {
  src: string
  /** Describes the place, not a property. */
  alt: string
  place: string
  author: string
  license: string
  licenseUrl: string
  sourceUrl: string
}

export const EXPLORE_PHOTOS = {
  legon: {
    src: '/explore/legon-balme-library.jpg',
    alt: 'Balme Library at the University of Ghana, Legon',
    place: 'University of Ghana, Legon',
    author: 'Sarah Shreeves',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Balme_Library_at_University_of_Ghana_-_Legon.jpg',
  },
  labadi: {
    src: '/explore/labadi-beach.jpg',
    alt: 'Labadi Beach in Accra at sunset',
    place: 'Labadi Beach, Accra',
    author: 'Afus199620',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Labadi_Beach_2025.jpg',
  },
  accra: {
    src: '/explore/accra-skyline.jpg',
    alt: 'Office and apartment towers in central Accra',
    place: 'Accra',
    author: 'Synth85',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Accra_Skyline_-_Ghana.jpg',
  },
  kumasi: {
    src: '/explore/kumasi-view.jpg',
    alt: 'View across Kumasi under a blue sky',
    place: 'Kumasi',
    author: 'Maven Egote',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Kronum_Kumasi_2018-11-08_(130246).jpg',
  },
  winneba: {
    src: '/explore/winneba-sunset.jpg',
    alt: 'Sunset over trees in Winneba',
    place: 'Winneba',
    author: 'T.Chordson',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:A_PIC_OF_SUNSET_IN_WINNEBA_3.jpg',
  },
} satisfies Record<string, ExplorePhoto>

/** Town photo for a destination tile, matched on the display name. */
export function townPhoto(town: string): ExplorePhoto | null {
  const key = town.trim().toLowerCase()
  if (key === 'accra') return EXPLORE_PHOTOS.accra
  if (key === 'kumasi') return EXPLORE_PHOTOS.kumasi
  if (key === 'winneba') return EXPLORE_PHOTOS.winneba
  return null
}
