import { Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DateFilterProps {
  value: string;
  onChange: (v: string) => void;
  /** ISO date string for `max` — usually today in factory tz. */
  today: string;
  label: string;
  /** Optional fixed width override; defaults to 150px. */
  widthClass?: string;
}

/**
 * Date input with a calendar icon, max=today, and a clear button when set.
 * Used by the QC admin pages so the filter bar reads consistently.
 */
export function DateFilter({ value, onChange, today, label, widthClass }: DateFilterProps) {
  return (
    <div className="relative inline-flex items-center gap-1.5 shrink-0">
      <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
      <Input
        type="date"
        value={value}
        max={today}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={cn(
          "h-9 pl-8 pr-2 text-xs tabular-nums",
          widthClass ?? "w-[150px]",
          value && "ring-1 ring-blue-500/30 border-blue-300/60"
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear date filter"
          className="text-muted-foreground hover:text-foreground text-xs"
        >
          ×
        </button>
      )}
    </div>
  );
}
