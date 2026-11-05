/**
 * The one-click farm update.
 *
 * A farm worker finishing a quick log should be able to send the same update to
 * the WhatsApp group in one tap, in the shape the co-operative already uses:
 *
 *     🚜 NDH FarmFund Farm Update
 *     📍 Cycle: Catfish Batch A - Week 6
 *     🐟 Avg Weight: 420g | Mortality: 0
 *     📸 View photo proof on your member dashboard: agricapital.ndh.com.ng
 *
 * Two rules make this trustworthy rather than decorative:
 *
 *   1. Every figure is passed in from a row that has just been written to the
 *      ledger. Nothing here computes a number, so the message cannot disagree
 *      with the book it was filed against.
 *   2. Nothing private enters the text. No naira amount, no cost, no supplier,
 *      no member holding — a WhatsApp group is the least private place a
 *      message can end up, and it is the most likely to be forwarded.
 */
import { number } from "./format";

export const PUBLIC_SITE = "agricapital.ndh.com.ng";
export const MEMBER_DASHBOARD_URL = `https://${PUBLIC_SITE}`;

/** The emoji the co-operative uses for each kind of stock. */
const COMMODITY_EMOJI: Record<string, string> = {
  catfish: "🐟",
  tilapia: "🐠",
  broiler: "🐔",
  layer: "🥚",
  grain: "🌾",
  greenhouse: "🌱",
};

const COMMODITY_WORD: Record<string, string> = {
  catfish: "Catfish",
  tilapia: "Tilapia",
  broiler: "Broiler",
  layer: "Layer flock",
  grain: "Grain field",
  greenhouse: "Greenhouse bed",
};

export type FarmUpdateInput = {
  cycleCode: string;
  cycleName: string;
  commodity: string;
  /** Whole weeks since stocking, when the cycle has a stocking date. */
  weekNumber?: number | null;
  logType: string;
  /** Field readings; only the ones that were actually recorded are printed. */
  avgWeightG?: number | null;
  mortalityCount?: number | null;
  feedKg?: number | null;
  cratesCollected?: number | null;
  bagsHarvested?: number | null;
  populationCount?: number | null;
  /** The operator's own public summary line, if they wrote one. */
  publicSummary?: string | null;
  /** Present when a photo or a clip was attached to the log. */
  hasPhoto?: boolean;
  hasVideo?: boolean;
  /** The free-text note from a non-standard log (medication, incident, weather). */
  detail?: string | null;
};

function label(logType: string): string {
  return logType.replace(/_/g, " ");
}

/**
 * Build the message. Kept as a pure function so the operator portal, the admin
 * auditor and the tests all produce byte-identical text.
 */
export function buildFarmUpdate(input: FarmUpdateInput): string {
  const emoji = COMMODITY_EMOJI[input.commodity] ?? "🌱";
  const lines: string[] = ["🚜 *NDH FarmFund Farm Update*"];

  const cycle =
    `${input.cycleName || COMMODITY_WORD[input.commodity] || "Farm cycle"}` +
    (input.weekNumber && input.weekNumber > 0 ? ` - Week ${input.weekNumber}` : "");
  lines.push(`📍 Cycle: ${cycle} (${input.cycleCode})`);

  // The headline reading for this log type, in the co-operative's own voice.
  switch (input.logType) {
    case "feed": {
      const parts: string[] = [];
      if (input.feedKg != null) parts.push(`Feed given: ${number(input.feedKg, 1)}kg`);
      if (input.avgWeightG != null) parts.push(`Avg Weight: ${number(input.avgWeightG, 0)}g`);
      if (input.mortalityCount != null) parts.push(`Mortality: ${number(input.mortalityCount, 0)}`);
      lines.push(`${emoji} ${parts.length ? parts.join(" | ") : "Feed given as scheduled"}`);
      break;
    }
    case "growth_sample": {
      const parts: string[] = [];
      if (input.avgWeightG != null) parts.push(`Avg Weight: ${number(input.avgWeightG, 0)}g`);
      if (input.mortalityCount != null) parts.push(`Mortality: ${number(input.mortalityCount, 0)}`);
      if (input.populationCount != null)
        parts.push(`Head count: ${number(input.populationCount, 0)}`);
      lines.push(`${emoji} ${parts.length ? parts.join(" | ") : "Growth sample taken"}`);
      break;
    }
    case "mortality": {
      lines.push(
        `${emoji} Mortality: ${number(input.mortalityCount ?? 0, 0)}` +
          (input.populationCount != null
            ? ` | Head count: ${number(input.populationCount, 0)}`
            : ""),
      );
      break;
    }
    case "general": {
      const parts: string[] = [];
      if (input.cratesCollected != null) parts.push(`Crates: ${number(input.cratesCollected, 0)}`);
      if (input.bagsHarvested != null) parts.push(`Bags: ${number(input.bagsHarvested, 0)}`);
      if (input.mortalityCount != null) parts.push(`Mortality: ${number(input.mortalityCount, 0)}`);
      lines.push(`${emoji} ${parts.length ? parts.join(" | ") : "Daily round complete"}`);
      break;
    }
    case "harvest": {
      const parts: string[] = [];
      if (input.feedKg != null) parts.push(`Weight: ${number(input.feedKg, 1)}kg`);
      if (input.populationCount != null)
        parts.push(`Head count: ${number(input.populationCount, 0)}`);
      lines.push(`⚖️ ${parts.length ? parts.join(" | ") : "Harvest weighed in"}`);
      break;
    }
    default:
      lines.push(`${emoji} ${label(input.logType)} logged`);
  }

  const detail = input.detail?.trim() || input.publicSummary?.trim();
  if (detail) lines.push(`📝 ${detail}`);

  if (input.hasVideo) lines.push("🎥 Video proof posted on the member dashboard");
  else if (input.hasPhoto) lines.push("📸 Photo proof posted on the member dashboard");

  lines.push(`📸 View photo proof on your member dashboard: ${PUBLIC_SITE}`);
  return lines.join("\n");
}

/** `https://wa.me/?text=` — opens WhatsApp with the update already written. */
export function whatsappShareUrl(text: string, phone?: string | null): string {
  const digits = (phone ?? "").replace(/[^0-9]/g, "");
  const target = digits.length >= 10 ? `https://wa.me/${digits}` : "https://wa.me/";
  return `${target}?text=${encodeURIComponent(text)}`;
}

/** A group invite link, when the co-operative has one configured. */
export function whatsappGroupUrl(inviteUrl?: string | null): string {
  return inviteUrl && inviteUrl.startsWith("https://chat.whatsapp.com/")
    ? inviteUrl
    : "https://wa.me/2349029932794?text=" +
        encodeURIComponent("Please add me to the NDH FarmFund investors group.");
}
