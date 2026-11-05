import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Lock, LockOpen, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { Card, EmptyState, Notice, SectionHeader, StatusChip } from "@/components/ndh/ledger-ui";
import { supabase } from "@/integrations/supabase/client";
import type { AdminConsole } from "@/lib/agri.ops.functions";
import { cn } from "@/lib/utils";

/**
 * Which ponds a farm worker may log against.
 *
 * The core platform answers "what can this person do" with a role. A real farm
 * with more than one pond also needs "where" — the worker on Catfish Batch A
 * should not be able to file a feed entry against the broiler house, because a
 * wrong entry is a wrong cost against the wrong harvest.
 *
 * The rule this panel writes:
 *   * **no rows** for an operator  → they may log against any cycle, which is
 *     how the platform behaved before this existed;
 *   * **one or more active rows** → they may log only against those units.
 *
 * The enforcement is a trigger on `operational_logs`, not this screen. Removing
 * an assignment here revokes the permission at the database, not in the UI.
 */
type Assignment = {
  id: string;
  operator_id: string;
  cycle_id: string;
  revoked_at: string | null;
};

export function OperatorUnitsPanel({
  console_,
  onDone,
}: {
  console_: AdminConsole;
  onDone: (tone: "success" | "error" | "info", text: string) => void;
}) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState("");

  const operators = console_.members.filter(
    (member) => member.role === "operator" || member.role === "admin",
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from("operator_assignments")
        .select("id, operator_id, cycle_id, revoked_at");
      if (!cancelled) {
        setAssignments(data ?? []);
        setSelected((current) => current || operators[0]?.userId || "");
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle(operatorId: string, cycleId: string, active: boolean) {
    setBusy(`${operatorId}:${cycleId}`);
    try {
      if (active) {
        // Revoke rather than delete: the record of who had access to which pond,
        // and when it was taken away, is itself part of an audit trail.
        const { error } = await supabase
          .from("operator_assignments")
          .update({ revoked_at: new Date().toISOString() })
          .eq("operator_id", operatorId)
          .eq("cycle_id", cycleId)
          .is("revoked_at", null);
        if (error) throw error;
      } else {
        const { data: session } = await supabase.auth.getUser();
        const { error } = await supabase.from("operator_assignments").upsert(
          {
            operator_id: operatorId,
            cycle_id: cycleId,
            granted_by: session.user?.id ?? null,
            revoked_at: null,
          },
          { onConflict: "operator_id,cycle_id" },
        );
        if (error) throw error;
      }
      const { data } = await supabase
        .from("operator_assignments")
        .select("id, operator_id, cycle_id, revoked_at");
      setAssignments(data ?? []);
      onDone(
        "success",
        active
          ? "Unit access revoked. The database now refuses a log against it."
          : "Unit access granted for this operator.",
      );
    } catch {
      onDone("error", "That access change could not be saved");
    }
    setBusy(null);
  }

  const activeFor = (operatorId: string) =>
    assignments.filter((row) => row.operator_id === operatorId && row.revoked_at === null);

  if (loading) {
    return (
      <Card className="flex items-center justify-center gap-2 py-14 text-ink-mute">
        <Loader2 size={15} className="animate-spin" aria-hidden="true" />
        <span className="fig text-[0.8rem]">Reading the access register…</span>
      </Card>
    );
  }

  const currentOperator = operators.find((member) => member.userId === selected);

  return (
    <div className="space-y-5">
      <SectionHeader
        kicker="Farm unit access"
        title="Which pond a worker may log against"
        blurb="An operator with no units assigned may log against any cycle. Assign one or more units and the database refuses every log outside them — even a forged request."
      />

      <Notice tone="info">
        Revoking keeps the row with the date it was withdrawn, because who had access to which pond
        is part of the audit trail. It is never deleted.
      </Notice>

      {operators.length === 0 ? (
        <Card>
          <EmptyState icon={<ShieldCheck size={18} />} title="No farm staff yet">
            Promote a member to Farm Operator on the Members &amp; roles tab, then come back to say
            which units they work on.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid min-w-0 gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <Card className="min-w-0 overflow-hidden">
            <p className="pg-kicker border-b border-hairline px-4 py-3">Farm staff</p>
            <ul className="m-0 list-none divide-y divide-hairline p-0">
              {operators.map((member) => {
                const granted = activeFor(member.userId);
                return (
                  <li key={member.userId}>
                    <button
                      type="button"
                      onClick={() => setSelected(member.userId)}
                      aria-pressed={selected === member.userId}
                      className={cn(
                        "flex w-full items-start justify-between gap-2 px-4 py-3 text-left transition-colors",
                        selected === member.userId ? "bg-porcelain" : "hover:bg-porcelain/60",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[0.8rem] font-semibold text-ink-deep">
                          {member.fullName}
                        </span>
                        <span className="mt-0.5 block text-[0.66rem] text-ink-mute">
                          {member.role === "admin" ? "Admin" : "Farm operator"}
                        </span>
                      </span>
                      {granted.length === 0 ? (
                        <span className="pg-chip shrink-0">All units</span>
                      ) : (
                        <span className="pg-chip pg-chip--signal shrink-0">
                          {granted.length} unit{granted.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="min-w-0 overflow-hidden">
            <div className="border-b border-hairline px-4 py-3">
              <p className="pg-kicker">Units for {currentOperator?.fullName ?? "this operator"}</p>
              <p className="mt-1 text-[0.7rem] leading-5 text-ink-mute">
                Tick a unit to grant it. Untick to revoke. An admin always keeps full access.
              </p>
            </div>

            {console_.cycles.length === 0 ? (
              <EmptyState icon={<Lock size={18} />} title="No cycles to assign">
                Publish a cycle first.
              </EmptyState>
            ) : (
              <ul className="m-0 list-none divide-y divide-hairline p-0">
                {console_.cycles.map((cycle) => {
                  const granted =
                    selected !== "" &&
                    assignments.some(
                      (row) =>
                        row.operator_id === selected &&
                        row.cycle_id === cycle.id &&
                        row.revoked_at === null,
                    );
                  const key = `${selected}:${cycle.id}`;
                  return (
                    <li
                      key={cycle.id}
                      className="flex items-center justify-between gap-3 px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[0.78rem] font-semibold text-ink-deep">
                          {cycle.code} · {cycle.name}
                        </p>
                        <p className="mt-0.5 text-[0.66rem] text-ink-mute">
                          {cycle.status} · {cycle.currentStage.replace(/_/g, " ")}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!selected || busy === key}
                        aria-pressed={granted}
                        onClick={() => void toggle(selected, cycle.id, granted)}
                        className={cn(
                          "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[0.7rem] font-semibold transition-colors",
                          granted
                            ? "border-mint/40 bg-mint-soft text-mint-deep"
                            : "border-hairline bg-white text-ink-soft hover:border-hairline-strong",
                        )}
                      >
                        {busy === key ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : granted ? (
                          <Check size={12} aria-hidden="true" />
                        ) : (
                          <LockOpen size={12} aria-hidden="true" />
                        )}
                        {granted ? "Granted" : "Grant"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {currentOperator ? (
              <div className="border-t border-hairline px-4 py-3">
                <StatusChip
                  status={activeFor(currentOperator.userId).length === 0 ? "info" : "success"}
                  label={
                    activeFor(currentOperator.userId).length === 0
                      ? "Broad farm access — every published cycle"
                      : `Restricted to ${activeFor(currentOperator.userId).length} unit(s)`
                  }
                />
              </div>
            ) : null}
          </Card>
        </div>
      )}
    </div>
  );
}
