import { Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { POSubmissionsTab } from "./POSubmissionsTab";
import { POPipelineTab } from "./POPipelineTab";
import { POQualityTab } from "./POQualityTab";
import type { POControlRoomData, PODetailData } from "./types";

interface Props {
  po: POControlRoomData;
  detailData: PODetailData | null;
  loading: boolean;
}

export function POExpandedPanel({ po, detailData, loading }: Props) {
  if (loading || !detailData) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4">
      <Tabs defaultValue="submissions">
        <TabsList className="mb-3">
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="quality">Quality</TabsTrigger>
        </TabsList>
        <TabsContent value="submissions">
          <POSubmissionsTab submissions={detailData.submissions} />
        </TabsContent>
        <TabsContent value="pipeline">
          <POPipelineTab stages={detailData.pipeline} />
        </TabsContent>
        <TabsContent value="quality">
          <POQualityTab
            quality={detailData.quality}
            orderQty={po.order_qty}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
