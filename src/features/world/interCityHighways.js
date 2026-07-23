/**
 * Physical Inter-City Highway Roads, Mountain Trails & Topography Directory.
 */

export const INTER_CITY_ROUTES = [
  {
    id: 'tokyo_kyoto_tokaido',
    name: 'Tokaido Highway & Hakone Pass',
    connects: ['tokyo', 'kyoto'],
    distanceKm: 450,
    terrainTypes: ['Asphalt Expressway', 'Hakone Mountain Cliffs', 'Red Pine Forest Trail'],
    waterBodies: ['Lake Biwa Channel', 'Sumida River'],
    landmarks: ['Hakone Mountain Pass', 'Fuji Summit Viewpoint'],
  },
  {
    id: 'kyoto_osaka_corridor',
    name: 'Yodo River Expressway & Bamboo Trail',
    connects: ['kyoto', 'osaka'],
    distanceKm: 55,
    terrainTypes: ['Yodo River Waterfront', 'Arashiyama Bamboo Forest', 'Steel Arch Bridges'],
    waterBodies: ['Yodo River Delta'],
    landmarks: ['Arashiyama Bamboo Grove', 'Fushimi Inari Gates'],
  },
  {
    id: 'osaka_sapporo_coastal',
    name: 'Tsugaru Strait & Hokkaido Alpine Highway',
    connects: ['osaka', 'sapporo'],
    distanceKm: 1050,
    terrainTypes: ['Coastal Expressway', 'Tsugaru Sea Channel', 'Mount Yotei Snow Cliffs'],
    waterBodies: ['Tsugaru Strait Open Sea', 'Sea of Japan'],
    landmarks: ['Tsugaru Sea Ferry Docks', 'Mount Yotei Summit'],
  },
]

export function getRouteByCities(cityA, cityB) {
  return INTER_CITY_ROUTES.find(
    (r) => (r.connects[0] === cityA && r.connects[1] === cityB) || (r.connects[0] === cityB && r.connects[1] === cityA)
  ) || INTER_CITY_ROUTES[0]
}
