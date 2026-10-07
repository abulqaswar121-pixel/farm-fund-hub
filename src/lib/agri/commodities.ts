/**
 * Commodity catalogue and the six-stage lifecycle every NDH AgriCapital cycle
 * moves through, regardless of what is being grown or reared.
 *
 * This module is pure data + pure functions: it is imported by the public
 * marketplace, all three portals and the ledger maths, so it must stay free of
 * browser APIs and of any database access.
 */
import { Bird, Egg, Fish, Sprout, Waves, Wheat, type LucideIcon } from "lucide-react";

export type CommodityId = "catfish" | "tilapia" | "broiler" | "layer" | "grain" | "greenhouse";

export type Commodity = {
  id: CommodityId;
  name: string;
  icon: LucideIcon;
  /** The species or crop tag printed on the marketplace card banner. */
  species: string;
  /** Card banner photograph, served from /public. */
  image: string;
  /** One-line description used on marketplace cards. */
  summary: string;
  /** The unit the operator logs growth in. */
  growthUnit: string;
  /** The unit the operator logs feed in. */
  feedUnit: string;
  /** What one complete cycle of this stock typically runs for. */
  typicalDurationWeeks: number;
  /** Target weight / yield the operator is steering toward. */
  targetYieldLabel: string;
  /** How revenue is realised at the end of the cycle. */
  revenueBasis: string;
  accent: "cyan" | "violet" | "amber" | "emerald" | "rose";
  /** Telemetry the operator is asked for on the daily quick-log (portal-facing). */
  telemetry: string[];
  /**
   * The same records, in the words a visitor uses. Public pages show this list
   * instead of `telemetry`, because "feed conversion ratio" is not an answer to
   * "what do you actually do every day?".
   */
  telemetryPlain: { label: string; hint: string }[];
  /** Stage names for this stock, replacing the generic labels where useful. */
  stockingLabel: string;
};

