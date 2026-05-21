/**
 * build-schools.ts — dataset generator for P1 Compass.
 *
 *   bun scripts/build-schools.ts   (or: bun run build:data)
 *
 * Coordinate resolution, in priority order:
 *   1. OneMap geocoding by school name — exact, used when OneMap is reachable
 *      and credentials (ONEMAP_TOKEN, or ONEMAP_EMAIL/ONEMAP_PASSWORD) are set.
 *   2. The curated lat/lng baked into each SCHOOL_DEFS entry below — real,
 *      hand-checked locations, used when OneMap is unavailable.
 *
 * Ballot history, vacancies, CCAs and programmes remain synthetic and
 * deterministic (illustrative — not official MOE data).
 *
 * Writes data/schools.json and data/postal_sectors.json. Re-running is safe.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { onemapSearch } from "../lib/onemap";
import type {
  BallotHistory,
  BallotStatus,
  School,
  SchoolType,
} from "../lib/types";

// --- deterministic RNG -------------------------------------------------------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller normal sample. */
function gaussian(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function sample<T>(rng: () => number, arr: readonly T[], n: number): T[] {
  const pool = [...arr];
  const out: T[] = [];
  while (out.length < n && pool.length > 0) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return out;
}

// --- regions -----------------------------------------------------------------

type Region = { name: string; lat: number; lng: number; sectors: string[] };

const REGIONS: Record<string, Region> = {
  city: { name: "City & Marina", lat: 1.289, lng: 103.852, sectors: ["01", "02", "06", "07"] },
  bukitmerah: { name: "Bukit Merah", lat: 1.282, lng: 103.823, sectors: ["03", "04"] },
  queenstown: { name: "Queenstown", lat: 1.2942, lng: 103.8061, sectors: ["05"] },
  orchard: { name: "Orchard & River Valley", lat: 1.303, lng: 103.833, sectors: ["09"] },
  holland: { name: "Holland & Bukit Timah", lat: 1.325, lng: 103.796, sectors: ["10", "21", "29", "58"] },
  novena: { name: "Novena", lat: 1.3203, lng: 103.843, sectors: ["11", "12"] },
  kallang: { name: "Kallang & Whampoa", lat: 1.311, lng: 103.865, sectors: ["08", "30", "33"] },
  toapayoh: { name: "Toa Payoh", lat: 1.3343, lng: 103.8493, sectors: ["13", "31", "32", "36", "37"] },
  geylang: { name: "Geylang & Paya Lebar", lat: 1.314, lng: 103.887, sectors: ["14", "34", "35", "38", "39", "40"] },
  katong: { name: "Katong & Marine Parade", lat: 1.305, lng: 103.905, sectors: ["15", "41", "42", "43", "44", "45"] },
  bedok: { name: "Bedok", lat: 1.3236, lng: 103.93, sectors: ["16", "46", "47", "48"] },
  changi: { name: "Changi & Simei", lat: 1.344, lng: 103.953, sectors: ["17", "49", "50", "81"] },
  tampines: { name: "Tampines", lat: 1.3536, lng: 103.9568, sectors: ["18", "51", "52"] },
  serangoon: { name: "Serangoon", lat: 1.3554, lng: 103.873, sectors: ["19"] },
  amk: { name: "Ang Mo Kio", lat: 1.37, lng: 103.8454, sectors: ["20", "56", "57"] },
  boonlay: { name: "Boon Lay & Pioneer", lat: 1.338, lng: 103.701, sectors: ["22", "64", "69", "70", "71"] },
  bukitpanjang: { name: "Bukit Panjang", lat: 1.3774, lng: 103.7719, sectors: ["23", "65", "66"] },
  cck: { name: "Choa Chu Kang", lat: 1.384, lng: 103.747, sectors: ["24", "68"] },
  woodlands: { name: "Woodlands", lat: 1.4382, lng: 103.789, sectors: ["25", "72", "73"] },
  bishan: { name: "Bishan", lat: 1.3526, lng: 103.8352, sectors: ["26", "77", "78"] },
  yishun: { name: "Yishun", lat: 1.4304, lng: 103.8354, sectors: ["27", "75", "76"] },
  seletar: { name: "Seletar & Yio Chu Kang", lat: 1.396, lng: 103.869, sectors: ["28", "79", "80"] },
  clementi: { name: "Clementi", lat: 1.3162, lng: 103.7649, sectors: ["59"] },
  jurongeast: { name: "Jurong East", lat: 1.3329, lng: 103.7436, sectors: ["60", "61"] },
  jurongwest: { name: "Jurong West", lat: 1.3404, lng: 103.709, sectors: ["62", "63"] },
  hougang: { name: "Hougang", lat: 1.3712, lng: 103.8924, sectors: ["53"] },
  sengkang: { name: "Sengkang", lat: 1.3911, lng: 103.8954, sectors: ["54"] },
  punggol: { name: "Punggol", lat: 1.4043, lng: 103.9022, sectors: ["55", "82"] },
  bukitbatok: { name: "Bukit Batok", lat: 1.359, lng: 103.7637, sectors: ["67"] },
};

// --- school definitions ------------------------------------------------------
// [name, regionKey, tags, lat, lng]
//   tags  — tier (elite|popular|standard) + flags (sap|gep|boys|girls|affiliated)
//   lat/lng — curated real coordinates; OneMap geocoding overrides them when available.

type Tier = "elite" | "popular" | "standard";
type Def = [
  name: string,
  region: keyof typeof REGIONS,
  tags: string,
  lat: number,
  lng: number,
];

const SCHOOL_DEFS: Def[] = [
  // City / Bukit Merah / Queenstown
  ["Cantonment Primary School", "city", "standard", 1.275505, 103.839923],
  ["River Valley Primary School", "orchard", "popular", 1.294183, 103.836019],
  ["Radin Mas Primary School", "bukitmerah", "popular", 1.274962, 103.82418],
  ["Gan Eng Seng Primary School", "bukitmerah", "standard", 1.285955, 103.815228],
  ["Zhangde Primary School", "bukitmerah", "popular", 1.284498, 103.826149],
  ["CHIJ (Kellock)", "bukitmerah", "popular girls affiliated", 1.274845, 103.82807],
  ["Blangah Rise Primary School", "bukitmerah", "standard", 1.27613, 103.808639],
  ["Alexandra Primary School", "queenstown", "popular", 1.291299, 103.823941],
  ["Queenstown Primary School", "queenstown", "standard", 1.295988, 103.807902],
  ["New Town Primary School", "queenstown", "popular", 1.299811, 103.799965],
  ["Fairfield Methodist School (Primary)", "queenstown", "popular affiliated", 1.300799, 103.785692],
  // Clementi
  ["Clementi Primary School", "clementi", "standard", 1.315809, 103.763055],
  ["Nan Hua Primary School", "clementi", "elite sap gep", 1.31984, 103.7614],
  ["Pei Tong Primary School", "clementi", "popular", 1.316148, 103.767576],
  ["Qifa Primary School", "clementi", "popular", 1.312622, 103.75703],
  // Holland / Bukit Timah
  ["Henry Park Primary School", "holland", "elite gep", 1.316726, 103.784208],
  ["Nanyang Primary School", "holland", "elite sap gep affiliated", 1.321246, 103.807795],
  ["Raffles Girls' Primary School", "holland", "elite girls", 1.330074, 103.806221],
  ["Methodist Girls' School (Primary)", "holland", "elite girls affiliated", 1.33286, 103.78336],
  ["Pei Hwa Presbyterian Primary School", "holland", "popular", 1.338055, 103.776108],
  ["Bukit Timah Primary School", "holland", "popular", 1.33775, 103.766855],
  // Orchard / Novena
  ["Anglo-Chinese School (Primary)", "orchard", "elite boys affiliated", 1.318719, 103.835345],
  ["Anglo-Chinese School (Junior)", "novena", "elite boys affiliated", 1.309321, 103.840644],
  ["Singapore Chinese Girls' Primary School", "orchard", "elite girls", 1.32103, 103.82808],
  ["St. Margaret's School (Primary)", "orchard", "popular girls affiliated", 1.3015, 103.847],
  ["St. Joseph's Institution Junior", "novena", "popular boys affiliated", 1.317702, 103.84567],
  ["Balestier Hill Primary School", "novena", "standard", 1.326, 103.843],
  // Toa Payoh
  ["CHIJ Primary (Toa Payoh)", "toapayoh", "popular girls affiliated", 1.332818, 103.841918],
  ["First Toa Payoh Primary School", "toapayoh", "standard", 1.340526, 103.855668],
  ["Pei Chun Public School", "toapayoh", "popular", 1.337289, 103.855473],
  ["Kheng Cheng School", "toapayoh", "popular", 1.337408, 103.847761],
  ["Hong Wen School", "kallang", "popular", 1.321689, 103.857652],
  ["Bendemeer Primary School", "kallang", "standard", 1.322208, 103.865351],
  ["St. Andrew's Junior School", "kallang", "popular boys affiliated", 1.331389, 103.865129],
  ["Farrer Park Primary School", "kallang", "standard", 1.312504, 103.850903],
  ["Stamford Primary School", "kallang", "standard", 1.304091, 103.857393],
  // Bishan
  ["Catholic High School (Primary)", "bishan", "elite boys sap affiliated", 1.35479, 103.84493],
  ["Kuo Chuan Presbyterian Primary School", "bishan", "popular affiliated", 1.349384, 103.855171],
  ["Guangyang Primary School", "bishan", "standard", 1.346043, 103.849285],
  ["Marymount Convent School", "bishan", "popular girls", 1.340427, 103.839899],
  ["Zhonghua Primary School", "bishan", "popular", 1.360167, 103.869696],
  // Ang Mo Kio
  ["Ai Tong School", "amk", "elite sap affiliated", 1.360736, 103.833076],
  ["Anderson Primary School", "amk", "popular", 1.384666, 103.841238],
  ["CHIJ St. Nicholas Girls' School (Primary)", "amk", "elite girls sap affiliated gep", 1.37373, 103.83431],
  ["Mayflower Primary School", "amk", "popular", 1.3764, 103.84317],
  ["Jing Shan Primary School", "amk", "standard", 1.371893, 103.851811],
  ["Townsville Primary School", "amk", "standard", 1.360363, 103.854186],
  ["Teck Ghee Primary School", "amk", "standard", 1.365201, 103.851032],
  ["Da Qiao Primary School", "amk", "standard", 1.3768, 103.853],
  ["Yio Chu Kang Primary School", "seletar", "standard", 1.377823, 103.885569],
  // Serangoon / Hougang
  ["Rosyth School", "serangoon", "elite gep", 1.372916, 103.874693],
  ["Yangzheng Primary School", "serangoon", "popular", 1.348972, 103.868363],
  ["Maris Stella High School (Primary)", "serangoon", "elite boys sap affiliated", 1.34139, 103.87781],
  ["CHIJ Our Lady of Good Counsel", "serangoon", "popular girls affiliated", 1.357951, 103.86425],
  ["St. Gabriel's Primary School", "serangoon", "popular boys affiliated", 1.349246, 103.862332],
  ["Holy Innocents' Primary School", "hougang", "popular affiliated", 1.366738, 103.893684],
  ["Hougang Primary School", "hougang", "standard", 1.37804, 103.881166],
  ["Montfort Junior School", "hougang", "popular boys affiliated", 1.373938, 103.889691],
  ["Xinghua Primary School", "hougang", "standard", 1.357997, 103.890216],
  ["Xinmin Primary School", "hougang", "popular", 1.371415, 103.883039],
  ["CHIJ Our Lady of the Nativity", "hougang", "popular girls affiliated", 1.373174, 103.897659],
  ["Paya Lebar Methodist Girls' School (Primary)", "hougang", "popular girls affiliated", 1.349842, 103.884978],
  // Sengkang
  ["Anchor Green Primary School", "sengkang", "standard", 1.390662, 103.887256],
  ["Compassvale Primary School", "sengkang", "standard", 1.39453, 103.897865],
  ["Fern Green Primary School", "sengkang", "standard", 1.397621, 103.88021],
  ["Nan Chiau Primary School", "sengkang", "elite sap", 1.392065, 103.890925],
  ["North Spring Primary School", "sengkang", "standard", 1.387528, 103.903513],
  ["North Vista Primary School", "sengkang", "standard", 1.382893, 103.895854],
  ["Palm View Primary School", "sengkang", "standard", 1.383841, 103.891215],
  ["Sengkang Green Primary School", "sengkang", "standard", 1.392839, 103.875159],
  ["Springdale Primary School", "sengkang", "standard", 1.394958, 103.889897],
  // Punggol
  ["Edgefield Primary School", "punggol", "standard", 1.400298, 103.907431],
  ["Greendale Primary School", "punggol", "standard", 1.396403, 103.912566],
  ["Horizon Primary School", "punggol", "standard", 1.400009, 103.913072],
  ["Mee Toh School", "punggol", "popular", 1.394854, 103.908573],
  ["Oasis Primary School", "punggol", "standard", 1.404409, 103.910996],
  ["Punggol Cove Primary School", "punggol", "standard", 1.411564, 103.89897],
  ["Punggol Green Primary School", "punggol", "standard", 1.401805, 103.898773],
  ["Punggol Primary School", "punggol", "standard", 1.378201, 103.894753],
  ["Punggol View Primary School", "punggol", "standard", 1.405333, 103.905387],
  ["Valour Primary School", "punggol", "standard", 1.40687, 103.89891],
  ["Waterway Primary School", "punggol", "standard", 1.399154, 103.918671],
  // Tampines
  ["Angsana Primary School", "tampines", "standard", 1.348571, 103.951673],
  ["Chongzheng Primary School", "tampines", "standard", 1.350595, 103.951225],
  ["Gongshang Primary School", "tampines", "popular", 1.357349, 103.948872],
  ["Junyuan Primary School", "tampines", "standard", 1.347892, 103.939647],
  ["Poi Ching School", "tampines", "popular sap", 1.358087, 103.935353],
  ["St. Hilda's Primary School", "tampines", "popular affiliated", 1.349407, 103.936787],
  ["Tampines Primary School", "tampines", "standard", 1.350486, 103.943573],
  ["Tampines North Primary School", "tampines", "standard", 1.360692, 103.948937],
  ["East Spring Primary School", "tampines", "standard", 1.353041, 103.961797],
  ["Yumin Primary School", "tampines", "standard", 1.35146, 103.950716],
  // Pasir Ris (mapped under Tampines region)
  ["Casuarina Primary School", "tampines", "standard", 1.372789, 103.957291],
  ["Coral Primary School", "tampines", "standard", 1.3725, 103.942],
  ["Elias Park Primary School", "tampines", "standard", 1.375033, 103.945358],
  ["Loyang Primary School", "changi", "standard", 1.368, 103.959],
  ["Meridian Primary School", "tampines", "standard", 1.375971, 103.935143],
  ["Park View Primary School", "tampines", "standard", 1.37777, 103.939689],
  ["Pasir Ris Primary School", "tampines", "standard", 1.372309, 103.962919],
  ["White Sands Primary School", "tampines", "popular", 1.365518, 103.960948],
  // Changi / Simei
  ["Changkat Primary School", "changi", "standard", 1.340208, 103.952183],
  ["East View Primary School", "changi", "standard", 1.362, 103.946],
  // Bedok
  ["Bedok Green Primary School", "bedok", "standard", 1.323996, 103.937745],
  ["Fengshan Primary School", "bedok", "standard", 1.330325, 103.931885],
  ["Red Swastika School", "bedok", "elite sap", 1.333494, 103.934375],
  ["St. Stephen's School", "bedok", "popular boys affiliated", 1.318816, 103.917526],
  ["Temasek Primary School", "bedok", "elite", 1.317716, 103.945695],
  ["Yu Neng Primary School", "bedok", "popular", 1.333904, 103.932034],
  ["Damai Primary School", "bedok", "standard", 1.335351, 103.921268],
  ["Opera Estate Primary School", "bedok", "popular", 1.319969, 103.923753],
  // Geylang / Katong
  ["Tao Nan School", "katong", "elite sap gep", 1.304632, 103.911204],
  ["Kong Hwa School", "geylang", "elite sap", 1.311114, 103.888209],
  ["Haig Girls' School", "katong", "popular girls", 1.311772, 103.902655],
  ["CHIJ (Katong) Primary", "katong", "popular girls affiliated", 1.306527, 103.910922],
  ["Tanjong Katong Primary School", "katong", "elite", 1.30531, 103.90053],
  ["Ngee Ann Primary School", "katong", "popular", 1.30554, 103.917755],
  ["Telok Kurau Primary School", "katong", "popular", 1.330913, 103.911349],
  ["Geylang Methodist School (Primary)", "geylang", "popular affiliated", 1.317593, 103.883893],
  ["Cedar Primary School", "geylang", "popular", 1.335641, 103.875491],
  ["Canossa Catholic Primary School", "geylang", "popular affiliated", 1.326511, 103.881757],
  ["Maha Bodhi School", "geylang", "popular", 1.328408, 103.901528],
  ["Eunos Primary School", "geylang", "standard", 1.324388, 103.904375],
  ["MacPherson Primary School", "geylang", "standard", 1.3265, 103.887],
  // Jurong East
  ["Fuhua Primary School", "jurongeast", "standard", 1.336404, 103.736669],
  ["Jurong Primary School", "jurongeast", "standard", 1.348685, 103.732975],
  ["Yuhua Primary School", "jurongeast", "standard", 1.34292, 103.740861],
  ["Shuqun Primary School", "jurongeast", "standard", 1.347568, 103.721558],
  // Jurong West / Boon Lay
  ["Boon Lay Garden Primary School", "boonlay", "standard", 1.342847, 103.712969],
  ["Corporation Primary School", "jurongwest", "standard", 1.351485, 103.707578],
  ["Frontier Primary School", "jurongwest", "popular", 1.336643, 103.699683],
  ["Juying Primary School", "jurongwest", "standard", 1.338951, 103.687833],
  ["Lakeside Primary School", "jurongwest", "standard", 1.338376, 103.718051],
  ["Pioneer Primary School", "boonlay", "standard", 1.348721, 103.694868],
  ["Rulang Primary School", "jurongwest", "popular", 1.346844, 103.71901],
  ["West Grove Primary School", "jurongwest", "standard", 1.344712, 103.698964],
  ["Westwood Primary School", "jurongwest", "standard", 1.347155, 103.700527],
  ["Xingnan Primary School", "jurongwest", "standard", 1.342685, 103.687724],
  ["Jurong West Primary School", "jurongwest", "standard", 1.339244, 103.698896],
  // Bukit Batok
  ["Bukit View Primary School", "bukitbatok", "standard", 1.345945, 103.753589],
  ["Dazhong Primary School", "bukitbatok", "standard", 1.359059, 103.748161],
  ["Keming Primary School", "bukitbatok", "standard", 1.345245, 103.756264],
  ["Lianhua Primary School", "bukitbatok", "standard", 1.354155, 103.75421],
  ["Princess Elizabeth Primary School", "bukitbatok", "popular", 1.349195, 103.741],
  ["St. Anthony's Primary School", "bukitbatok", "popular affiliated", 1.364639, 103.749294],
  // Bukit Panjang
  ["Beacon Primary School", "bukitpanjang", "popular", 1.384237, 103.773754],
  ["Bukit Panjang Primary School", "bukitpanjang", "standard", 1.373472, 103.769317],
  ["CHIJ Our Lady Queen of Peace", "bukitpanjang", "popular girls affiliated", 1.366758, 103.767695],
  ["Greenridge Primary School", "bukitpanjang", "standard", 1.385874, 103.767815],
  ["South View Primary School", "bukitpanjang", "standard", 1.381767, 103.74729],
  ["Teck Whye Primary School", "bukitpanjang", "standard", 1.383558, 103.753683],
  ["West View Primary School", "bukitpanjang", "standard", 1.383591, 103.760289],
  ["Zhenghua Primary School", "bukitpanjang", "standard", 1.379802, 103.769171],
  // Choa Chu Kang
  ["Chua Chu Kang Primary School", "cck", "standard", 1.377743, 103.741861],
  ["Concord Primary School", "cck", "standard", 1.380412, 103.736143],
  ["De La Salle School", "cck", "popular affiliated", 1.395072, 103.743444],
  ["Kranji Primary School", "cck", "standard", 1.39391, 103.747415],
  ["Unity Primary School", "cck", "standard", 1.402823, 103.746993],
  ["Yew Tee Primary School", "cck", "standard", 1.396961, 103.751195],
  // Woodlands
  ["Admiralty Primary School", "woodlands", "standard", 1.44268, 103.800114],
  ["Evergreen Primary School", "woodlands", "standard", 1.444148, 103.794545],
  ["Fuchun Primary School", "woodlands", "standard", 1.43064, 103.778175],
  ["Greenwood Primary School", "woodlands", "standard", 1.44011, 103.804629],
  ["Innova Primary School", "woodlands", "standard", 1.429185, 103.790557],
  ["Marsiling Primary School", "woodlands", "standard", 1.434423, 103.773698],
  ["Qihua Primary School", "woodlands", "standard", 1.442036, 103.78834],
  ["Riverside Primary School", "woodlands", "standard", 1.447105, 103.801921],
  ["Si Ling Primary School", "woodlands", "standard", 1.4327, 103.785779],
  ["Woodgrove Primary School", "woodlands", "standard", 1.433058, 103.79039],
  ["Woodlands Primary School", "woodlands", "standard", 1.436746, 103.791772],
  ["Woodlands Ring Primary School", "woodlands", "standard", 1.43477, 103.797841],
  // Yishun
  ["Chongfu School", "yishun", "popular sap", 1.438462, 103.839071],
  ["Huamin Primary School", "yishun", "standard", 1.427, 103.84421],
  ["Jiemin Primary School", "yishun", "standard", 1.427647, 103.83048],
  ["North View Primary School", "yishun", "standard", 1.427943, 103.848368],
  ["Northland Primary School", "yishun", "standard", 1.421304, 103.840793],
  ["Peiying Primary School", "yishun", "standard", 1.417408, 103.830299],
  ["Xishan Primary School", "yishun", "standard", 1.433501, 103.838289],
  ["Yishun Primary School", "yishun", "standard", 1.433496, 103.834027],
  ["Ahmad Ibrahim Primary School", "yishun", "standard", 1.433681, 103.832924],
  // Sembawang (mapped under Yishun region)
  ["Canberra Primary School", "yishun", "standard", 1.451064, 103.815971],
  ["Endeavour Primary School", "yishun", "standard", 1.454176, 103.817427],
  ["Sembawang Primary School", "yishun", "standard", 1.445044, 103.821022],
  ["Wellington Primary School", "yishun", "standard", 1.451934, 103.822321],
  ["Naval Base Primary School", "yishun", "standard", 1.41628, 103.838798],
];

// --- pools -------------------------------------------------------------------

const CCAS = [
  "Football", "Basketball", "Badminton", "Table Tennis", "Swimming",
  "Track and Field", "Wushu", "Taekwondo", "Netball", "Floorball",
  "Choir", "Chinese Orchestra", "Concert Band", "String Ensemble",
  "Modern Dance", "Malay Dance", "Indian Dance", "Chinese Dance",
  "Art Club", "Drama", "Infocomm Club", "Robotics", "Scouts",
  "Brownies", "Red Cross", "National Cadet Corps", "Environmental Club",
  "Gymnastics",
] as const;

const PROGRAMMES = [
  "ALP: Robotics & Coding", "ALP: STEM Innovators", "ALP: Environmental Science",
  "ALP: Applied Mathematics", "ALP: Digital Media & Design",
  "LLP: Character through the Outdoors", "LLP: Visual & Performing Arts",
  "LLP: Sports for Life", "LLP: Service Learning", "LLP: Heritage & Citizenship",
] as const;

const STREETS = ["Avenue", "Street", "Road", "Drive", "Lane", "Walk", "Crescent"];

function affiliationsFor(name: string): string[] {
  const has = (s: string) => name.includes(s);
  if (has("Anglo-Chinese"))
    return ["Anglo-Chinese School (Independent)", "Anglo-Chinese Junior College"];
  if (has("CHIJ")) return ["CHIJ Secondary", "Catholic Junior College"];
  if (has("Methodist Girls")) return ["Methodist Girls' School (Secondary)"];
  if (has("Paya Lebar Methodist"))
    return ["Paya Lebar Methodist Girls' School (Secondary)"];
  if (has("Geylang Methodist")) return ["Geylang Methodist School (Secondary)"];
  if (has("Fairfield")) return ["Fairfield Methodist School (Secondary)"];
  if (has("St. Andrew"))
    return ["Saint Andrew's Secondary School", "Saint Andrew's Junior College"];
  if (has("Catholic High")) return ["Catholic High School (Secondary)"];
  if (has("Maris Stella")) return ["Maris Stella High School (Secondary)"];
  if (has("Holy Innocents")) return ["Holy Innocents' High School"];
  if (has("Montfort")) return ["Montfort Secondary School"];
  if (has("St. Joseph")) return ["Saint Joseph's Institution"];
  if (has("St. Hilda")) return ["St. Hilda's Secondary School"];
  if (has("St. Anthony") || has("Canossa"))
    return ["St. Anthony's Canossian Secondary School"];
  if (has("St. Margaret")) return ["St. Margaret's School (Secondary)"];
  if (has("St. Gabriel")) return ["St. Gabriel's Secondary School"];
  if (has("St. Stephen")) return ["Catholic Junior College"];
  if (has("De La Salle")) return ["St. Patrick's School"];
  if (has("Kuo Chuan")) return ["Kuo Chuan Presbyterian Secondary School"];
  if (has("Nanyang")) return ["Nanyang Girls' High School"];
  if (has("Ai Tong")) return ["Hwa Chong Institution"];
  return ["Affiliated secondary school"];
}

const STOPWORDS = new Set(["SCHOOL", "PRIMARY", "THE", "OF", "AND"]);

function makeShort(name: string): string {
  const cleaned = name.replace(/\([^)]*\)/g, " ").replace(/[.'’]/g, "");
  const words = cleaned.split(/[\s-]+/).filter(Boolean);
  // keep genuine acronyms (originally all-caps, e.g. "CHIJ") intact
  if (/^[A-Z]{3,5}$/.test(words[0] ?? "")) {
    return words[0];
  }
  const significant = words.filter((w) => !STOPWORDS.has(w.toUpperCase()));
  const initials = significant.map((w) => w[0]?.toUpperCase() ?? "").join("");
  if (initials.length >= 2) return initials.slice(0, 4);
  return (significant[0] ?? words[0] ?? "").slice(0, 3).toUpperCase();
}

function makeId(name: string, used: Set<string>): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .split("-")
    .slice(0, 3)
    .join("-");
  let id = base;
  let n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}

// --- ballot model ------------------------------------------------------------

const YEARS = [2021, 2022, 2023, 2024, 2025];

function statusFromScore(score: number): BallotStatus {
  if (score < 0.32) return "open";
  if (score < 0.56) return "b_far";
  if (score < 0.79) return "b_mid";
  return "b_near";
}

function buildBallot(rng: () => number, comp: number): BallotHistory {
  const history: BallotHistory = {};
  for (let i = 0; i < YEARS.length; i++) {
    const year = YEARS[i];
    // gentle upward drift in competitiveness over the years
    const drift = (i - 2) * 0.03;
    const yearNoise = gaussian(rng) * 0.16;
    const base = comp + drift + yearNoise;
    history[year] = {
      "2A": statusFromScore(base * 0.55 + gaussian(rng) * 0.1),
      "2B": statusFromScore(base * 0.78 + gaussian(rng) * 0.1),
      "2C": statusFromScore(base + gaussian(rng) * 0.06),
      "2CS": statusFromScore(base * 0.45 + gaussian(rng) * 0.12),
    };
  }
  return history;
}

function compFor(tier: Tier, rng: () => number): number {
  const baseByTier: Record<Tier, number> = {
    elite: 0.86,
    popular: 0.56,
    standard: 0.26,
  };
  return Math.max(0, Math.min(1, baseByTier[tier] + gaussian(rng) * 0.12));
}

// --- OneMap geocoding --------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Geocode a school by name, trying the bare name then a parenthesis-stripped form. */
async function geocodeSchool(name: string) {
  const queries = [name];
  const stripped = name.replace(/\([^)]*\)/g, "").trim();
  if (stripped && stripped !== name) queries.push(stripped);
  for (const q of queries) {
    const hit = await onemapSearch(q);
    if (hit) return hit;
  }
  return null;
}

