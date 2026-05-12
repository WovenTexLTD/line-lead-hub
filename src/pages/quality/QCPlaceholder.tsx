import { ShieldCheck } from "lucide-react";

interface Props {
  title: string;
  description: string;
  hint?: string;
}

/**
 * Phase 2 placeholder for QC pages. Phases 4-6 replace each route with
 * its real implementation; this keeps the nav, routing, and role guards
 * working until then.
 */
export function QCPlaceholder({ title, description, hint }: Props) {
  return (
    <div className="py-3 md:py-4 lg:py-6 space-y-5 md:space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
          <ShieldCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium mb-1">Coming soon</p>
        <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
          {hint ??
            "This Quality Control page is part of the new QC module. The data layer is live; the UI lands in the next phase."}
        </p>
      </div>
    </div>
  );
}
