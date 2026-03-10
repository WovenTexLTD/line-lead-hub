export type FormType = "sewing_target" | "sewing_actual" | "cutting_target" | "cutting_actual" | "finishing_target" | "finishing_actual";

export interface FormFieldConfig {
  key: string;
  label: string;
  label_key?: string;
  type: "text" | "number" | "dropdown" | "date" | "textarea";
  section?: string;
  required?: boolean;
  dropdownListId?: string;
  defaultValue?: string | number;
  data_source?: {
    type: "dropdown_list" | "static";
    list_id?: string;
  };
}