export const COMMODITIES: Commodity[] = [
  {
    id: "catfish",
    name: "Catfish Aquaculture",
    icon: Fish,
    species: "Clarias gariepinus",
    image: "/images/commodities/catfish.jpg",
    summary:
      "Fingerlings are raised to table size in lined ponds. We weigh a sample every week so you can see them growing.",
    growthUnit: "g / fish",
    feedUnit: "kg of feed",
    typicalDurationWeeks: 20,
    targetYieldLabel: "About 1 kg per fish",
    revenueBasis:
      "The fish are sold by weight to wholesale traders when they reach table size, and the scale ticket is kept as proof of the sale.",
    accent: "cyan",
    telemetry: [
      "Biomass (kg) in each pond",
      "Average sampled weight (g) per fish",
      "Feed conversion ratio",
      "Mortality count and cause",
    ],
    telemetryPlain: [
      {
        label: "Feed used",
        hint: "How much feed the fish ate, so you can see the cost staying in line with their growth.",
      },
      {
        label: "Average weight",
        hint: "Fish are netted at random and weighed, so this is a real measurement and not an estimate.",
      },
      {
        label: "Water checks",
        hint: "Oxygen and temperature are tested, because fish stop growing when the water slips.",
      },
      {
        label: "Fish lost",
        hint: "Any fish that die are counted and the reason written down, even when the number is small.",
      },
    ],
    stockingLabel: "Stocking fingerlings into ponds",
  },
  {
    id: "tilapia",
    name: "Tilapia Aquaculture",
    icon: Waves,
    species: "Oreochromis niloticus",
    image: "/images/commodities/tilapia.jpg",
    summary:
      "Nile tilapia grow in lined tanks and cages to plate size. Water quality and sample weights are recorded every week.",
    growthUnit: "g / fish",
    feedUnit: "kg of feed",
    typicalDurationWeeks: 24,
    targetYieldLabel: "500 – 700 g per fish",
    revenueBasis:
      "Fresh whole fish are sold to hotels, cold rooms and market traders, with the weight and price recorded at sale.",
    accent: "cyan",
    telemetry: [
      "Biomass (kg) in each tank or cage",
      "Average sampled weight (g) per fish",
      "Dissolved oxygen and water temperature",
      "Feed conversion ratio and mortality",
    ],
    telemetryPlain: [
      {
        label: "Feed used",
        hint: "How much feed the fish ate, kept beside their growth so costs stay visible.",
      },
      {
        label: "Average weight",
        hint: "A random sample is weighed each week to show how close the fish are to market size.",
      },
      {
        label: "Water checks",
        hint: "Oxygen, temperature and clarity are tested because tilapia are sensitive to poor water.",
      },
      {
        label: "Fish lost",
        hint: "Deaths are counted and the cause recorded, so a bad week is never quietly dropped.",
      },
    ],
    stockingLabel: "Stocking monosex tilapia fingerlings",
  },
  {
    id: "broiler",
    name: "Broiler Poultry",
    icon: Bird,
    species: "Ross 308 day-old chicks",
    image: "/images/commodities/broiler.jpg",
    summary:
      "Day-old chicks are reared for six to eight weeks until they reach meat weight, mostly for hotels and festive trade.",
    growthUnit: "kg live weight",
    feedUnit: "bags of feed",
    typicalDurationWeeks: 7,
    targetYieldLabel: "1.8 – 2.2 kg per bird",
    revenueBasis:
      "Birds are sold by live weight or dressed to processors, hotels and market traders, with the collection note kept.",
    accent: "amber",
    telemetry: [
      "Average live weight (kg) per bird",
      "Feed intake in bags",
      "Mortality count and cause",
      "Vaccination and medication administered",
    ],
    telemetryPlain: [
      {
        label: "Feed used",
        hint: "Bags of feed recorded as they are used, which is the single biggest cost in a poultry cycle.",
      },
      {
        label: "Average weight",
        hint: "A sample of birds is weighed each week so you can follow them toward market size.",
      },
      {
        label: "Health cover",
        hint: "Vaccinations and treatments are written down with the date, so nothing is skipped quietly.",
      },
      {
        label: "Birds lost",
        hint: "Deaths are counted and the reason recorded — it is the first warning of a disease problem.",
      },
    ],
    stockingLabel: "Stocking day-old chicks into pens",
  },
  {
    id: "layer",
    name: "Layer Poultry",
    icon: Egg,
    species: "Isa Brown point-of-lay pullets",
    image: "/images/commodities/layer.jpg",
    summary:
      "Young hens are raised to laying age, then produce eggs daily for twelve to eighteen months.",
    growthUnit: "crates / day",
    feedUnit: "bags of feed",
    typicalDurationWeeks: 60,
    targetYieldLabel: "80 – 92% of hens laying",
    revenueBasis:
      "Eggs are sold in crates most days, and the hens themselves are sold at the end of their laying life.",
    accent: "violet",
    telemetry: [
      "Crates collected per day",
      "Lay rate percentage of flock",
      "Feed intake in bags",
      "Mortality count and cause",
    ],
    telemetryPlain: [
      {
        label: "Eggs collected",
        hint: "Crates are counted every day, which is how this cycle earns money.",
      },
      {
        label: "How many hens are laying",
        hint: "The share of the flock producing eggs — it falls slowly as hens get older.",
      },
      {
        label: "Feed used",
        hint: "Feed is the main cost of a layer cycle and is logged every day it is bought.",
      },
      {
        label: "Hens lost",
        hint: "Deaths are counted and the cause recorded, so a health problem shows up early.",
      },
    ],
    stockingLabel: "Stocking point-of-lay birds into the layer house",
  },
  {
    id: "grain",
    name: "Grain & Field Crops",
    icon: Wheat,
    species: "Maize, soya & rice",
    image: "/images/commodities/grain.jpg",
    summary:
      "Maize, soya or rice is planted, weeded and fed through a full season, and counted in bags at harvest.",
    growthUnit: "bags / hectare",
    feedUnit: "kg of fertiliser",
    typicalDurationWeeks: 18,
    targetYieldLabel: "45 – 70 bags per hectare",
    revenueBasis:
      "Bags are sold to aggregators at the recorded market price for the week, and the receipts are kept.",
    accent: "emerald",
    telemetry: [
      "Hectares planted and standing",
      "Agrochemical application log",
      "Bags harvested per hectare",
      "Rainfall and soil moisture observations",
    ],
    telemetryPlain: [
      {
        label: "Land planted",
        hint: "How many hectares are actually in the ground, measured on the farm and not on paper.",
      },
      {
        label: "Sprays and fertiliser",
        hint: "What was applied, when and how much — the biggest variable cost of a field crop.",
      },
      {
        label: "Bags harvested",
        hint: "The harvest is counted in bags per hectare, which is how the crop is sold.",
      },
      {
        label: "Rain recorded",
        hint: "Rainfall is logged at the site, because too little or too much water decides the yield.",
      },
    ],
    stockingLabel: "Planting and land preparation",
  },
  {
    id: "greenhouse",
    name: "Greenhouses & Horticulture",
    icon: Sprout,
    species: "Tomatoes & bell peppers",
    image: "/images/commodities/greenhouse.jpg",
    summary:
      "Tomatoes and bell peppers grow under cover with drip irrigation, which protects them from pests and dry spells.",
    growthUnit: "kg / m²",
    feedUnit: "kg of nutrient blend",
    typicalDurationWeeks: 24,
    targetYieldLabel: "18 – 26 kg per m²",
    revenueBasis:
      "Good-grade produce is sold to supermarkets, restaurants and market traders, and graded produce is discounted openly instead of counted as full value.",
    accent: "rose",
    telemetry: [
      "Harvest kilograms per square metre",
      "Trellising and pruning actions",
      "Nutrient blend applied",
      "Pest pressure and control measures",
    ],
    telemetryPlain: [
      {
        label: "Harvest per square metre",
        hint: "Produce is weighed as it is picked, which is the clearest measure of how the house is doing.",
      },
      {
        label: "Water and nutrients",
        hint: "Drip feeding is recorded, because under cover the plant gets exactly what is measured out.",
      },
      {
        label: "Crop care",
        hint: "Pruning and supporting the plants is logged, as this is what keeps fruit coming.",
      },
      {
        label: "Pests watched",
        hint: "Pest pressure and any treatment are written down, so a problem cannot spread unnoticed.",
      },
    ],
    stockingLabel: "Transplanting seedlings into the greenhouse",
  },
];

