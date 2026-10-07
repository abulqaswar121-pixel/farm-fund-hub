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
  /** Telemetry the operator is asked for on the daily quick-log. */
  telemetry: string[];
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
      "Fingerlings raised through juvenile and grow-out stages to table size, tracked by biomass and feed conversion ratio.",
    growthUnit: "g / fish",
    feedUnit: "kg of feed",
    typicalDurationWeeks: 20,
    targetYieldLabel: "Table size · 1.0 – 1.2 kg average",
    revenueBasis: "Wholesale table-size fish sold by weight at harvest weigh-in",
    accent: "cyan",
    telemetry: [
      "Biomass (kg) in each pond",
      "Average sampled weight (g) per fish",
      "Feed conversion ratio",
      "Mortality count and cause",
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
      "Nile tilapia grown in lined tanks and cages to plate size, tracked by dissolved oxygen, biomass sampling and feed conversion ratio.",
    growthUnit: "g / fish",
    feedUnit: "kg of feed",
    typicalDurationWeeks: 24,
    targetYieldLabel: "Plate size · 500 – 700 g average",
    revenueBasis: "Fresh whole-fish sales to hotels, cold rooms and open markets",
    accent: "cyan",
    telemetry: [
      "Biomass (kg) in each tank or cage",
      "Average sampled weight (g) per fish",
      "Dissolved oxygen and water temperature",
      "Feed conversion ratio and mortality",
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
      "Day-old chicks reared on a six to eight week grow-out to dressed meat weight for the festive and hotel trade.",
    growthUnit: "kg live weight",
    feedUnit: "bags of feed",
    typicalDurationWeeks: 7,
    targetYieldLabel: "Dressed weight · 1.8 – 2.2 kg per bird",
    revenueBasis: "Live-weight and dressed-bird sales to processors and hotels",
    accent: "amber",
    telemetry: [
      "Average live weight (kg) per bird",
      "Feed intake in bags",
      "Mortality count and cause",
      "Vaccination and medication administered",
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
      "Point-of-lay birds producing daily crate output across a twelve to eighteen month laying window.",
    growthUnit: "crates / day",
    feedUnit: "bags of feed",
    typicalDurationWeeks: 60,
    targetYieldLabel: "Lay rate · 80 – 92% of flock in production",
    revenueBasis: "Daily crate sales to distributors, plus spent-layer salvage at close",
    accent: "violet",
    telemetry: [
      "Crates collected per day",
      "Lay rate percentage of flock",
      "Feed intake in bags",
      "Mortality count and cause",
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
      "Maize, soya and rice planted, weeded and fertilised across a full season, measured in bags harvested.",
    growthUnit: "bags / hectare",
    feedUnit: "kg of fertiliser",
    typicalDurationWeeks: 18,
    targetYieldLabel: "Yield · 45 – 70 bags per hectare",
    revenueBasis: "Bag sales to aggregators and off-takers at documented market prices",
    accent: "emerald",
    telemetry: [
      "Hectares planted and standing",
      "Agrochemical application log",
      "Bags harvested per hectare",
      "Rainfall and soil moisture observations",
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
      "Protected tomatoes and bell peppers grown under drip irrigation for premium urban markets.",
    growthUnit: "kg / m²",
    feedUnit: "kg of nutrient blend",
    typicalDurationWeeks: 24,
    targetYieldLabel: "Yield · 18 – 26 kg per m² per season",
    revenueBasis: "Grade-A produce sales to supermarkets and restaurants",
    accent: "rose",
    telemetry: [
      "Harvest kilograms per square metre",
      "Trellising and pruning actions",
      "Nutrient blend applied",
      "Pest pressure and control measures",
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
    name: "Funding Open",
    description:
      "Members and the public browse the stock card and contribute via Paystack or verified bank transfer.",
    owner: "market",
  },
  {
    id: "stocking",
    index: 2,
    name: "Stocking",
    description:
      "Funding closes and the stock — fingerlings, chicks or seed — is purchased and placed into ponds, pens or fields.",
    owner: "operator",
  },
  {
    id: "operational",
    index: 3,
    name: "Operational & Growth Logs",
    description:
      "Daily and weekly entries record feed, growth samples, mortality and medication against the cycle.",
    owner: "operator",
  },
  {
    id: "harvest_weighin",
    index: 4,
    name: "Harvest Weigh-in",
    description:
      "Total harvest weight is recorded openly with batch scale tickets and buyer pickup notes.",
    owner: "operator",
  },
  {
    id: "sale_settlement",
    index: 5,
    name: "Sale & Settlement",
    description:
      "Market revenue is received and logged against the cycle with the receipts attached.",
    owner: "admin",
  },
  {
    id: "waterfall_distribution",
    index: 6,
    name: "Waterfall Distribution",
    description:
      "The locked settlement runs: liabilities, then principal, then reserve, then the 70/30 profit split.",
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

export const CYCLE_STATUS_LABEL: Record<CycleStatus, string> = {
  open: "Funding open",
  funded: "Fully funded",
  active: "Active on farm",
  harvested: "Harvested",
  settled: "Settled",
  cancelled: "Cancelled",
};
