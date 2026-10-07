import { STAGES, stageIndex } from "@/lib/agri/commodities";

/**
 * The six-stage lifecycle rail.
 *
 * Stages before the cycle's current stage render as done, the current one is
 * highlighted, and everything ahead stays quiet. On a phone it scrolls
 * sideways rather than compressing six labels into an unreadable smear.
 */
export function StageRail({ currentStage }: { currentStage: string }) {
  const active = stageIndex(currentStage);

  return (
    <div className="pg-stage-rail" role="list" aria-label="Cycle lifecycle">
      {STAGES.map((stage) => {
        const state = stage.index < active ? "done" : stage.index === active ? "active" : "ahead";
        return (
          <div key={stage.id} className="pg-stage" data-state={state} role="listitem">
            <span>
              Stage {stage.index} / {state === "active" ? "now" : state === "done" ? "done" : "next"}
            </span>
            <strong>{stage.name}</strong>
          </div>
        );
      })}
    </div>
  );
}
