/**
 * Form Builder Configuration Types
 * Used by DynamicFormRenderer and the admin Form Builder UI
 */

export type FormType =
  | "sewing_eod"
  | "sewing_targets"
  | "finishing_eod"
  | "finishing_targets"
  | "cutting_eod"
  | "sewing_update"
  | "finishing_update"
  | "report_blocker";

export type FieldType =
  | "number"
  | "text"
  | "textarea"
  | "select"
  | "searchable_select"
  | "date"
  | "file_upload"
  | "toggle"
  | "readonly"
  | "computed";

export interface ValidationRule {
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
  min_length?: number;
  max_length?: number;
  pattern?: string;
}

export interface DataSource {
  table: string;
  value_column: string;
  label_column: string;
  filters?: Record<string, unknown>;
  order_by?: string;
  depends_on?: string; // field key that filters this data source
}

export interface AutoFill {
  source_field: string; // which field triggers the auto-fill
  source_table: string; // table to look up the value
  source_column: string; // column to read the value from
}

export interface VisibleWhen {
  field: string;
  equals?: unknown;
  not_equals?: unknown;
}

export interface FormFieldConfig {
  id: string;
  key: string;
  db_column: string | null;
  label_key: string;
  field_type: FieldType;
  is_required: boolean;
  is_custom: boolean;
  sort_order: number;
  is_active: boolean;
  default_value?: string;
  placeholder?: string;
  validation?: ValidationRule;
  data_source?: DataSource;
  compute_expression?: string;
  auto_fill_from?: AutoFill;
  visible_when?: VisibleWhen;
}

export interface FormSectionConfig {
  id: string;
  key: string;
  title_key: string;
  description?: string;
  sort_order: number;
  is_collapsible: boolean;
  is_active: boolean;
  fields: FormFieldConfig[];
}

export interface FormRoleOverride {
  role: string;
  hidden_field_ids: string[];
  hidden_section_ids: string[];
  required_overrides: Record<string, boolean>;
}

export interface FormTemplateConfig {
  id: string;
  form_type: FormType;
  target_table: string;
  name: string;
  sections: FormSectionConfig[];
  role_overrides: FormRoleOverride[];
}

/** Maps FormType to the offline queue FormType string */
export const FORM_TYPE_TO_QUEUE_TYPE: Record<FormType, string> = {
  sewing_eod: "sewing_actuals",
  sewing_targets: "sewing_targets",
  finishing_eod: "finishing_actuals",
  finishing_targets: "finishing_targets",
  cutting_eod: "cutting_actuals",
  sewing_update: "production_updates_sewing",
  finishing_update: "finishing_actuals",
  report_blocker: "blockers",
};

/** Human-readable form names for the admin UI */
export const FORM_TYPE_LABELS: Record<FormType, string> = {
  sewing_eod: "Sewing End of Day",
  sewing_targets: "Sewing Morning Targets",
  finishing_eod: "Finishing End of Day",
  finishing_targets: "Finishing Morning Targets",
  cutting_eod: "Cutting End of Day",
  sewing_update: "Sewing Update",
  finishing_update: "Finishing Update",
  report_blocker: "Report Blocker",
};

/** All available field types for the admin builder */
export const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: "number", label: "Number" },
  { value: "text", label: "Text" },
  { value: "textarea", label: "Text Area" },
  { value: "select", label: "Dropdown" },
  { value: "searchable_select", label: "Searchable Dropdown" },
  { value: "date", label: "Date Picker" },
  { value: "file_upload", label: "File Upload" },
  { value: "toggle", label: "Toggle Switch" },
  { value: "readonly", label: "Read Only" },
  { value: "computed", label: "Computed" },
];

/** Database table type for form_templates rows */
export interface FormTemplateRow {
  id: string;
  factory_id: string | null;
  form_type: string;
  target_table: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Database table type for form_sections rows */
export interface FormSectionRow {
  id: string;
  template_id: string;
  key: string;
  title_key: string;
  description: string | null;
  sort_order: number;
  is_collapsible: boolean;
  is_active: boolean;
}

/** Database table type for form_fields rows */
export interface FormFieldRow {
  id: string;
  section_id: string;
  template_id: string;
  key: string;
  db_column: string | null;
  label_key: string;
  field_type: string;
  is_required: boolean;
  is_custom: boolean;
  sort_order: number;
  is_active: boolean;
  default_value: string | null;
  placeholder: string | null;
  validation: Record<string, unknown> | null;
  data_source: Record<string, unknown> | null;
  compute_expression: string | null;
  auto_fill_from: Record<string, unknown> | null;
  visible_when: Record<string, unknown> | null;
}

/** Database table type for form_role_overrides rows */
export interface FormRoleOverrideRow {
  id: string;
  template_id: string;
  role: string;
  hidden_field_ids: string[];
  hidden_section_ids: string[];
  required_overrides: Record<string, boolean>;
}
