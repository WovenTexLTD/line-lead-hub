import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";

interface ReportExportDialogProps {
  title?: string;
  children?: React.ReactNode;
  defaultType?: string;
  weekOffset?: number;
  date?: string;
  dailyReportData?: any;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ReportExportDialog({ title = "Export Report", children, open: controlledOpen, onOpenChange, ...rest }: ReportExportDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FileDown className="h-4 w-4" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children || <p className="text-sm text-muted-foreground">Export functionality coming soon.</p>}
      </DialogContent>
    </Dialog>
  );
}
