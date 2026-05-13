import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface LineQCSheetSummary {
  count: number;
  signedOff: number;
  awaitingSignoff: number;
  inProgress: number;
}

export type LineQCSheetMap = Map<string, LineQCSheetSummary>;

interface Options {
  startDate: string; // YYYY-MM-DD inclusive
  endDate: string;   // YYYY-MM-DD inclusive
}

export function useQCLineSheets({ startDate, endDate }: Options) {
  const { profile } = useAuth();
  const [byLineId, setByLineId] = useState<LineQCSheetMap>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const factoryId = profile?.factory_id;
    if (!factoryId) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data } = await supabase
        .from("qc_daily_sheets")
        .select("line_id, status")
        .eq("factory_id", factoryId)
        .gte("inspection_date", startDate)
        .lte("inspection_date", endDate);

      if (cancelled) return;

      const map: LineQCSheetMap = new Map();
      for (const sheet of data ?? []) {
        const lineId = (sheet as { line_id: string }).line_id;
        const status = (sheet as { status: string }).status;
        if (!lineId) continue;
        const summary = map.get(lineId) ?? {
          count: 0,
          signedOff: 0,
          awaitingSignoff: 0,
          inProgress: 0,
        };
        summary.count += 1;
        if (status === "signed_off") summary.signedOff += 1;
        else if (status === "awaiting_signoff") summary.awaitingSignoff += 1;
        else summary.inProgress += 1;
        map.set(lineId, summary);
      }

      setByLineId(map);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.factory_id, startDate, endDate]);

  return { byLineId, loading };
}
