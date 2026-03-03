/**
 * Hook to generate a Zod validation schema from form field configs at runtime.
 * Maps field_type + validation rules to Zod validators.
 */

import { useMemo } from "react";
import { z, ZodObject, ZodRawShape } from "zod";
import type { FormTemplateConfig, FormFieldConfig, ValidationRule } from "@/types/form-config";

interface ValidationResult {
  success: boolean;
  errors: Record<string, string>;
}

interface UseDynamicValidationReturn {
  validate: (formValues: Record<string, unknown>) => ValidationResult;
  schema: ZodObject<ZodRawShape> | null;
}

function buildFieldValidator(field: FormFieldConfig): z.ZodTypeAny {
  const v = field.validation ?? {};

  switch (field.field_type) {
    case "number": {
      let schema = z.number({
        required_error: `${field.label_key} is required`,
        invalid_type_error: `${field.label_key} must be a number`,
      });
      if (v.integer) schema = schema.int();
      if (v.min !== undefined) schema = schema.min(v.min);
      if (v.max !== undefined) schema = schema.max(v.max);
      return field.is_required ? schema : schema.optional().or(z.literal("").transform(() => undefined));
    }

    case "text": {
      let schema = z.string();
      if (v.min_length) schema = schema.min(v.min_length);
      if (v.max_length) schema = schema.max(v.max_length);
      if (v.pattern) schema = schema.regex(new RegExp(v.pattern));
      return field.is_required ? schema.min(1, `${field.label_key} is required`) : schema.optional().or(z.literal(""));
    }

    case "textarea": {
      let schema = z.string();
      if (v.max_length) schema = schema.max(v.max_length);
      return field.is_required ? schema.min(1, `${field.label_key} is required`) : schema.optional().or(z.literal(""));
    }

    case "select":
    case "searchable_select": {
      const schema = z.string();
      return field.is_required ? schema.min(1, `${field.label_key} is required`) : schema.optional().or(z.literal(""));
    }

    case "date": {
      const schema = z.string();
      return field.is_required ? schema.min(1, `${field.label_key} is required`) : schema.optional().or(z.literal(""));
    }

    case "toggle": {
      return z.boolean().optional();
    }

    case "file_upload": {
      // File uploads are validated separately (by the DynamicField component)
      return z.any().optional();
    }

    case "readonly":
    case "computed": {
      // Read-only and computed fields don't need validation
      return z.any().optional();
    }

    default:
      return z.any().optional();
  }
}

export function useDynamicValidation(
  config: FormTemplateConfig | null
): UseDynamicValidationReturn {
  const schema = useMemo(() => {
    if (!config) return null;

    const shape: ZodRawShape = {};

    for (const section of config.sections) {
      for (const field of section.fields) {
        if (field.field_type === "readonly" || field.field_type === "computed") continue;
        shape[field.key] = buildFieldValidator(field);
      }
    }

    return z.object(shape);
  }, [config]);

  const validate = useMemo(() => {
    return (formValues: Record<string, unknown>): ValidationResult => {
      if (!schema) return { success: true, errors: {} };

      // Pre-process: convert string numbers to actual numbers for number fields
      const processed: Record<string, unknown> = {};
      if (config) {
        for (const section of config.sections) {
          for (const field of section.fields) {
            const val = formValues[field.key];
            if (field.field_type === "number" && typeof val === "string") {
              if (val === "") {
                processed[field.key] = field.is_required ? undefined : undefined;
              } else {
                const parsed = parseFloat(val);
                processed[field.key] = isNaN(parsed) ? val : parsed;
              }
            } else {
              processed[field.key] = val;
            }
          }
        }
      }

      const result = schema.safeParse(processed);

      if (result.success) {
        return { success: true, errors: {} };
      }

      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const path = issue.path[0];
        if (path && typeof path === "string") {
          errors[path] = issue.message;
        }
      }

      return { success: false, errors };
    };
  }, [schema, config]);

  return { validate, schema };
}
