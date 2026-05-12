import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One cell of the PO details grid at the top of a QC detail page.
 * Designed to be used inside a 4-column grid with cell dividers — the
 * `nth-child` rules wipe the inner left/top borders on the first cell
 * of each row.
 */
export function DetailCell({
  icon: Icon,
  label,
  value,
  mono,
  capitalize,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  mono?: boolean;
  capitalize?: boolean;
}) {
  return (
    <div
      className={cn(
        "px-4 py-3 first:border-l-0",
        // Mobile (2-col): clear left border on every odd cell, top border on first row (cells 1-2)
        "[&:nth-child(2n+1)]:border-l-0 [&:nth-child(-n+2)]:border-t-0",
        // Desktop (4-col): restore left/top, then clear at the right cells for 4-col grid
        "md:[&:nth-child(2n+1)]:border-l md:[&:nth-child(4n+1)]:border-l-0",
        "md:[&:nth-child(-n+2)]:border-t md:[&:nth-child(-n+4)]:border-t-0"
      )}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="h-3 w-3 text-muted-foreground/70 shrink-0" />
        <p className="text-[10px] uppercase tracking-[0.1em] font-semibold text-muted-foreground truncate">
          {label}
        </p>
      </div>
      <p
        className={cn(
          "text-sm font-semibold truncate",
          mono && "font-mono",
          capitalize && "capitalize",
          value === "—" && "text-muted-foreground/60 font-normal"
        )}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}
