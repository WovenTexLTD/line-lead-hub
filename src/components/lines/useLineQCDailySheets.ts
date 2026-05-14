import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type LineQCSheetStatus = "in_progress" | "awaiting_signoff" | "signed_off";

export interface LineQCDailySheet {
  id: string;
  inspection_date: string;
  shift: string;
  status: LineQCSheetStatus;
  po_number: string;
  buyer: string;
  style: string;
  inspector_name: string | null;
  items_pass: number;
  items_fail: number;
  items_pending: number;
  items_na: number;
  items_total: number;
}

interface Options {
  lineId: string | null;
  startDate: string; // YYYY-MM-DD inclusive
  endDate: string;   // YYYY-MM-DD inclusive
}

export function useLineQCDailySheets({ lineId, startDate, endDate }: Options) {
  const { profile } = useAuth();
  const [sheets, setSheets] = useState<LineQCDailySheet[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const factoryId = profile?.factory_id;
    if (!factoryId || !lineId) {
      setSheets([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data: rawSheets } = await supabase
        .from("qc_daily_sheets")
        .select(
          `id, inspection_date, shift, status, inspector_id,
           work_orders(po_number, buyer, style)`
        )
        .eq("factory_id", factoryId)
        .eq("line_id", lineId)
        .gte("inspection_date", startDate)
        .lte("inspection_date", endDate)
        .order("inspection_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (cancelled) return;

      const sheetIds = (rawSheets ?? []).map((s) => (s as { id: string }).id);
      const inspectorIds = Array.from(
        new Set(
          (rawSheets ?? [])
            .map((s) => (s as { inspector_id: string | null }).inspector_id)
            .filter((id): id is string => !!id)
        )
      );

      // Aggregate item counts per sheet
      const counts = new Map<
        string,
        { total: number; pass: number; fail: number; na: number; pending: number }
      >();
      if (sheetIds.length > 0) {
        const { data: items } = await supabase
          .from("qc_daily_sheet_items")
          .select("sheet_id, status")
          .in("sheet_id", sheetIds);
        for (const i of items ?? []) {
          const row = i as { sheet_id: string; status: string };
          const c = counts.get(row.sheet_id) ?? {
            total: 0,
            pass: 0,
            fail: 0,
            na: 0,
            pending: 0,
          };
          c.total += 1;
          if (row.status === "pass") c.pass += 1;
          else if (row.status === "fail") c.fail += 1;
          else if (row.status === "na") c.na += 1;
          else c.pending += 1;
          counts.set(row.sheet_id, c);
        }
      }

      // Inspector names
      const inspectorNames = new Map<string, string | null>();
      if (inspectorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", inspectorIds);
        for (const p of profiles ?? []) {
          const row = p as { id: string; full_name: string | null };
          inspectorNames.set(row.id, row.full_name);
        }
      }

      if (cancelled) return;

      const rows: LineQCDailySheet[] = (rawSheets ?? []).map((s) => {
        const sheet = s as {
          id: string;
          inspection_date: string;
          shift: string;
          status: LineQCSheetStatus;
          inspector_id: string | null;
          work_orders: { po_number: string; buyer: string; style: string } | null;
        };
        const c = counts.get(sheet.id) ?? {
          total: 0,
          pass: 0,
          fail: 0,
          na: 0,
          pending: 0,
        };
        return {
          id: sheet.id,
          inspection_date: sheet.inspection_date,
          shift: sheet.shift,
          status: sheet.status,
          po_number: sheet.work_orders?.po_number ?? "",
          buyer: sheet.work_orders?.buyer ?? "",
          style: sheet.work_orders?.style ?? "",
          inspector_name: sheet.inspector_id
            ? inspectorNames.get(sheet.inspector_id) ?? null
            : null,
          items_pass: c.pass,
          items_fail: c.fail,
          items_pending: c.pending,
          items_na: c.na,
          items_total: c.total,
        };
      });

      setSheets(rows);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.factory_id, lineId, startDate, endDate]);

  return { sheets, loading };
}
