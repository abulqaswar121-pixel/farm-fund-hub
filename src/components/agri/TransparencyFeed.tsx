import { Activity, ShieldAlert } from "lucide-react";

import { dateLabel, relativeDays } from "@/lib/agri/format";
import { COMMODITIES } from "@/lib/agri/commodities";
import { plainLog } from "@/lib/agri/plain";
import type { PublicIncident, PublicMilestone } from "@/lib/agri.public.functions";

/**
 * The public register of farm entries.
 *
 * Only logs an admin has approved appear here, and only the operator's own
 * public line — so the register can be honest without publishing costs,
 * supplier names or anybody's position. The words are the farm's everyday ones:
 * "Fed on schedule" rather than "feed log", with the ledger's own label kept in
 * small type beside it for anyone who wants the term.
 */
export function TransparencyFeed({
  milestones,
  limit = 8,
}: {
  milestones: PublicMilestone[];
  limit?: number;
}) {
  if (milestones.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <span className="grid size-11 place-items-center rounded-full bg-porcelain text-ink-mute">
          <Activity size={18} />
        </span>
        <p className="font-display text-[0.95rem] font-semibold text-ink-deep">
          Nothing has been recorded yet
        </p>
        <p className="max-w-sm text-[0.78rem] leading-5 text-ink-mute">
          The moment the first stock is placed and the farm team&apos;s first entry has been checked
          by a second person, it appears here — dated, tied to its cycle and kept.
        </p>
      </div>
    );
  }

  return (
    <ol className="m-0 list-none space-y-0 p-0">
      {milestones.slice(0, limit).map((milestone, index) => {
        const commodity = COMMODITIES.find((item) => item.id === milestone.commodity);
        const Icon = commodity?.icon ?? Activity;
        const log = plainLog(milestone.logType);
        return (
          <li key={milestone.id} className="relative flex min-w-0 gap-3.5 pb-4 last:pb-0">
            {index < Math.min(limit, milestones.length) - 1 ? (
              <span
                className="absolute left-[0.68rem] top-7 h-[calc(100%-1rem)] w-px bg-hairline"
                aria-hidden="true"
              />
            ) : null}
            <span className="relative z-10 mt-0.5 grid size-[1.4rem] shrink-0 place-items-center rounded-full border border-hairline bg-white text-signal-deep">
              <Icon size={12} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-mono text-[0.66rem] font-semibold uppercase tracking-wider text-ink-soft">
                  {milestone.cycleCode}
                </span>
                <span className="pg-chip pg-chip--signal">{log.headline}</span>
                <span className="font-mono text-[0.6rem] uppercase tracking-wider text-ink-mute">
                  {log.label}
                </span>
                <span className="text-[0.66rem] text-ink-mute">
                  {dateLabel(milestone.logDate)} · {relativeDays(milestone.logDate)}
                </span>
              </div>
              {milestone.summary ? (
                <p className="mt-1 text-[0.8rem] leading-6 text-ink-soft">{milestone.summary}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const SEVERITY_TONE: Record<string, string> = {
  low: "pg-chip",
  moderate: "pg-chip--amber",
  serious: "pg-chip--rose",
  critical: "pg-chip--rose",
};

/** How serious, said in words rather than in ledger codes. */
const SEVERITY_WORD: Record<string, string> = {
  low: "Minor",
  moderate: "Moderate",
  serious: "Serious",
  critical: "Critical",
};

const STATUS_WORD: Record<string, string> = {
  open: "Still being handled",
  monitoring: "Being watched",
  resolved: "Sorted out",
  closed: "Closed",
};

/**
 * The incident and insurance register.
 *
 * Published openly, including the ones that cost money. A co-operative that
 * only shows its good news is not one worth trusting with capital.
 */
export function IncidentRegister({ incidents }: { incidents: PublicIncident[] }) {
  if (incidents.length === 0) {
    return (
      <div className="rounded-xl border border-hairline bg-porcelain px-4 py-6 text-center">
        <p className="flex items-center justify-center gap-2 text-[0.8rem] font-semibold text-mint-deep">
          <ShieldAlert size={15} aria-hidden="true" />
          Nothing on the register
        </p>
        <p className="mx-auto mt-1.5 max-w-md text-[0.75rem] leading-5 text-ink-mute">
          Flooding, disease, feed price shocks, breakdowns and power cuts are all recorded here,
          with how serious each one is and what was done about it. An empty register means none have
          been reported — not that nobody is watching for them.
        </p>
      </div>
    );
  }

  return (
    <ul className="m-0 list-none space-y-2.5 p-0">
      {incidents.map((incident) => (
        <li
          key={incident.id}
          className="min-w-0 rounded-xl border border-hairline bg-porcelain p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-display text-[0.88rem] font-semibold leading-snug text-ink-deep">
                {incident.title}
              </p>
              <p className="mt-0.5 text-[0.68rem] text-ink-mute">
                {incident.category} · started {dateLabel(incident.occurredOn)}
                {incident.cycleId ? " · tied to a running cycle" : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`pg-chip ${SEVERITY_TONE[incident.severity] ?? "pg-chip"}`}>
                {SEVERITY_WORD[incident.severity] ?? incident.severity}
              </span>
              <span
                className={`pg-chip ${
                  incident.status === "resolved" || incident.status === "closed"
                    ? "pg-chip--mint"
                    : "pg-chip--amber"
                }`}
              >
                {STATUS_WORD[incident.status] ?? incident.status}
              </span>
            </div>
          </div>
          <p className="mt-2 text-[0.8rem] leading-6 text-ink-soft">{incident.description}</p>
          {incident.resolutionNote ? (
            <p className="mt-2 rounded-lg border border-mint/30 bg-mint-soft px-3 py-2 text-[0.76rem] leading-5 text-mint-deep">
              <strong className="font-semibold">What was done.</strong> {incident.resolutionNote}
              {incident.resolvedOn ? ` (${dateLabel(incident.resolvedOn)})` : ""}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
