import { useState, useRef, useEffect, useMemo } from "react";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { normalizeName, cleanDisplayName } from "@/lib/normalize-name";

interface Props {
  value: string;
  onChange: (next: string) => void;
  /** Sorted list of existing values (display casing). Caller dedupes upstream. */
  options: string[];
  placeholder?: string;
  /** Used for the "+ Add 'X' as new {entityLabel}" affordance. */
  entityLabel?: string;
  /** When provided, options whose normalized form is in this set are
   *  visually marked as "for the currently selected context"
   *  (e.g. styles previously used for the chosen buyer). */
  prioritizedNormalized?: Set<string>;
  prioritizedHeader?: string;
  hasError?: boolean;
  disabled?: boolean;
  className?: string;
}

export function AutocompleteCombobox({
  value,
  onChange,
  options,
  placeholder,
  entityLabel = "value",
  prioritizedNormalized,
  prioritizedHeader,
  hasError,
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  // Keep query in sync when value changes externally (eg. dialog opens with edit data)
  useEffect(() => {
    if (!open) setQuery(value);
  }, [value, open]);

  const normalizedQuery = normalizeName(query);
  const cleanedQuery = cleanDisplayName(query);

  const { prioritized, others, exactMatch } = useMemo(() => {
    const prioritizedList: string[] = [];
    const otherList: string[] = [];
    let exact: string | null = null;

    for (const opt of options) {
      const optNorm = normalizeName(opt);
      if (optNorm === normalizedQuery && normalizedQuery.length > 0) {
        exact = opt;
      }
      // Filter by substring match on normalized form when user is typing
      if (normalizedQuery.length > 0 && !optNorm.includes(normalizedQuery)) continue;

      if (prioritizedNormalized?.has(optNorm)) {
        prioritizedList.push(opt);
      } else {
        otherList.push(opt);
      }
    }
    return { prioritized: prioritizedList, others: otherList, exactMatch: exact };
  }, [options, normalizedQuery, prioritizedNormalized]);

  const showAddNew = cleanedQuery.length > 0 && !exactMatch;

  const handleSelect = (selected: string) => {
    onChange(selected);
    setQuery(selected);
    setOpen(false);
    // Return focus to the trigger so the modal flow stays predictable
    setTimeout(() => inputRef.current?.blur(), 0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setQuery(next);
    onChange(next); // commit free-typed value immediately so form-state is fresh
    if (!open) setOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      // Defer to popover content
      if (!open) setOpen(true);
    }
    if (e.key === "Enter") {
      if (!open) return;
      // Prefer exact existing match, else create-new with cleaned value
      e.preventDefault();
      if (exactMatch) {
        handleSelect(exactMatch);
      } else if (cleanedQuery.length > 0) {
        handleSelect(cleanedQuery);
      }
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const handleBlur = () => {
    // Normalize on blur if no popover interaction happened. We use a small
    // delay so click events on popover items can fire first.
    setTimeout(() => {
      if (open) return;
      const cleaned = cleanDisplayName(query);
      if (cleaned !== query) {
        setQuery(cleaned);
        onChange(cleaned);
      }
    }, 150);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div ref={triggerRef} className={cn("relative", className)}>
          <Input
            ref={inputRef}
            value={query}
            onChange={handleInputChange}
            onFocus={() => setOpen(true)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            aria-invalid={hasError}
            className={cn("pr-8", hasError && "border-destructive")}
            autoComplete="off"
          />
          <ChevronDown
            className={cn(
              "absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-transform pointer-events-none",
              open && "rotate-180"
            )}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[var(--radix-popover-trigger-width)] overflow-hidden"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* ~5 option rows visible (each row ≈ 36px) before vertical scroll.
            Inline style avoids any Tailwind arbitrary-value purging issues.
            overscroll-contain stops the page from scrolling when the dropdown hits its top/bottom. */}
        <div
          className="overflow-y-auto overscroll-contain py-1"
          style={{ maxHeight: 200 }}
          onWheel={(e) => e.stopPropagation()}
        >
          {prioritized.length === 0 && others.length === 0 && !showAddNew && (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
              <Search className="h-4 w-4 opacity-50" />
              <span>No suggestions yet — type to add a new {entityLabel}.</span>
            </div>
          )}

          {prioritized.length > 0 && (
            <>
              {prioritizedHeader && (
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {prioritizedHeader}
                </div>
              )}
              {prioritized.map((opt) => (
                <OptionRow
                  key={`p-${opt}`}
                  label={opt}
                  selected={normalizeName(opt) === normalizeName(value)}
                  onClick={() => handleSelect(opt)}
                  highlight={normalizedQuery}
                />
              ))}
              {(others.length > 0 || showAddNew) && (
                <div className="my-1 border-t border-border/60" />
              )}
            </>
          )}

          {others.length > 0 && (
            <>
              {prioritized.length > 0 && (
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  All {entityLabel}s
                </div>
              )}
              {others.map((opt) => (
                <OptionRow
                  key={`o-${opt}`}
                  label={opt}
                  selected={normalizeName(opt) === normalizeName(value)}
                  onClick={() => handleSelect(opt)}
                  highlight={normalizedQuery}
                />
              ))}
            </>
          )}

          {showAddNew && (
            <>
              {(prioritized.length > 0 || others.length > 0) && (
                <div className="my-1 border-t border-border/60" />
              )}
              <button
                type="button"
                onClick={() => handleSelect(cleanedQuery)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors group"
              >
                <Plus className="h-3.5 w-3.5 text-muted-foreground group-hover:text-accent-foreground" />
                <span className="text-muted-foreground group-hover:text-accent-foreground">
                  Add
                </span>
                <span className="font-medium truncate">"{cleanedQuery}"</span>
                <span className="text-muted-foreground group-hover:text-accent-foreground ml-auto text-[11px]">
                  new {entityLabel}
                </span>
              </button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function OptionRow({
  label,
  selected,
  onClick,
  highlight,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  highlight: string;
}) {
  // Bold the matching segment, case-insensitive
  let display: React.ReactNode = label;
  if (highlight.length > 0) {
    const lower = label.toLowerCase();
    const idx = lower.indexOf(highlight);
    if (idx >= 0) {
      display = (
        <>
          {label.slice(0, idx)}
          <span className="font-semibold text-foreground">
            {label.slice(idx, idx + highlight.length)}
          </span>
          {label.slice(idx + highlight.length)}
        </>
      );
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      <Check
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          selected ? "opacity-100 text-foreground" : "opacity-0"
        )}
      />
      <span className="truncate">{display}</span>
    </button>
  );
}
