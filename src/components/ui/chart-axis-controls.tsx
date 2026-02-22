import { ChevronUp, ChevronDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChartAxisControlsProps {
  yMin: number;
  yMax: number;
  onYMinChange: (v: number) => void;
  onYMaxChange: (v: number) => void;
  onReset: () => void;
  step?: number;
  className?: string;
}

export function ChartAxisControls({
  yMin,
  yMax,
  onYMinChange,
  onYMaxChange,
  onReset,
  step = 500,
  className,
}: ChartAxisControlsProps) {
  return (
    <div className={cn("flex items-center gap-1 text-xs", className)}>
      <span className="text-muted-foreground mr-1">Y-axis:</span>

      {/* Max controls */}
      <div className="flex items-center gap-0.5 border rounded-md px-1 py-0.5 bg-muted/30">
        <span className="text-muted-foreground text-[10px] mr-0.5">Max</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => onYMaxChange(yMax + step)}
          title="Increase max"
        >
          <ChevronUp className="h-3 w-3" />
        </Button>
        <span className="font-mono min-w-[3rem] text-center">{yMax.toLocaleString()}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => onYMaxChange(Math.max(yMin + step, yMax - step))}
          title="Decrease max"
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
      </div>

      {/* Min controls */}
      <div className="flex items-center gap-0.5 border rounded-md px-1 py-0.5 bg-muted/30">
        <span className="text-muted-foreground text-[10px] mr-0.5">Min</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => onYMinChange(Math.min(yMax - step, yMin + step))}
          title="Increase min"
        >
          <ChevronUp className="h-3 w-3" />
        </Button>
        <span className="font-mono min-w-[3rem] text-center">{yMin.toLocaleString()}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => onYMinChange(Math.max(0, yMin - step))}
          title="Decrease min"
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 ml-1"
        onClick={onReset}
        title="Reset axes"
      >
        <RotateCcw className="h-3 w-3" />
      </Button>
    </div>
  );
}
