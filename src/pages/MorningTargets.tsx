import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import SewingMorningTargetsForm from "@/components/forms/SewingMorningTargetsForm";
import FinishingMorningTargetsForm from "@/components/forms/FinishingMorningTargetsForm";

export default function MorningTargets() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("sewing");

  return (
    <div className="container max-w-2xl py-4 px-4 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Morning Targets</h1>
          <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="sewing">Sewing</TabsTrigger>
          <TabsTrigger value="finishing">Finishing</TabsTrigger>
        </TabsList>

        <TabsContent value="sewing">
          <SewingMorningTargetsForm />
        </TabsContent>

        <TabsContent value="finishing">
          <FinishingMorningTargetsForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
