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
  ["Cantonment Primary School", "city", "standard", 1.2748, 103.841],
  ["River Valley Primary School", "orchard", "popular", 1.2925, 103.842],
  ["Radin Mas Primary School", "bukitmerah", "popular", 1.274, 103.824],
  ["Gan Eng Seng Primary School", "bukitmerah", "standard", 1.287, 103.8155],
  ["Zhangde Primary School", "bukitmerah", "popular", 1.285, 103.8285],
  ["CHIJ (Kellock)", "bukitmerah", "popular girls affiliated", 1.2755, 103.8265],
  ["Blangah Rise Primary School", "bukitmerah", "standard", 1.2755, 103.81],
  ["Alexandra Primary School", "queenstown", "popular", 1.2895, 103.816],
  ["Queenstown Primary School", "queenstown", "standard", 1.2935, 103.803],
  ["New Town Primary School", "queenstown", "popular", 1.3005, 103.7975],
  ["Fairfield Methodist School (Primary)", "queenstown", "popular affiliated", 1.306, 103.7855],
  // Clementi
  ["Clementi Primary School", "clementi", "standard", 1.3175, 103.766],
  ["Nan Hua Primary School", "clementi", "elite sap gep", 1.3105, 103.774],
  ["Pei Tong Primary School", "clementi", "popular", 1.3195, 103.77],
  ["Qifa Primary School", "clementi", "popular", 1.312, 103.7625],
  // Holland / Bukit Timah
  ["Henry Park Primary School", "holland", "elite gep", 1.317, 103.7935],
  ["Nanyang Primary School", "holland", "elite sap gep affiliated", 1.3215, 103.806],
  ["Raffles Girls' Primary School", "holland", "elite girls", 1.332, 103.809],
  ["Methodist Girls' School (Primary)", "holland", "elite girls affiliated", 1.334, 103.779],
  ["Pei Hwa Presbyterian Primary School", "holland", "popular", 1.3795, 103.77],
  ["Bukit Timah Primary School", "holland", "popular", 1.364, 103.7595],
  // Orchard / Novena
  ["Anglo-Chinese School (Primary)", "orchard", "elite boys affiliated", 1.3245, 103.8395],
  ["Anglo-Chinese School (Junior)", "novena", "elite boys affiliated", 1.3035, 103.84],
  ["Singapore Chinese Girls' Primary School", "orchard", "elite girls", 1.324, 103.821],
  ["St. Margaret's School (Primary)", "orchard", "popular girls affiliated", 1.3015, 103.847],
  ["St. Joseph's Institution Junior", "novena", "popular boys affiliated", 1.321, 103.8455],
  ["Balestier Hill Primary School", "novena", "standard", 1.327, 103.847],
  // Toa Payoh
  ["CHIJ Primary (Toa Payoh)", "toapayoh", "popular girls affiliated", 1.34, 103.846],
  ["First Toa Payoh Primary School", "toapayoh", "standard", 1.3385, 103.8565],
  ["Pei Chun Public School", "toapayoh", "popular", 1.342, 103.8455],
  ["Kheng Cheng School", "toapayoh", "popular", 1.336, 103.853],
  ["Hong Wen School", "kallang", "popular", 1.3225, 103.8615],
  ["Bendemeer Primary School", "kallang", "standard", 1.321, 103.865],
  ["St. Andrew's Junior School", "kallang", "popular boys affiliated", 1.332, 103.869],
  ["Farrer Park Primary School", "kallang", "standard", 1.3135, 103.854],
  ["Stamford Primary School", "kallang", "standard", 1.312, 103.8575],
  // Bishan
  ["Catholic High School (Primary)", "bishan", "elite boys sap affiliated", 1.356, 103.842],
  ["Kuo Chuan Presbyterian Primary School", "bishan", "popular affiliated", 1.3535, 103.848],
  ["Guangyang Primary School", "bishan", "standard", 1.3505, 103.8465],
  ["Marymount Convent School", "bishan", "popular girls", 1.349, 103.839],
  ["Zhonghua Primary School", "bishan", "popular", 1.3595, 103.869],
  // Ang Mo Kio
  ["Ai Tong School", "amk", "elite sap affiliated", 1.3608, 103.8345],
  ["Anderson Primary School", "amk", "popular", 1.3702, 103.8418],
  ["CHIJ St. Nicholas Girls' School (Primary)", "amk", "elite girls sap affiliated gep", 1.3637, 103.8388],
  ["Mayflower Primary School", "amk", "popular", 1.368, 103.833],
  ["Jing Shan Primary School", "amk", "standard", 1.3735, 103.847],
  ["Townsville Primary School", "amk", "standard", 1.3625, 103.8565],
  ["Teck Ghee Primary School", "amk", "standard", 1.3725, 103.85],
  ["Da Qiao Primary School", "amk", "standard", 1.3768, 103.853],
  ["Yio Chu Kang Primary School", "seletar", "standard", 1.38, 103.846],
  // Serangoon / Hougang
  ["Rosyth School", "serangoon", "elite gep", 1.3705, 103.873],
  ["Yangzheng Primary School", "serangoon", "popular", 1.3565, 103.872],
  ["Maris Stella High School (Primary)", "serangoon", "elite boys sap affiliated", 1.3445, 103.8745],
  ["CHIJ Our Lady of Good Counsel", "serangoon", "popular girls affiliated", 1.364, 103.8665],
  ["St. Gabriel's Primary School", "serangoon", "popular boys affiliated", 1.352, 103.865],
  ["Holy Innocents' Primary School", "hougang", "popular affiliated", 1.3625, 103.8835],
  ["Hougang Primary School", "hougang", "standard", 1.37, 103.8895],
  ["Montfort Junior School", "hougang", "popular boys affiliated", 1.3745, 103.8895],
  ["Xinghua Primary School", "hougang", "standard", 1.3795, 103.887],
  ["Xinmin Primary School", "hougang", "popular", 1.376, 103.883],
  ["CHIJ Our Lady of the Nativity", "hougang", "popular girls affiliated", 1.368, 103.8865],
  ["Paya Lebar Methodist Girls' School (Primary)", "hougang", "popular girls affiliated", 1.364, 103.887],
  // Sengkang
  ["Anchor Green Primary School", "sengkang", "standard", 1.3935, 103.8865],
  ["Compassvale Primary School", "sengkang", "standard", 1.3905, 103.8985],
  ["Fern Green Primary School", "sengkang", "standard", 1.392, 103.8755],
  ["Nan Chiau Primary School", "sengkang", "elite sap", 1.3895, 103.887],
  ["North Spring Primary School", "sengkang", "standard", 1.394, 103.89],
  ["North Vista Primary School", "sengkang", "standard", 1.388, 103.899],
  ["Palm View Primary School", "sengkang", "standard", 1.396, 103.8945],
  ["Sengkang Green Primary School", "sengkang", "standard", 1.392, 103.874],
  ["Springdale Primary School", "sengkang", "standard", 1.395, 103.8825],
  // Punggol
  ["Edgefield Primary School", "punggol", "standard", 1.396, 103.907],
  ["Greendale Primary School", "punggol", "standard", 1.394, 103.9105],
  ["Horizon Primary School", "punggol", "standard", 1.401, 103.899],
  ["Mee Toh School", "punggol", "popular", 1.397, 103.906],
  ["Oasis Primary School", "punggol", "standard", 1.403, 103.908],
  ["Punggol Cove Primary School", "punggol", "standard", 1.4115, 103.908],
  ["Punggol Green Primary School", "punggol", "standard", 1.4015, 103.8945],
  ["Punggol Primary School", "punggol", "standard", 1.4, 103.9095],
  ["Punggol View Primary School", "punggol", "standard", 1.4035, 103.9015],
  ["Valour Primary School", "punggol", "standard", 1.408, 103.9035],
  ["Waterway Primary School", "punggol", "standard", 1.4045, 103.9],
  // Tampines
  ["Angsana Primary School", "tampines", "standard", 1.3475, 103.945],
  ["Chongzheng Primary School", "tampines", "standard", 1.352, 103.952],
  ["Gongshang Primary School", "tampines", "popular", 1.358, 103.956],
  ["Junyuan Primary School", "tampines", "standard", 1.349, 103.948],
  ["Poi Ching School", "tampines", "popular sap", 1.358, 103.941],
  ["St. Hilda's Primary School", "tampines", "popular affiliated", 1.353, 103.941],
  ["Tampines Primary School", "tampines", "standard", 1.351, 103.951],
  ["Tampines North Primary School", "tampines", "standard", 1.362, 103.943],
  ["East Spring Primary School", "tampines", "standard", 1.3565, 103.962],
  ["Yumin Primary School", "tampines", "standard", 1.3505, 103.9525],
  // Pasir Ris (mapped under Tampines region)
  ["Casuarina Primary School", "tampines", "standard", 1.3735, 103.927],
  ["Coral Primary School", "tampines", "standard", 1.3725, 103.942],
  ["Elias Park Primary School", "tampines", "standard", 1.376, 103.93],
  ["Loyang Primary School", "changi", "standard", 1.368, 103.959],
  ["Meridian Primary School", "tampines", "standard", 1.374, 103.9395],
  ["Park View Primary School", "tampines", "standard", 1.372, 103.933],
  ["Pasir Ris Primary School", "tampines", "standard", 1.37, 103.9555],
  ["White Sands Primary School", "tampines", "popular", 1.3705, 103.951],
  // Changi / Simei
  ["Changkat Primary School", "changi", "standard", 1.345, 103.956],
  ["East View Primary School", "changi", "standard", 1.362, 103.946],
  // Bedok
  ["Bedok Green Primary School", "bedok", "standard", 1.33, 103.935],
  ["Fengshan Primary School", "bedok", "standard", 1.3315, 103.9385],
  ["Red Swastika School", "bedok", "elite sap", 1.334, 103.941],
  ["St. Stephen's School", "bedok", "popular boys affiliated", 1.315, 103.929],
  ["Temasek Primary School", "bedok", "elite", 1.321, 103.946],
  ["Yu Neng Primary School", "bedok", "popular", 1.329, 103.927],
  ["Damai Primary School", "bedok", "standard", 1.336, 103.92],
  ["Opera Estate Primary School", "bedok", "popular", 1.3215, 103.9265],
  // Geylang / Katong
  ["Tao Nan School", "katong", "elite sap gep", 1.3025, 103.908],
  ["Kong Hwa School", "geylang", "elite sap", 1.311, 103.887],
  ["Haig Girls' School", "katong", "popular girls", 1.3105, 103.899],
  ["CHIJ (Katong) Primary", "katong", "popular girls affiliated", 1.308, 103.9],
  ["Tanjong Katong Primary School", "katong", "elite", 1.311, 103.8945],
  ["Ngee Ann Primary School", "katong", "popular", 1.304, 103.912],
  ["Telok Kurau Primary School", "katong", "popular", 1.316, 103.914],
  ["Geylang Methodist School (Primary)", "geylang", "popular affiliated", 1.317, 103.887],
  ["Cedar Primary School", "geylang", "popular", 1.33, 103.881],
  ["Canossa Catholic Primary School", "geylang", "popular affiliated", 1.321, 103.8835],
  ["Maha Bodhi School", "geylang", "popular", 1.3255, 103.899],
  ["Eunos Primary School", "geylang", "standard", 1.326, 103.902],
  ["MacPherson Primary School", "geylang", "standard", 1.3265, 103.887],
  // Jurong East
  ["Fuhua Primary School", "jurongeast", "standard", 1.346, 103.733],
  ["Jurong Primary School", "jurongeast", "standard", 1.347, 103.737],
  ["Yuhua Primary School", "jurongeast", "standard", 1.3475, 103.739],
  ["Shuqun Primary School", "jurongeast", "standard", 1.343, 103.734],
  // Jurong West / Boon Lay
  ["Boon Lay Garden Primary School", "boonlay", "standard", 1.346, 103.711],
  ["Corporation Primary School", "jurongwest", "standard", 1.3445, 103.722],
  ["Frontier Primary School", "jurongwest", "popular", 1.3395, 103.696],
  ["Juying Primary School", "jurongwest", "standard", 1.339, 103.6935],
  ["Lakeside Primary School", "jurongwest", "standard", 1.337, 103.722],
  ["Pioneer Primary School", "boonlay", "standard", 1.342, 103.697],
  ["Rulang Primary School", "jurongwest", "popular", 1.349, 103.723],
  ["West Grove Primary School", "jurongwest", "standard", 1.34, 103.6985],
  ["Westwood Primary School", "jurongwest", "standard", 1.3415, 103.6945],
  ["Xingnan Primary School", "jurongwest", "standard", 1.3375, 103.697],
  ["Jurong West Primary School", "jurongwest", "standard", 1.349, 103.718],
  // Bukit Batok
  ["Bukit View Primary School", "bukitbatok", "standard", 1.3585, 103.77],
  ["Dazhong Primary School", "bukitbatok", "standard", 1.364, 103.756],
  ["Keming Primary School", "bukitbatok", "standard", 1.358, 103.756],
  ["Lianhua Primary School", "bukitbatok", "standard", 1.3625, 103.7565],
  ["Princess Elizabeth Primary School", "bukitbatok", "popular", 1.349, 103.756],
  ["St. Anthony's Primary School", "bukitbatok", "popular affiliated", 1.3525, 103.7505],
  // Bukit Panjang
  ["Beacon Primary School", "bukitpanjang", "popular", 1.3805, 103.774],
  ["Bukit Panjang Primary School", "bukitpanjang", "standard", 1.385, 103.767],
  ["CHIJ Our Lady Queen of Peace", "bukitpanjang", "popular girls affiliated", 1.376, 103.774],
  ["Greenridge Primary School", "bukitpanjang", "standard", 1.379, 103.768],
  ["South View Primary School", "bukitpanjang", "standard", 1.381, 103.77],
  ["Teck Whye Primary School", "bukitpanjang", "standard", 1.3795, 103.753],
  ["West View Primary School", "bukitpanjang", "standard", 1.383, 103.772],
  ["Zhenghua Primary School", "bukitpanjang", "standard", 1.387, 103.7625],
  // Choa Chu Kang
  ["Chua Chu Kang Primary School", "cck", "standard", 1.3855, 103.748],
  ["Concord Primary School", "cck", "standard", 1.3835, 103.743],
  ["De La Salle School", "cck", "popular affiliated", 1.379, 103.745],
  ["Kranji Primary School", "cck", "standard", 1.3915, 103.7445],
  ["Unity Primary School", "cck", "standard", 1.3845, 103.7395],
  ["Yew Tee Primary School", "cck", "standard", 1.3955, 103.747],
  // Woodlands
  ["Admiralty Primary School", "woodlands", "standard", 1.442, 103.8005],
  ["Evergreen Primary School", "woodlands", "standard", 1.429, 103.796],
  ["Fuchun Primary School", "woodlands", "standard", 1.435, 103.774],
  ["Greenwood Primary School", "woodlands", "standard", 1.438, 103.8],
  ["Innova Primary School", "woodlands", "standard", 1.433, 103.79],
  ["Marsiling Primary School", "woodlands", "standard", 1.44, 103.7755],
  ["Qihua Primary School", "woodlands", "standard", 1.44, 103.792],
  ["Riverside Primary School", "woodlands", "standard", 1.4435, 103.7945],
  ["Si Ling Primary School", "woodlands", "standard", 1.438, 103.779],
  ["Woodgrove Primary School", "woodlands", "standard", 1.441, 103.7975],
  ["Woodlands Primary School", "woodlands", "standard", 1.4395, 103.7935],
  ["Woodlands Ring Primary School", "woodlands", "standard", 1.433, 103.7995],
  // Yishun
  ["Chongfu School", "yishun", "popular sap", 1.4255, 103.8295],
  ["Huamin Primary School", "yishun", "standard", 1.4225, 103.8345],
  ["Jiemin Primary School", "yishun", "standard", 1.429, 103.84],
  ["North View Primary School", "yishun", "standard", 1.4185, 103.8345],
  ["Northland Primary School", "yishun", "standard", 1.431, 103.8245],
  ["Peiying Primary School", "yishun", "standard", 1.429, 103.8345],
  ["Xishan Primary School", "yishun", "standard", 1.433, 103.833],
  ["Yishun Primary School", "yishun", "standard", 1.425, 103.8395],
  ["Ahmad Ibrahim Primary School", "yishun", "standard", 1.4225, 103.826],
  // Sembawang (mapped under Yishun region)
  ["Canberra Primary School", "yishun", "standard", 1.449, 103.817],
  ["Endeavour Primary School", "yishun", "standard", 1.4525, 103.8185],
  ["Sembawang Primary School", "yishun", "standard", 1.4485, 103.819],
  ["Wellington Primary School", "yishun", "standard", 1.45, 103.8095],
  ["Naval Base Primary School", "yishun", "standard", 1.436, 103.834],
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
