/**
 * Form Submit Handler
 * Builds the payload from dynamic form values and separates
 * real DB columns from custom fields (stored in custom_data JSONB).
 */

import type { FormTemplateConfig, FormFieldConfig } from "@/types/form-config";
import { getTodayInTimezone } from "@/lib/date-utils";

interface SubmitPayload {
  /** Fields mapped to real DB columns */
  dbPayload: Record<string, unknown>;
  /** The offline queue form type string */
  queueFormType: string;
  /** The target table name */
  tableName: string;
}

/**
 * Build the submission payload from form values and config.
 * Separates standard DB columns from custom fields.
 */
export function buildSubmitPayload(
  config: FormTemplateConfig,
  formValues: Record<string, unknown>,
  metadata: {
    factory_id: string;
    submitted_by: string;
    timezone: string;
  }
): SubmitPayload {
  const dbPayload: Record<string, unknown> = {};
  const customData: Record<string, unknown> = {};

  // Iterate all fields and map values
  for (const section of config.sections) {
    for (const field of section.fields) {
      const value = formValues[field.key];

      // Skip computed and readonly fields — they're display-only
      if (field.field_type === "computed" || field.field_type === "readonly") {
        continue;
      }

      // Skip file_upload — handled separately (photo upload to storage)
      if (field.field_type === "file_upload") {
        continue;
      }

      // Skip empty optional values
      if (!field.is_required && (value === undefined || value === null || value === "")) {
        continue;
      }

      // Parse number fields
      let processedValue = value;
      if (field.field_type === "number" && typeof value === "string") {
        processedValue = value === "" ? null : parseFloat(value);
      }

      if (field.is_custom || !field.db_column) {
        // Custom fields go into custom_data JSONB
        customData[field.key] = processedValue;
      } else {
        // Standard fields map to real DB columns
        dbPayload[field.db_column] = processedValue;
      }
    }
  }

  // Add metadata
  dbPayload.factory_id = metadata.factory_id;
  dbPayload.submitted_by = metadata.submitted_by;
  dbPayload.submitted_at = new Date().toISOString();
  dbPayload.production_date = getTodayInTimezone(metadata.timezone);

  // Add custom_data if any custom fields exist
  if (Object.keys(customData).length > 0) {
    dbPayload.custom_data = customData;
  }

  return {
    dbPayload,
    queueFormType: config.target_table,
    tableName: config.target_table,
  };
}

/**
 * Get all fields from a config (flattened across sections).
 */
export function getAllFields(config: FormTemplateConfig): FormFieldConfig[] {
  return config.sections.flatMap((s) => s.fields);
}

/**
 * Build initial form values from config defaults and optional edit data.
 */
export function buildInitialValues(
  config: FormTemplateConfig,
  editData?: Record<string, unknown>
): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  for (const section of config.sections) {
    for (const field of section.fields) {
      if (editData && field.db_column && editData[field.db_column] !== undefined) {
        values[field.key] = editData[field.db_column];
      } else if (field.default_value !== undefined) {
        // Parse default based on field type
        if (field.field_type === "number") {
          values[field.key] = field.default_value;
        } else if (field.field_type === "toggle") {
          values[field.key] = field.default_value === "true";
        } else {
          values[field.key] = field.default_value;
        }
      } else if (field.field_type === "toggle") {
        values[field.key] = false;
      } else {
        values[field.key] = "";
      }
    }
  }

  return values;
}
