/**
 * FormBuilder — Admin page listing all 8 form types.
 * Click a form type to open the FormBuilderEditor for customization.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Scissors,
  Shirt,
  Package,
  AlertTriangle,
  RefreshCw,
  Settings2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { FormType, FormTemplateRow } from "@/types/form-config";
import { FORM_TYPE_LABELS } from "@/types/form-config";
import { getDefaultFormConfigs } from "@/lib/default-form-configs";

interface FormTypeCard {
  formType: FormType;
  label: string;
  description: string;
  icon: React.ElementType;
  department: string;
}

const FORM_CARDS: FormTypeCard[] = [
  { formType: "sewing_eod", label: "Sewing End of Day", description: "Daily actual output, manpower, hours, and stage progress", icon: Shirt, department: "Sewing" },
  { formType: "sewing_targets", label: "Sewing Morning Targets", description: "Daily targets, planned manpower, and milestones", icon: Shirt, department: "Sewing" },
  { formType: "finishing_eod", label: "Finishing End of Day", description: "QC pass, poly, carton counts, and hours", icon: Package, department: "Finishing" },
  { formType: "finishing_targets", label: "Finishing Morning Targets", description: "Per-hour targets and planned manpower", icon: Package, department: "Finishing" },
  { formType: "cutting_eod", label: "Cutting End of Day", description: "Cutting/input quantities, capacities, and leftover tracking", icon: Scissors, department: "Cutting" },
  { formType: "sewing_update", label: "Sewing Update", description: "Production numbers, tracking, and photos", icon: Shirt, department: "Sewing" },
  { formType: "finishing_update", label: "Finishing Update", description: "Finishing metrics and production update", icon: Package, department: "Finishing" },
  { formType: "report_blocker", label: "Report Blocker", description: "Report production blockers with type and severity", icon: AlertTriangle, department: "All" },
];

export default function FormBuilder() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [templates, setTemplates] = useState<FormTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (profile?.factory_id) {
      fetchTemplates();
    }
  }, [profile?.factory_id]);

  async function fetchTemplates() {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("form_templates")
      .select("*")
      .or(`factory_id.eq.${profile!.factory_id},factory_id.is.null`);

    if (!error && data) {
      setTemplates(data);
    }
    setLoading(false);
  }

  function getTemplateForType(formType: FormType): FormTemplateRow | undefined {
    // Prefer factory-specific, then system default
    return (
      templates.find((t) => t.form_type === formType && t.factory_id === profile?.factory_id) ??
      templates.find((t) => t.form_type === formType && !t.factory_id)
    );
  }

  async function seedDefaultConfigs() {
    if (!profile?.factory_id) return;
    setSeeding(true);

    try {
      const defaults = getDefaultFormConfigs();

      for (const config of defaults) {
        // Insert template
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: tmpl, error: tmplError } = await (supabase as any)
          .from("form_templates")
          .insert({
            factory_id: profile.factory_id,
            form_type: config.form_type,
            target_table: config.target_table,
            name: config.name,
          })
          .select()
          .single();

        if (tmplError) {
          console.error(`Error seeding ${config.form_type}:`, tmplError);
          continue;
        }

        // Insert sections
        for (const section of config.sections) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: sec, error: secError } = await (supabase as any)
            .from("form_sections")
            .insert({
              template_id: tmpl.id,
              key: section.key,
              title_key: section.title_key,
              description: section.description ?? null,
              sort_order: section.sort_order,
              is_collapsible: section.is_collapsible,
            })
            .select()
            .single();

          if (secError) {
            console.error(`Error seeding section ${section.key}:`, secError);
            continue;
          }

          // Insert fields
          for (const field of section.fields) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any).from("form_fields").insert({
              section_id: sec.id,
              template_id: tmpl.id,
              key: field.key,
              db_column: field.db_column,
              label_key: field.label_key,
              field_type: field.field_type,
              is_required: field.is_required,
              is_custom: field.is_custom,
              sort_order: field.sort_order,
              default_value: field.default_value ?? null,
              placeholder: field.placeholder ?? null,
              validation: field.validation ?? null,
              data_source: field.data_source ?? null,
              compute_expression: field.compute_expression ?? null,
              auto_fill_from: field.auto_fill_from ?? null,
              visible_when: field.visible_when ?? null,
            });
          }
        }
      }

      toast.success("Default form configurations created");
      fetchTemplates();
    } catch (err) {
      toast.error("Failed to seed default configs");
      console.error(err);
    } finally {
      setSeeding(false);
    }
  }

  const hasConfigs = templates.some((t) => t.factory_id === profile?.factory_id);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/setup")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Form Builder</h1>
            <p className="text-sm text-muted-foreground">
              Customize form fields, sections, and role visibility
            </p>
          </div>
        </div>
      </div>

      {/* Seed defaults if no configs exist yet */}
      {!loading && !hasConfigs && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Settings2 className="h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="font-semibold">No custom configurations yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              Initialize your factory with default form configurations. You can then
              customize each form by adding, removing, or reordering fields.
            </p>
            <Button onClick={seedDefaultConfigs} disabled={seeding}>
              {seeding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating defaults...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Initialize Default Forms
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Form type cards */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FORM_CARDS.map((card) => {
            const template = getTemplateForType(card.formType);
            const isCustomized = template?.factory_id === profile?.factory_id;
            const Icon = card.icon;

            return (
              <Card
                key={card.formType}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => {
                  if (template) {
                    navigate(`/setup/form-builder/${card.formType}`);
                  } else {
                    toast.info("Initialize default forms first");
                  }
                }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">{card.label}</CardTitle>
                    </div>
                    <div className="flex gap-1">
                      <Badge variant="outline" className="text-xs">
                        {card.department}
                      </Badge>
                      {isCustomized && (
                        <Badge variant="default" className="text-xs">
                          Customized
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardDescription className="text-xs">
                    {card.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
