/**
 * build-schools.ts — synthetic dataset generator for P1 Compass.
 *
 * The production data pipeline scrapes MOE School Finder + geocodes via OneMap.
 * That cannot run in every environment, so this script produces a deterministic,
 * broad-coverage synthetic dataset (real-ish school names, plausible coordinates
 * and ballot history) used for development and demos.
 *
 *   bun scripts/build-schools.ts
 *
 * Writes data/schools.json and data/postal_sectors.json. Re-running is idempotent.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
// [name, regionKey, tags]  — tags: tier (elite|popular|standard) + flags.

type Tier = "elite" | "popular" | "standard";
type Def = [name: string, region: keyof typeof REGIONS, tags: string];

const SCHOOL_DEFS: Def[] = [
  // City / Bukit Merah / Queenstown
  ["Cantonment Primary School", "city", "standard"],
  ["River Valley Primary School", "orchard", "popular"],
  ["Radin Mas Primary School", "bukitmerah", "popular"],
  ["Gan Eng Seng Primary School", "bukitmerah", "standard"],
  ["Zhangde Primary School", "bukitmerah", "popular"],
  ["CHIJ (Kellock)", "bukitmerah", "popular girls affiliated"],
  ["Blangah Rise Primary School", "bukitmerah", "standard"],
  ["Alexandra Primary School", "queenstown", "popular"],
  ["Queenstown Primary School", "queenstown", "standard"],
  ["New Town Primary School", "queenstown", "popular"],
  ["Fairfield Methodist School (Primary)", "queenstown", "popular affiliated"],
  // Clementi
  ["Clementi Primary School", "clementi", "standard"],
  ["Nan Hua Primary School", "clementi", "elite sap gep"],
  ["Pei Tong Primary School", "clementi", "popular"],
  ["Qifa Primary School", "clementi", "popular"],
  // Holland / Bukit Timah
  ["Henry Park Primary School", "holland", "elite gep"],
  ["Nanyang Primary School", "holland", "elite sap gep affiliated"],
  ["Raffles Girls' Primary School", "holland", "elite girls"],
  ["Methodist Girls' School (Primary)", "holland", "elite girls affiliated"],
  ["Pei Hwa Presbyterian Primary School", "holland", "popular"],
  ["Bukit Timah Primary School", "holland", "popular"],
  // Orchard / Novena
  ["Anglo-Chinese School (Primary)", "orchard", "elite boys affiliated"],
  ["Anglo-Chinese School (Junior)", "novena", "elite boys affiliated"],
  ["Singapore Chinese Girls' Primary School", "orchard", "elite girls"],
  ["St. Margaret's School (Primary)", "orchard", "popular girls affiliated"],
  ["St. Joseph's Institution Junior", "novena", "popular boys affiliated"],
  ["Balestier Hill Primary School", "novena", "standard"],
  // Toa Payoh
  ["CHIJ Primary (Toa Payoh)", "toapayoh", "popular girls affiliated"],
  ["First Toa Payoh Primary School", "toapayoh", "standard"],
  ["Pei Chun Public School", "toapayoh", "popular"],
  ["Kheng Cheng School", "toapayoh", "popular"],
  ["Hong Wen School", "kallang", "popular"],
  ["Bendemeer Primary School", "kallang", "standard"],
  ["St. Andrew's Junior School", "kallang", "popular boys affiliated"],
  ["Farrer Park Primary School", "kallang", "standard"],
  ["Stamford Primary School", "kallang", "standard"],
  // Bishan
  ["Catholic High School (Primary)", "bishan", "elite boys sap affiliated"],
  ["Kuo Chuan Presbyterian Primary School", "bishan", "popular affiliated"],
  ["Guangyang Primary School", "bishan", "standard"],
  ["Marymount Convent School", "bishan", "popular girls"],
  ["Zhonghua Primary School", "bishan", "popular"],
  // Ang Mo Kio
  ["Ai Tong School", "amk", "elite sap affiliated"],
  ["Anderson Primary School", "amk", "popular"],
  ["CHIJ St. Nicholas Girls' School (Primary)", "amk", "elite girls sap affiliated gep"],
  ["Mayflower Primary School", "amk", "popular"],
  ["Jing Shan Primary School", "amk", "standard"],
  ["Townsville Primary School", "amk", "standard"],
  ["Teck Ghee Primary School", "amk", "standard"],
  ["Da Qiao Primary School", "amk", "standard"],
  ["Yio Chu Kang Primary School", "seletar", "standard"],
  // Serangoon / Hougang
  ["Rosyth School", "serangoon", "elite gep"],
  ["Yangzheng Primary School", "serangoon", "popular"],
  ["Maris Stella High School (Primary)", "serangoon", "elite boys sap affiliated"],
  ["CHIJ Our Lady of Good Counsel", "serangoon", "popular girls affiliated"],
  ["St. Gabriel's Primary School", "serangoon", "popular boys affiliated"],
  ["Holy Innocents' Primary School", "hougang", "popular affiliated"],
  ["Hougang Primary School", "hougang", "standard"],
  ["Montfort Junior School", "hougang", "popular boys affiliated"],
  ["Xinghua Primary School", "hougang", "standard"],
  ["Xinmin Primary School", "hougang", "popular"],
  ["CHIJ Our Lady of the Nativity", "hougang", "popular girls affiliated"],
  ["Paya Lebar Methodist Girls' School (Primary)", "hougang", "popular girls affiliated"],
  // Sengkang
  ["Anchor Green Primary School", "sengkang", "standard"],
  ["Compassvale Primary School", "sengkang", "standard"],
  ["Fern Green Primary School", "sengkang", "standard"],
  ["Nan Chiau Primary School", "sengkang", "elite sap"],
  ["North Spring Primary School", "sengkang", "standard"],
  ["North Vista Primary School", "sengkang", "standard"],
  ["Palm View Primary School", "sengkang", "standard"],
  ["Sengkang Green Primary School", "sengkang", "standard"],
  ["Springdale Primary School", "sengkang", "standard"],
  // Punggol
  ["Edgefield Primary School", "punggol", "standard"],
  ["Greendale Primary School", "punggol", "standard"],
  ["Horizon Primary School", "punggol", "standard"],
  ["Mee Toh School", "punggol", "popular"],
  ["Oasis Primary School", "punggol", "standard"],
  ["Punggol Cove Primary School", "punggol", "standard"],
  ["Punggol Green Primary School", "punggol", "standard"],
  ["Punggol Primary School", "punggol", "standard"],
  ["Punggol View Primary School", "punggol", "standard"],
  ["Valour Primary School", "punggol", "standard"],
  ["Waterway Primary School", "punggol", "standard"],
  // Tampines
  ["Angsana Primary School", "tampines", "standard"],
  ["Chongzheng Primary School", "tampines", "standard"],
  ["Gongshang Primary School", "tampines", "popular"],
  ["Junyuan Primary School", "tampines", "standard"],
  ["Poi Ching School", "tampines", "popular sap"],
  ["St. Hilda's Primary School", "tampines", "popular affiliated"],
  ["Tampines Primary School", "tampines", "standard"],
  ["Tampines North Primary School", "tampines", "standard"],
  ["East Spring Primary School", "tampines", "standard"],
  ["Yumin Primary School", "tampines", "standard"],
  // Pasir Ris (mapped under Tampines region)
  ["Casuarina Primary School", "tampines", "standard"],
  ["Coral Primary School", "tampines", "standard"],
  ["Elias Park Primary School", "tampines", "standard"],
  ["Loyang Primary School", "changi", "standard"],
  ["Meridian Primary School", "tampines", "standard"],
  ["Park View Primary School", "tampines", "standard"],
  ["Pasir Ris Primary School", "tampines", "standard"],
  ["White Sands Primary School", "tampines", "popular"],
  // Changi / Simei
  ["Changkat Primary School", "changi", "standard"],
  ["East View Primary School", "changi", "standard"],
  // Bedok
  ["Bedok Green Primary School", "bedok", "standard"],
  ["Fengshan Primary School", "bedok", "standard"],
  ["Red Swastika School", "bedok", "elite sap"],
  ["St. Stephen's School", "bedok", "popular boys affiliated"],
  ["Temasek Primary School", "bedok", "elite"],
  ["Yu Neng Primary School", "bedok", "popular"],
  ["Damai Primary School", "bedok", "standard"],
  ["Opera Estate Primary School", "bedok", "popular"],
  // Geylang / Katong
  ["Tao Nan School", "katong", "elite sap gep"],
  ["Kong Hwa School", "geylang", "elite sap"],
  ["Haig Girls' School", "katong", "popular girls"],
  ["CHIJ (Katong) Primary", "katong", "popular girls affiliated"],
  ["Tanjong Katong Primary School", "katong", "elite"],
  ["Ngee Ann Primary School", "katong", "popular"],
  ["Telok Kurau Primary School", "katong", "popular"],
  ["Geylang Methodist School (Primary)", "geylang", "popular affiliated"],
  ["Cedar Primary School", "geylang", "popular"],
  ["Canossa Catholic Primary School", "geylang", "popular affiliated"],
  ["Maha Bodhi School", "geylang", "popular"],
  ["Eunos Primary School", "geylang", "standard"],
  ["MacPherson Primary School", "geylang", "standard"],
  // Jurong East
  ["Fuhua Primary School", "jurongeast", "standard"],
  ["Jurong Primary School", "jurongeast", "standard"],
  ["Yuhua Primary School", "jurongeast", "standard"],
  ["Shuqun Primary School", "jurongeast", "standard"],
  // Jurong West / Boon Lay
  ["Boon Lay Garden Primary School", "boonlay", "standard"],
  ["Corporation Primary School", "jurongwest", "standard"],
  ["Frontier Primary School", "jurongwest", "popular"],
  ["Juying Primary School", "jurongwest", "standard"],
  ["Lakeside Primary School", "jurongwest", "standard"],
  ["Pioneer Primary School", "boonlay", "standard"],
  ["Rulang Primary School", "jurongwest", "popular"],
  ["West Grove Primary School", "jurongwest", "standard"],
  ["Westwood Primary School", "jurongwest", "standard"],
  ["Xingnan Primary School", "jurongwest", "standard"],
  ["Jurong West Primary School", "jurongwest", "standard"],
  // Bukit Batok
  ["Bukit View Primary School", "bukitbatok", "standard"],
  ["Dazhong Primary School", "bukitbatok", "standard"],
  ["Keming Primary School", "bukitbatok", "standard"],
  ["Lianhua Primary School", "bukitbatok", "standard"],
  ["Princess Elizabeth Primary School", "bukitbatok", "popular"],
  ["St. Anthony's Primary School", "bukitbatok", "popular affiliated"],
  // Bukit Panjang
  ["Beacon Primary School", "bukitpanjang", "popular"],
  ["Bukit Panjang Primary School", "bukitpanjang", "standard"],
  ["CHIJ Our Lady Queen of Peace", "bukitpanjang", "popular girls affiliated"],
  ["Greenridge Primary School", "bukitpanjang", "standard"],
  ["South View Primary School", "bukitpanjang", "standard"],
  ["Teck Whye Primary School", "bukitpanjang", "standard"],
  ["West View Primary School", "bukitpanjang", "standard"],
  ["Zhenghua Primary School", "bukitpanjang", "standard"],
  // Choa Chu Kang
  ["Chua Chu Kang Primary School", "cck", "standard"],
  ["Concord Primary School", "cck", "standard"],
  ["De La Salle School", "cck", "popular affiliated"],
  ["Kranji Primary School", "cck", "standard"],
  ["Unity Primary School", "cck", "standard"],
  ["Yew Tee Primary School", "cck", "standard"],
  // Woodlands
  ["Admiralty Primary School", "woodlands", "standard"],
  ["Evergreen Primary School", "woodlands", "standard"],
  ["Fuchun Primary School", "woodlands", "standard"],
  ["Greenwood Primary School", "woodlands", "standard"],
  ["Innova Primary School", "woodlands", "standard"],
  ["Marsiling Primary School", "woodlands", "standard"],
  ["Qihua Primary School", "woodlands", "standard"],
  ["Riverside Primary School", "woodlands", "standard"],
  ["Si Ling Primary School", "woodlands", "standard"],
  ["Woodgrove Primary School", "woodlands", "standard"],
  ["Woodlands Primary School", "woodlands", "standard"],
  ["Woodlands Ring Primary School", "woodlands", "standard"],
  // Yishun
  ["Chongfu School", "yishun", "popular sap"],
  ["Huamin Primary School", "yishun", "standard"],
  ["Jiemin Primary School", "yishun", "standard"],
  ["North View Primary School", "yishun", "standard"],
  ["Northland Primary School", "yishun", "standard"],
  ["Peiying Primary School", "yishun", "standard"],
  ["Xishan Primary School", "yishun", "standard"],
  ["Yishun Primary School", "yishun", "standard"],
  ["Ahmad Ibrahim Primary School", "yishun", "standard"],
  // Sembawang (mapped under Yishun region)
  ["Canberra Primary School", "yishun", "standard"],
  ["Endeavour Primary School", "yishun", "standard"],
  ["Sembawang Primary School", "yishun", "standard"],
  ["Wellington Primary School", "yishun", "standard"],
  ["Naval Base Primary School", "yishun", "standard"],
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

// --- generation --------------------------------------------------------------

function compFor(tier: Tier, rng: () => number): number {
  const baseByTier: Record<Tier, number> = {
    elite: 0.86,
    popular: 0.56,
    standard: 0.26,
  };
  return Math.max(0, Math.min(1, baseByTier[tier] + gaussian(rng) * 0.12));
}

function buildSchools(): School[] {
  const usedIds = new Set<string>();
  return SCHOOL_DEFS.map((def, i) => {
    const [name, regionKey, tagStr] = def;
    const region = REGIONS[regionKey];
    const tags = tagStr.split(/\s+/);
    const tier: Tier = tags.includes("elite")
      ? "elite"
      : tags.includes("popular")
        ? "popular"
        : "standard";
    const rng = mulberry32(4001 + i * 131);

    // location: scatter around the region centroid (~1.1km std dev)
    const lat = +(region.lat + gaussian(rng) * 0.0095).toFixed(6);
    const lng = +(region.lng + gaussian(rng) * 0.0095).toFixed(6);

    // school type
    const type: SchoolType[] = [];
    if (tags.includes("sap")) type.push("SAP");
    if (tags.includes("affiliated")) type.push("Affiliated");
    if (tags.includes("boys")) type.push("Boys");
    if (tags.includes("girls")) type.push("Girls");
    if (tags.includes("gep")) type.push("GEP");
    if (type.length === 0) type.push("Neighbourhood");

    // address + postal
    const sector = pick(rng, region.sectors);
    const postal = sector + String(Math.floor(rng() * 10000)).padStart(4, "0");
    const block = 100 + Math.floor(rng() * 780);
    const streetArea = region.name.split(" & ")[0];
    const street = `${streetArea} ${pick(rng, STREETS)} ${1 + Math.floor(rng() * 12)}`;
    const address = `Blk ${block} ${street}, Singapore ${postal}`;

    // vacancies (latest cycle)
    const total = 180 + Math.floor(rng() * 150);
    const phase1 = Math.round(total * (0.2 + rng() * 0.14));
    const phase2a = Math.round(total * (0.06 + rng() * 0.1));
    const phase2b = Math.round(total * (0.05 + rng() * 0.07));
    const phase2c = Math.max(15, total - phase1 - phase2a - phase2b);

    const comp = compFor(tier, rng);

    return {
      id: makeId(name, usedIds),
      code: 7001 + i,
      name,
      short: makeShort(name),
      address,
      postal,
      lat,
      lng,
      type,
      affiliations: tags.includes("affiliated") ? affiliationsFor(name) : [],
      ccas: sample(rng, CCAS, 5 + Math.floor(rng() * 4)),
      programmes: sample(rng, PROGRAMMES, 1 + Math.floor(rng() * 2)),
      vacancies: { year: 2025, total, phase1, phase2a, phase2b, phase2c },
      ballot: buildBallot(rng, comp),
    } satisfies School;
  });
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

const schools = buildSchools();
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