export function getCommodity(id: string): Commodity | undefined {
  return COMMODITIES.find((commodity) => commodity.id === id);
}

/* -------------------------------------------------------------------------- *
 * The six-stage lifecycle
 * -------------------------------------------------------------------------- */

export type StageId =
  | "funding_open"
  | "stocking"
  | "operational"
  | "harvest_weighin"
  | "sale_settlement"
  | "waterfall_distribution";

export type Stage = {
  id: StageId;
  index: number;
  name: string;
  description: string;
  /** Who is expected to act at this stage. */
  owner: "admin" | "operator" | "market";
};

export const STAGES: Stage[] = [
  {
    id: "funding_open",
    index: 1,
    name: "Collecting money",
    description: "Members put money into this cycle. Every payment is confirmed before it counts.",
    owner: "market",
  },
  {
    id: "stocking",
    index: 2,
    name: "Stocking the farm",
    description:
      "Funding closes and the stock is bought and placed into the ponds, pens or fields.",
    owner: "operator",
  },
  {
    id: "operational",
    index: 3,
    name: "Growing",
    description:
      "The farm team feeds and tends the stock. They record what they did each day or week.",
    owner: "operator",
  },
  {
    id: "harvest_weighin",
    index: 4,
    name: "Weighing the harvest",
    description:
      "The harvest is weighed on a scale and the ticket kept, so the figure can be checked.",
    owner: "operator",
  },
  {
    id: "sale_settlement",
    index: 5,
    name: "Selling the produce",
    description:
      "The produce is sold and the money received, with receipts kept against the cycle.",
    owner: "admin",
  },
  {
    id: "waterfall_distribution",
    index: 6,
    name: "Sharing the profit",
    description:
      "Bills are paid, members get their money back, a small safety slice is set aside, then profit is shared.",
    owner: "admin",
  },
];

export function stageIndex(id: string): number {
  return STAGES.find((stage) => stage.id === id)?.index ?? 1;
}

export function stageName(id: string): string {
  return STAGES.find((stage) => stage.id === id)?.name ?? "Funding Open";
}

/** A cycle is either collecting capital, running, or finished. */
export type CycleStatus = "open" | "funded" | "active" | "harvested" | "settled" | "cancelled";

/** Everyday words for a cycle's state — used on public pages and in the portals. */
export const CYCLE_STATUS_LABEL: Record<CycleStatus, string> = {
  open: "Open for funding",
  funded: "Fully funded",
  active: "Growing on the farm",
  harvested: "Harvested",
  settled: "Paid out",
  cancelled: "Cancelled",
};
