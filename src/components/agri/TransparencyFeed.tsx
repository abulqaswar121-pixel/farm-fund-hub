import { Activity, ShieldAlert } from "lucide-react";

import { dateLabel, relativeDays } from "@/lib/agri/format";
import { COMMODITIES } from "@/lib/agri/commodities";
import type { PublicIncident, PublicMilestone } from "@/lib/agri.public.functions";

const LOG_LABEL: Record<string, string> = {
  feed: "Feed log",
  growth_sample: "Growth sample",
  mortality: "Mortality",
  medication: "Medication",
  general: "Farm note",
  harvest: "Harvest",
  sale: "Sale",
};

/**
 * The public transparency feed.
 *
 * Only logs an admin has approved appear here, and only the operator's own
 * public summary line — so the feed can be honest without leaking cost detail.
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
      <div className="pg-card flex flex-col items-center gap-2 px-6 py-12 text-center">
        <span className="grid size-11 place-items-center rounded-full bg-porcelain text-ink-mute">
          <Activity size={18} />
        </span>
        <p className="font-display text-[0.95rem] font-semibold text-ink-deep">
          No farm activity published yet
        </p>
        <p className="max-w-sm text-[0.78rem] leading-5 text-ink-mute">
          As soon as the first cycle is stocked and the operator&apos;s first log is approved, the
          field record appears here — dated, attributed to a cycle and permanent.
        </p>
      </div>
    );
  }

  return (
    <ol className="m-0 list-none space-y-0 p-0">
      {milestones.slice(0, limit).map((milestone, index) => {
        const commodity = COMMODITIES.find((item) => item.id === milestone.commodity);
        const Icon = commodity?.icon ?? Activity;
        return (
          <li key={milestone.id} className="relative flex gap-3.5 pb-4 last:pb-0">
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
                <span className="pg-chip pg-chip--signal">
                  {LOG_LABEL[milestone.logType ?? ""] ?? "Farm log"}
                </span>
                <span className="text-[0.66rem] text-ink-mute">
                  {dateLabel(milestone.logDate)} · {relativeDays(milestone.logDate)}
                </span>
              </div>
              <p className="mt-1 text-[0.8rem] leading-6 text-ink-soft">{milestone.summary}</p>
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

/**
 * The incident and insurance register.
 *
 * Published openly, including the ones that cost money. A co-operative that
 * only shows its good news is not one worth trusting with capital.
 */
export function IncidentRegister({ incidents }: { incidents: PublicIncident[] }) {
  if (incidents.length === 0) {
    return (
      <div className="rounded-xl border border-hairline bg-white px-4 py-6 text-center">
        <p className="flex items-center justify-center gap-2 text-[0.8rem] font-semibold text-mint-deep">
          <ShieldAlert size={15} aria-hidden="true" />
          No incidents on the register
        </p>
        <p className="mx-auto mt-1.5 max-w-md text-[0.75rem] leading-5 text-ink-mute">
          Flooding, disease, feed price shocks, equipment failure and power outages are all logged
          here with a severity, a status and a resolution note. An empty register means none have
          been reported — not that none are watched for.
        </p>
      </div>
    );
  }

  return (
    <ul className="m-0 list-none space-y-2.5 p-0">
      {incidents.map((incident) => (
        <li key={incident.id} className="pg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-display text-[0.88rem] font-semibold text-ink-deep">
                {incident.title}
              </p>
              <p className="mt-0.5 text-[0.68rem] text-ink-mute">
                {incident.category} · occurred {dateLabel(incident.occurredOn)}
                {incident.cycleId ? " · linked to a running cycle" : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`pg-chip ${SEVERITY_TONE[incident.severity] ?? "pg-chip"}`}>
                {incident.severity}
              </span>
              <span
                className={`pg-chip ${incident.status === "resolved" ? "pg-chip--mint" : "pg-chip--amber"}`}
              >
                {incident.status}
              </span>
            </div>
          </div>
          <p className="mt-2 text-[0.8rem] leading-6 text-ink-soft">{incident.description}</p>
          {incident.resolutionNote ? (
            <p className="mt-2 rounded-lg border border-mint/30 bg-mint-soft px-3 py-2 text-[0.76rem] leading-5 text-mint-deep">
              <strong className="font-semibold">Resolution.</strong> {incident.resolutionNote}
              {incident.resolvedOn ? ` (${dateLabel(incident.resolvedOn)})` : ""}
            </p>
          ) : null}
          {incident.insuranceClaimRef ? (
            <p className="mt-2 font-mono text-[0.68rem] text-ink-mute">
              Insurance claim {incident.insuranceClaimRef}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
