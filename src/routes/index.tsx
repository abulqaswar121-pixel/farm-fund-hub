import { createFileRoute, Link } from "@tanstack/react-router";

import { AiConcierge } from "@/components/ndh/AiConcierge";
import { FamilyFooter } from "@/components/ndh/FamilyFooter";
import { PrecisionHeader } from "@/components/ndh/PrecisionHeader";
import { CatfishSpotlight } from "@/components/agri/CatfishSpotlight";
import { CommunityAndFaq } from "@/components/agri/CommunityAndFaq";
import { FarmFundHero } from "@/components/agri/FarmFundHero";
import { HowFarmFundWorks } from "@/components/agri/HowFarmFundWorks";
import { listPublicCycles } from "@/lib/agri.public.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NDH FarmFund — Real farm investments with open books" },
      {
        name: "description",
        content:
          "Join the NDH FarmFund communal catfish cycle from ₦5,000. Transparent weekly pond logs, direct WhatsApp updates, and your capital plus a 70% share of harvest profit returned at the end of the cycle.",
      },
      { property: "og:title", content: "NDH FarmFund — Real farm investments with open books" },
      {
        property: "og:description",
        content:
          "A communal catfish cycle run by the Najeeb Digital Hub co-operative: open pond logs, a 70/30 split agreed upfront, and capital returned before profit.",
      },
    ],
  }),
  loader: async () => {
    const marketplace = await listPublicCycles();
    return {
      cycles: marketplace.cycles,
      ledgerReachable: marketplace.ledgerReachable,
    };
  },
  component: PublicHome,
});

/**
 * The homepage, in four sections and no more.
 *
 * The version this replaces had eleven: a ledger-counted pulse, a ticker, an
 * open-opportunities grid, a return calculator, how-it-works, a stage rail, a
 * commodity catalogue, a photo strip, a WhatsApp band, a locked-rules essay, a
 * transparency register with incidents and weather, a six-card "parts you meet
 * later" grid, and a closing call to action. Every one of those was defensible
 * on its own and the sum of them was a visitor scrolling for a minute before
 * learning what the thing is for.
 *
 * So:
 *
 *   1. Hero — what this is, and four facts about the venture that is running.
 *   2. The cycle in the water — one spotlight, with real pond readings.
 *   3. How it works — three cards.
 *   4. The WhatsApp group and four questions, then leave.
 *
 * Everything removed from here still exists, at a URL that says what it is:
 * `/rules` for the payout waterfall, reserve band and locked terms; `/cycles`
 * for every batch ever published; `/portal` for a member's own book. A homepage
 * that tries to be all three is a homepage nobody finishes.
 */
function PublicHome() {
  const { cycles } = Route.useLoaderData();

  // Prefer the cycle that is actually stocked; then anything open for funding;
  // then the newest thing published. `cycles` is already newest-first.
  const featured =
    cycles.find((card) => card.status === "active") ??
    cycles.find((card) => card.status === "open" || card.status === "funded") ??
    cycles[0] ??
    null;

  return (
    <div className="min-h-screen bg-porcelain" id="top">
      <PrecisionHeader activePath="/" />

      <FarmFundHero cycleCode={featured?.code ?? null} />

      <CatfishSpotlight card={featured} />

      <HowFarmFundWorks />

      <CommunityAndFaq />

      {/* A single quiet line before the footer — the two deep pages, named. */}
      <div className="border-t border-hairline bg-white">
        <div className="mx-auto flex max-w-[var(--page)] flex-wrap items-center justify-between gap-3 px-[var(--gutter)] py-5">
          <p className="text-[0.72rem] text-ink-mute">
            NDH FarmFund is a co-operative agricultural programme of Najeeb Digital Hub. It is not a
            bank, and no return is guaranteed.
          </p>
          <nav aria-label="More detail" className="flex flex-wrap items-center gap-4">
            <Link
              to="/rules"
              className="text-[0.74rem] font-semibold text-signal-deep no-underline hover:text-ink-deep"
            >
              Payout rules
            </Link>
            <Link
              to="/cycles"
              className="text-[0.74rem] font-semibold text-signal-deep no-underline hover:text-ink-deep"
            >
              All batches
            </Link>
            <Link
              to="/verify"
              className="text-[0.74rem] font-semibold text-signal-deep no-underline hover:text-ink-deep"
            >
              Verify a document
            </Link>
          </nav>
        </div>
      </div>

      <FamilyFooter />
      <AiConcierge />
    </div>
  );
}
