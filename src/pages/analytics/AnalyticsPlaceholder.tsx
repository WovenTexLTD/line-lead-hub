import { type LucideIcon } from "lucide-react";

interface AnalyticsPlaceholderProps {
  title: string;
  description: string;
  icon: LucideIcon;
  metrics: string[];
}

export function AnalyticsPlaceholder({ title, description, icon: Icon, metrics }: AnalyticsPlaceholderProps) {
  return (
    <div className="py-8">
      <div className="flex items-center gap-3 mb-2">
        <Icon className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      </div>
      <p className="text-muted-foreground mb-8 max-w-lg">{description}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric) => (
          <div
            key={metric}
            className="rounded-xl border bg-card p-5 flex flex-col gap-2"
          >
            <span className="text-sm font-medium text-muted-foreground">{metric}</span>
            <div className="h-8 w-24 rounded-md bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
