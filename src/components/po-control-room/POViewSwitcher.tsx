import { Layers, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

export type POViewMode = "style" | "po";

interface Props {
  value: POViewMode;
  onChange: (mode: POViewMode) => void;
  styleOrdersCount?: number;
  poCount?: number;
}

export function POViewSwitcher({ value, onChange, styleOrdersCount, poCount }: Props) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border/60 bg-muted/40 p-0.5 text-sm">
      <button
        type="button"
        onClick={() => onChange("style")}
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-1.5 font-medium transition-colors",
          value === "style"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Layers className="h-4 w-4" />
        <span>Orders</span>
        {typeof styleOrdersCount === "number" && (
          <span className={cn(
            "rounded px-1.5 text-[11px] font-mono",
            value === "style" ? "bg-muted text-foreground" : "text-muted-foreground"
          )}>
            {styleOrdersCount}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => onChange("po")}
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-1.5 font-medium transition-colors",
          value === "po"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Receipt className="h-4 w-4" />
        <span>PO Details</span>
        {typeof poCount === "number" && (
          <span className={cn(
            "rounded px-1.5 text-[11px] font-mono",
            value === "po" ? "bg-muted text-foreground" : "text-muted-foreground"
          )}>
            {poCount}
          </span>
        )}
      </button>
    </div>
  );
}
