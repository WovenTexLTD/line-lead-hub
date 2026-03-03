/**
 * DynamicFormRenderer — Config-driven form component.
 * Replaces hardcoded forms by reading from form_templates/sections/fields in Supabase.
 * Handles: rendering, validation, computed fields, auto-fill, and offline submission.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useFormConfig } from "@/hooks/useFormConfig";
import { useFormMasterData, getFilteredOptions } from "@/hooks/useFormMasterData";
import { useDynamicValidation } from "@/hooks/useDynamicValidation";
import { useOfflineSubmission } from "@/hooks/useOfflineSubmission";
import { evaluateExpression, getExpressionDependencies } from "@/lib/form-computations";
import {
  buildSubmitPayload,
  buildInitialValues,
  getAllFields,
} from "@/lib/form-submit-handler";
import { DynamicField } from "./DynamicField";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Loader2, ChevronDown, ChevronUp, Send } from "lucide-react";
import { toast } from "sonner";
import type { FormType, FormFieldConfig } from "@/types/form-config";
import type { FormType as QueueFormType } from "@/lib/offline-queue";

interface DynamicFormRendererProps {
  formType: FormType;
  editData?: Record<string, unknown>;
  onSuccess?: () => void;
}

export function DynamicFormRenderer({
  formType,
  editData,
  onSuccess,
}: DynamicFormRendererProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile, factory, isAdminOrHigher } = useAuth();
  const { config, loading: configLoading, error: configError } = useFormConfig(formType);
  const { masterData, loading: dataLoading } = useFormMasterData(config);
  const { validate } = useDynamicValidation(config);
  const { submit: offlineSubmit } = useOfflineSubmission();

  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Initialize form values when config loads
  useEffect(() => {
    if (config) {
      setFormValues(buildInitialValues(config, editData));
    }
  }, [config, editData]);

  // Get all computed fields for reactivity
  const computedFields = useMemo(() => {
    if (!config) return [];
    return getAllFields(config).filter(
      (f) => f.field_type === "computed" && f.compute_expression
    );
  }, [config]);

  // Get all auto-fill fields
  const autoFillFields = useMemo(() => {
    if (!config) return [];
    return getAllFields(config).filter((f) => f.auto_fill_from);
  }, [config]);

  // Recalculate computed fields when dependencies change
  useEffect(() => {
    if (computedFields.length === 0) return;

    const updates: Record<string, unknown> = {};
    let hasUpdates = false;

    for (const field of computedFields) {
      const result = evaluateExpression(field.compute_expression!, formValues);
      if (formValues[field.key] !== result) {
        updates[field.key] = result;
        hasUpdates = true;
      }
    }

    if (hasUpdates) {
      setFormValues((prev) => ({ ...prev, ...updates }));
    }
  }, [formValues, computedFields]);

  // Handle auto-fill when a source field changes
  const handleAutoFill = useCallback(
    (changedKey: string, changedValue: unknown) => {
      const fills = autoFillFields.filter(
        (f) => f.auto_fill_from?.source_field === changedKey
      );

      if (fills.length === 0) return;

      const updates: Record<string, unknown> = {};

      for (const field of fills) {
        const af = field.auto_fill_from!;
        const sourceData = masterData[af.source_table];
        if (!sourceData) continue;

        // Find the row matching the changed value
        const row = sourceData.find(
          (r) => String(r.id ?? r[af.source_field]) === String(changedValue)
        );

        if (row) {
          updates[field.key] = row[af.source_column] ?? "";
        }
      }

      if (Object.keys(updates).length > 0) {
        setFormValues((prev) => ({ ...prev, ...updates }));
      }
    },
    [autoFillFields, masterData]
  );

  // Field change handler
  const handleFieldChange = useCallback(
    (key: string, value: unknown) => {
      setFormValues((prev) => ({ ...prev, [key]: value }));
      // Clear error for this field
      setErrors((prev) => {
        if (prev[key]) {
          const next = { ...prev };
          delete next[key];
          return next;
        }
        return prev;
      });
      // Trigger auto-fill
      handleAutoFill(key, value);
    },
    [handleAutoFill]
  );

  // Check if a field should be visible based on visible_when condition
  const isFieldVisible = useCallback(
    (field: FormFieldConfig): boolean => {
      if (!field.visible_when) return true;
      const { field: depField, equals, not_equals } = field.visible_when;
      const depValue = formValues[depField];

      if (equals !== undefined) return depValue === equals;
      if (not_equals !== undefined) return depValue !== not_equals;
      return true;
    },
    [formValues]
  );

  // Toggle collapsible section
  const toggleSection = (sectionKey: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
      } else {
        next.add(sectionKey);
      }
      return next;
    });
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!config || !profile?.factory_id || !factory) return;

    // Validate
    const validationResult = validate(formValues);
    if (!validationResult.success) {
      setErrors(validationResult.errors);
      // Scroll to first error
      const firstErrorKey = Object.keys(validationResult.errors)[0];
      const el = document.querySelector(`[data-field-key="${firstErrorKey}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      const { dbPayload, tableName } = buildSubmitPayload(config, formValues, {
        factory_id: profile.factory_id,
        submitted_by: profile.id,
        timezone: factory.timezone ?? "Asia/Dhaka",
      });

      // Handle photo uploads separately if there are file_upload fields
      const fileFields = getAllFields(config).filter(
        (f) => f.field_type === "file_upload"
      );
      for (const fileField of fileFields) {
        const files = formValues[fileField.key] as File[] | undefined;
        if (files && files.length > 0) {
          const urls: string[] = [];
          for (const file of files) {
            const fileName = `${profile.factory_id}/${formType}/${Date.now()}-${file.name}`;
            const { error: uploadError } = await supabase.storage
              .from("form-uploads")
              .upload(fileName, file);
            if (!uploadError) {
              const { data: urlData } = supabase.storage
                .from("form-uploads")
                .getPublicUrl(fileName);
              urls.push(urlData.publicUrl);
            }
          }
          if (fileField.db_column) {
            dbPayload[fileField.db_column] = urls;
          }
        }
      }

      const result = await offlineSubmit(
        tableName as QueueFormType,
        tableName,
        dbPayload,
        {
          showSuccessToast: false,
          showQueuedToast: true,
        }
      );

      if (result.queued) {
        toast.success(t("common.savedOffline") || "Saved offline");
        handlePostSubmit();
        return;
      }

      if (!result.success) {
        if (result.error?.includes("duplicate")) {
          toast.error(
            t("forms.duplicateSubmission") || "Duplicate submission detected"
          );
        } else {
          throw new Error(result.error);
        }
        return;
      }

      toast.success(t("forms.submissionSuccess") || "Submitted successfully");
      handlePostSubmit();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Submission failed";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePostSubmit = () => {
    if (onSuccess) {
      onSuccess();
    } else if (isAdminOrHigher()) {
      navigate("/dashboard");
    } else {
      navigate("/my-submissions");
    }
  };

  // Loading state
  if (configLoading || dataLoading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (configError || !config) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center p-4">
        <p className="text-muted-foreground">
          {configError || "Form configuration not found"}
        </p>
      </div>
    );
  }

  // No factory
  if (!profile?.factory_id) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center p-4">
        <p className="text-muted-foreground">{t("common.noFactoryAssigned")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {config.sections.map((section) => {
        const visibleFields = section.fields.filter(isFieldVisible);
        if (visibleFields.length === 0) return null;

        const isCollapsed = collapsedSections.has(section.key);

        if (section.is_collapsible) {
          return (
            <Collapsible
              key={section.id}
              open={!isCollapsed}
              onOpenChange={() => toggleSection(section.key)}
            >
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {resolveTitle(section.title_key, t)}
                      </CardTitle>
                      {isCollapsed ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronUp className="h-4 w-4" />
                      )}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4">
                    {visibleFields.map((field) => (
                      <div key={field.id} data-field-key={field.key}>
                        <DynamicField
                          field={field}
                          value={formValues[field.key]}
                          onChange={handleFieldChange}
                          error={errors[field.key]}
                          masterData={masterData}
                          formValues={formValues}
                        />
                      </div>
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        }

        return (
          <Card key={section.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {resolveTitle(section.title_key, t)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {visibleFields.map((field) => (
                <div key={field.id} data-field-key={field.key}>
                  <DynamicField
                    field={field}
                    value={formValues[field.key]}
                    onChange={handleFieldChange}
                    error={errors[field.key]}
                    masterData={masterData}
                    formValues={formValues}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {/* Submit Button */}
      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={submitting}
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("common.submitting") || "Submitting..."}
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            {t("common.submit") || "Submit"}
          </>
        )}
      </Button>
    </form>
  );
}

function resolveTitle(key: string, t: (k: string) => string): string {
  if (key.includes(".")) {
    const translated = t(key);
    return translated === key ? key : translated;
  }
  return key;
}
