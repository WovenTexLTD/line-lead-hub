import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileBarChart } from "lucide-react";

export function InsightsReportDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FileBarChart className="h-4 w-4" />
          Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Insights Report</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Insights report generation coming soon.</p>
      </DialogContent>
    </Dialog>
  );
}
