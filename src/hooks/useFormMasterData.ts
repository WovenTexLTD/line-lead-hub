/**
 * Hook to fetch master data (dropdown options) for a dynamic form.
 * Scans all fields for data_source definitions and fetches each table once.
 * Handles factory_id scoping and dependent filtering.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { FormTemplateConfig, DataSource } from "@/types/form-config";

type MasterData = Record<string, Record<string, unknown>[]>;

interface UseFormMasterDataReturn {
  masterData: MasterData;
  loading: boolean;
  error: string | null;
}

// Tables that are factory-scoped (have factory_id column)
const FACTORY_SCOPED_TABLES = new Set([
  "lines",
  "work_orders",
  "units",
  "floors",
  "stages",
  "stage_progress_options",
  "next_milestone_options",
  "blocker_types",
  "blocker_owner_options",
  "blocker_impact_options",
]);

export function useFormMasterData(
  config: FormTemplateConfig | null
): UseFormMasterDataReturn {
  const { profile } = useAuth();
  const [masterData, setMasterData] = useState<MasterData>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const factoryId = profile?.factory_id;

  // Collect unique data sources from all fields
  const dataSources = useMemo(() => {
    if (!config) return [];
    const sources: DataSource[] = [];
    const seen = new Set<string>();

    for (const section of config.sections) {
      for (const field of section.fields) {
        if (field.data_source && !seen.has(field.data_source.table)) {
          seen.add(field.data_source.table);
          sources.push(field.data_source);
        }
      }
    }
    return sources;
  }, [config]);

  const fetchData = useCallback(async () => {
    if (!factoryId || dataSources.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const results: MasterData = {};

      await Promise.all(
        dataSources.map(async (source) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let query = (supabase as any)
            .from(source.table)
            .select("*");

          // Apply factory scoping
          if (FACTORY_SCOPED_TABLES.has(source.table)) {
            query = query.eq("factory_id", factoryId);
          }

          // Apply static filters
          if (source.filters) {
            for (const [key, value] of Object.entries(source.filters)) {
              if (value === true || value === false) {
                query = query.eq(key, value);
              } else if (typeof value === "string" || typeof value === "number") {
                query = query.eq(key, value);
              }
            }
          }

          // Apply ordering
          if (source.order_by) {
            query = query.order(source.order_by, { ascending: true });
          }

          const { data, error: fetchError } = await query;

          if (fetchError) {
            console.error(`Error fetching ${source.table}:`, fetchError);
            results[source.table] = [];
          } else {
            results[source.table] = data ?? [];
          }
        })
      );

      setMasterData(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load form data");
    } finally {
      setLoading(false);
    }
  }, [factoryId, dataSources]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { masterData, loading, error };
}

/**
 * Get filtered options for a field that depends on another field's value.
 * E.g., work_orders filtered by selected line_id.
 */
export function getFilteredOptions(
  masterData: MasterData,
  dataSource: DataSource,
  formValues: Record<string, unknown>
): Record<string, unknown>[] {
  const allRows = masterData[dataSource.table] ?? [];

  if (!dataSource.depends_on) return allRows;

  const dependencyValue = formValues[dataSource.depends_on];
  if (!dependencyValue) return allRows;

  // Filter rows where the depends_on column matches the current value
  // Convention: the depends_on field key maps to the same column name in the source table
  return allRows.filter((row) => {
    const rowVal = row[dataSource.depends_on!];
    return rowVal === dependencyValue || rowVal === null || rowVal === undefined;
  });
}
