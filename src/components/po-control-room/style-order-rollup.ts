// Pure rollup: groups POControlRoomData rows by their parent style_order_id
// and computes aggregates (qty, sewing, finishing, remaining, progress,
// earliest ex-factory, line union, worst-case health/workflow state).

import type {
  HealthReason,
  HealthStatus,
  POControlRoomData,
  POWorkflowState,
  StyleOrderParent,
  StyleOrderRollup,
} from "./types";

// Worst-case health: deadline_passed > at_risk > watch > healthy/no_deadline > completed.
// "completed" is only assigned if every child is completed.
const HEALTH_RANK: Record<HealthStatus, number> = {
  deadline_passed: 5,
  at_risk: 4,
  watch: 3,
  no_deadline: 2,
  healthy: 1,
  completed: 0,
};

function rollupHealth(pos: POControlRoomData[]): HealthReason {
  if (pos.length === 0) return { status: "healthy", reasons: [] };
  const allCompleted = pos.every((p) => p.health.status === "completed");
  if (allCompleted) return { status: "completed", reasons: ["All POs fulfilled"] };
  let worst = pos[0].health;
  for (const p of pos) {
    if (HEALTH_RANK[p.health.status] > HEALTH_RANK[worst.status]) {
      worst = p.health;
    }
  }
  return worst;
}

function rollupWorkflowState(pos: POControlRoomData[]): POWorkflowState {
  if (pos.length === 0) return "not_started";
  const allCompleted = pos.every((p) => p.workflowState === "completed");
  if (allCompleted) return "completed";
  if (pos.some((p) => p.workflowState === "running")) return "running";
  if (pos.some((p) => p.workflowState === "planned")) return "planned";
  return "not_started";
}

export function buildStyleOrderRollups(
  workOrders: POControlRoomData[],
  parents: StyleOrderParent[]
): StyleOrderRollup[] {
  const parentById = new Map(parents.map((p) => [p.id, p]));
  const groups = new Map<string, POControlRoomData[]>();

  for (const po of workOrders) {
    const arr = groups.get(po.style_order_id) || [];
    arr.push(po);
    groups.set(po.style_order_id, arr);
  }

  const rollups: StyleOrderRollup[] = [];
  for (const [styleOrderId, pos] of groups) {
    const parent = parentById.get(styleOrderId);
    if (!parent) continue; // orphan — shouldn't happen given Phase 1 invariants

    const totalQty = pos.reduce((s, p) => s + p.order_qty, 0);
    const sewingOutput = pos.reduce((s, p) => s + p.sewingOutput, 0);
    const finishedOutput = pos.reduce((s, p) => s + p.finishedOutput, 0);
    const remaining = pos.reduce((s, p) => s + p.remaining, 0);
    const progressPct =
      totalQty > 0 ? Math.min((finishedOutput / totalQty) * 100, 100) : 0;

    const earliestExFactory = pos
      .map((p) => p.planned_ex_factory)
      .filter((d): d is string => !!d)
      .sort()[0] ?? null;

    const lineSet = new Set<string>();
    for (const p of pos) for (const ln of p.line_names) lineSet.add(ln);

    rollups.push({
      id: parent.id,
      factory_id: parent.factory_id,
      buyer: parent.buyer,
      style_name: parent.style_name,
      style_number: parent.style_number,
      needs_review: parent.needs_review,

      poCount: pos.length,
      totalQty,
      sewingOutput,
      finishedOutput,
      remaining,
      progressPct,
      earliestExFactory,
      lineNames: Array.from(lineSet),

      workflowState: rollupWorkflowState(pos),
      health: rollupHealth(pos),

      pos: [...pos].sort((a, b) => a.po_number.localeCompare(b.po_number)),
    });
  }

  // Sort: at_risk first, then by earliest ex-factory, then alphabetical
  rollups.sort((a, b) => {
    const ra = HEALTH_RANK[a.health.status];
    const rb = HEALTH_RANK[b.health.status];
    if (ra !== rb) return rb - ra;
    if (a.earliestExFactory && b.earliestExFactory) {
      const c = a.earliestExFactory.localeCompare(b.earliestExFactory);
      if (c !== 0) return c;
    } else if (a.earliestExFactory) return -1;
    else if (b.earliestExFactory) return 1;
    return `${a.buyer} ${a.style_name}`.localeCompare(`${b.buyer} ${b.style_name}`);
  });

  return rollups;
}