// --- generation --------------------------------------------------------------

async function buildSchools(): Promise<School[]> {
  // Probe OneMap once — if reachable, geocode every school precisely.
  const probe = await onemapSearch("Raffles Place MRT");
  const onemapOk = probe !== null;
  console.log(
    onemapOk
      ? "OneMap reachable — geocoding schools by name."
      : "OneMap unavailable — using curated coordinates.",
  );

  const usedIds = new Set<string>();
  const schools: School[] = [];
  let geocoded = 0;

  for (let i = 0; i < SCHOOL_DEFS.length; i++) {
    const [name, regionKey, tagStr, curatedLat, curatedLng] = SCHOOL_DEFS[i];
    const region = REGIONS[regionKey];
    const tags = tagStr.split(/\s+/);
    const tier: Tier = tags.includes("elite")
      ? "elite"
      : tags.includes("popular")
        ? "popular"
        : "standard";
    const rng = mulberry32(4001 + i * 131);

    // school type
    const type: SchoolType[] = [];
    if (tags.includes("sap")) type.push("SAP");
    if (tags.includes("affiliated")) type.push("Affiliated");
    if (tags.includes("boys")) type.push("Boys");
    if (tags.includes("girls")) type.push("Girls");
    if (tags.includes("gep")) type.push("GEP");
    if (type.length === 0) type.push("Neighbourhood");

    // synthetic address + postal (fallback when OneMap is unavailable)
    const sector = pick(rng, region.sectors);
    let postal = sector + String(Math.floor(rng() * 10000)).padStart(4, "0");
    const block = 100 + Math.floor(rng() * 780);
    const streetArea = region.name.split(" & ")[0];
    const street = `${streetArea} ${pick(rng, STREETS)} ${1 + Math.floor(rng() * 12)}`;
    let address = `Blk ${block} ${street}, Singapore ${postal}`;

    // location: curated coordinates, overridden by OneMap when reachable
    let lat = curatedLat;
    let lng = curatedLng;
    if (onemapOk) {
      const hit = await geocodeSchool(name);
      if (hit) {
        lat = hit.lat;
        lng = hit.lng;
        address = hit.address;
        if (hit.postal) postal = hit.postal;
        geocoded++;
      }
      await sleep(80);
    }

    // vacancies (latest cycle)
    const total = 180 + Math.floor(rng() * 150);
    const phase1 = Math.round(total * (0.2 + rng() * 0.14));
    const phase2a = Math.round(total * (0.06 + rng() * 0.1));
    const phase2b = Math.round(total * (0.05 + rng() * 0.07));
    const phase2c = Math.max(15, total - phase1 - phase2a - phase2b);

    schools.push({
      id: makeId(name, usedIds),
      code: 7001 + i,
      name,
      short: makeShort(name),
      address,
      postal,
      lat: +lat.toFixed(6),
      lng: +lng.toFixed(6),
      type,
      affiliations: tags.includes("affiliated") ? affiliationsFor(name) : [],
      ccas: sample(rng, CCAS, 5 + Math.floor(rng() * 4)),
      programmes: sample(rng, PROGRAMMES, 1 + Math.floor(rng() * 2)),
      vacancies: { year: 2025, total, phase1, phase2a, phase2b, phase2c },
      ballot: buildBallot(rng, compFor(tier, rng)),
    } satisfies School);
  }

  if (onemapOk) {
    console.log(`Geocoded ${geocoded}/${SCHOOL_DEFS.length} schools via OneMap.`);
  }
  return schools;
}

function buildPostalSectors() {
  const out: Record<string, { area: string; lat: number; lng: number }> = {};
  for (const region of Object.values(REGIONS)) {
    for (const sector of region.sectors) {
      // deterministic per-sector offset so sectors in one region differ slightly
      const n = Number(sector);
      out[sector] = {
        area: region.name,
        lat: +(region.lat + Math.sin(n) * 0.004).toFixed(6),
        lng: +(region.lng + Math.cos(n) * 0.004).toFixed(6),
      };
    }
  }
  return out;
}

// --- write -------------------------------------------------------------------

const dataDir = join(import.meta.dirname, "..", "data");
mkdirSync(dataDir, { recursive: true });

const schools = await buildSchools();
const sectors = buildPostalSectors();

writeFileSync(join(dataDir, "schools.json"), JSON.stringify(schools, null, 2) + "\n");
writeFileSync(
  join(dataDir, "postal_sectors.json"),
  JSON.stringify(sectors, null, 2) + "\n",
);

console.log(
  `Wrote ${schools.length} schools across ${Object.keys(REGIONS).length} regions, ` +
    `${Object.keys(sectors).length} postal sectors.`,
);
