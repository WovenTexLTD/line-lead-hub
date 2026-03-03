/**
 * Hook to fetch and cache form template configuration.
 * Loads from Supabase form_templates + form_sections + form_fields + form_role_overrides.
 * Falls back to system defaults (factory_id = null) if no factory-specific config exists.
 * Applies role overrides to hide fields/sections and adjust required flags.
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type {
  FormType,
  FormTemplateConfig,
  FormSectionConfig,
  FormFieldConfig,
  FormRoleOverride,
  FormTemplateRow,
  FormSectionRow,
  FormFieldRow,
  FormRoleOverrideRow,
} from "@/types/form-config";

interface UseFormConfigReturn {
  config: FormTemplateConfig | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// In-memory cache keyed by "factoryId:formType:role"
const configCache = new Map<string, FormTemplateConfig>();

export function useFormConfig(formType: FormType): UseFormConfigReturn {
  const { profile, roles } = useAuth();
  const [config, setConfig] = useState<FormTemplateConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const factoryId = profile?.factory_id;
  const userRole = roles?.[0]?.role ?? "worker";

  const cacheKey = `${factoryId}:${formType}:${userRole}`;

  const fetchConfig = useCallback(async () => {
    if (!factoryId) return;

    // Check cache
    const cached = configCache.get(cacheKey);
    if (cached) {
      setConfig(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Fetch template (factory-specific first, then system default)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let { data: template } = await (supabase as any)
        .from("form_templates")
        .select("*")
        .eq("factory_id", factoryId)
        .eq("form_type", formType)
        .eq("is_active", true)
        .single();

      // Fall back to system default
      if (!template) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: defaultTemplate } = await (supabase as any)
          .from("form_templates")
          .select("*")
          .is("factory_id", null)
          .eq("form_type", formType)
          .eq("is_active", true)
          .single();
        template = defaultTemplate;
      }

      if (!template) {
        setError(`No form configuration found for ${formType}`);
        setLoading(false);
        return;
      }

      const tmpl = template as FormTemplateRow;

      // 2. Fetch sections
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sectionsData } = await (supabase as any)
        .from("form_sections")
        .select("*")
        .eq("template_id", tmpl.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      const sectionRows = (sectionsData ?? []) as FormSectionRow[];

      // 3. Fetch all fields for this template
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: fieldsData } = await (supabase as any)
        .from("form_fields")
        .select("*")
        .eq("template_id", tmpl.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      const fieldRows = (fieldsData ?? []) as FormFieldRow[];

      // 4. Fetch role overrides
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: overridesData } = await (supabase as any)
        .from("form_role_overrides")
        .select("*")
        .eq("template_id", tmpl.id);

      const overrideRows = (overridesData ?? []) as FormRoleOverrideRow[];

      // 5. Assemble config
      const roleOverrides: FormRoleOverride[] = overrideRows.map((r) => ({
        role: r.role,
        hidden_field_ids: r.hidden_field_ids ?? [],
        hidden_section_ids: r.hidden_section_ids ?? [],
        required_overrides: r.required_overrides ?? {},
      }));

      // Find override for current user's role
      const myOverride = roleOverrides.find((o) => o.role === userRole);

      // Group fields by section and apply role overrides
      const sections: FormSectionConfig[] = sectionRows
        .filter((s) => !myOverride?.hidden_section_ids.includes(s.id))
        .map((section) => {
          const sectionFields: FormFieldConfig[] = fieldRows
            .filter((f) => f.section_id === section.id)
            .filter((f) => !myOverride?.hidden_field_ids.includes(f.id))
            .map((f) => ({
              id: f.id,
              key: f.key,
              db_column: f.db_column,
              label_key: f.label_key,
              field_type: f.field_type as FormFieldConfig["field_type"],
              is_required: myOverride?.required_overrides[f.id] ?? f.is_required,
              is_custom: f.is_custom,
              sort_order: f.sort_order,
              is_active: f.is_active,
              default_value: f.default_value ?? undefined,
              placeholder: f.placeholder ?? undefined,
              validation: f.validation as FormFieldConfig["validation"],
              data_source: f.data_source as FormFieldConfig["data_source"],
              compute_expression: f.compute_expression ?? undefined,
              auto_fill_from: f.auto_fill_from as FormFieldConfig["auto_fill_from"],
              visible_when: f.visible_when as FormFieldConfig["visible_when"],
            }));

          return {
            id: section.id,
            key: section.key,
            title_key: section.title_key,
            description: section.description ?? undefined,
            sort_order: section.sort_order,
            is_collapsible: section.is_collapsible,
            is_active: section.is_active,
            fields: sectionFields,
          };
        });

      const fullConfig: FormTemplateConfig = {
        id: tmpl.id,
        form_type: tmpl.form_type as FormType,
        target_table: tmpl.target_table,
        name: tmpl.name,
        sections,
        role_overrides: roleOverrides,
      };

      configCache.set(cacheKey, fullConfig);
      setConfig(fullConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load form config");
    } finally {
      setLoading(false);
    }
  }, [factoryId, formType, userRole, cacheKey]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const refetch = useCallback(() => {
    configCache.delete(cacheKey);
    fetchConfig();
  }, [cacheKey, fetchConfig]);

  return { config, loading, error, refetch };
}

/** Clear the entire form config cache (e.g., after admin saves changes) */
export function clearFormConfigCache() {
  configCache.clear();
}
