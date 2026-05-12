// Phase color palette used by Daily QC Sheet and Order Manager Tracker
// detail pages. Mirrors the printed PDF's phase header colors so the on-
// screen presentation reads like the source-of-truth document:
//
//   Phase 1 — Navy   (e.g. Order Confirmation / Sewing Quality)
//   Phase 2 — Sienna (e.g. Pre-Production / Fabric)
//   Phase 3 — Plum   (e.g. Production Monitoring / Trim)
//   Phase 4 — Forest (e.g. Finishing & Final Inspection)
//   Phase 5 — Deep Blue (e.g. Packing & Shipment)
//   Phase 6+ — Rose (extra cycle slot)

export const SECTION_PALETTE: ReadonlyArray<{ banner: string; body: string }> = [
  {
    banner: "bg-gradient-to-r from-slate-800 via-slate-700 to-slate-900",
    body: "bg-slate-50/40 dark:bg-slate-900/20",
  },
  {
    banner: "bg-gradient-to-r from-orange-700 via-amber-700 to-orange-800",
    body: "bg-amber-50/40 dark:bg-amber-950/20",
  },
  {
    banner: "bg-gradient-to-r from-violet-800 via-purple-800 to-violet-900",
    body: "bg-violet-50/40 dark:bg-violet-950/20",
  },
  {
    banner: "bg-gradient-to-r from-emerald-800 via-green-800 to-emerald-900",
    body: "bg-emerald-50/40 dark:bg-emerald-950/20",
  },
  {
    banner: "bg-gradient-to-r from-blue-800 via-indigo-800 to-blue-900",
    body: "bg-blue-50/40 dark:bg-blue-950/20",
  },
  {
    banner: "bg-gradient-to-r from-rose-700 via-pink-800 to-rose-900",
    body: "bg-rose-50/40 dark:bg-rose-950/20",
  },
];
