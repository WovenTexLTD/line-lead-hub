/**
 * DynamicField renders a single form field based on its configuration.
 * Handles all field types: number, text, textarea, select, searchable_select,
 * date, file_upload, toggle, readonly, computed.
 */

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { Search, CalendarIcon, Upload, X } from "lucide-react";
import { format } from "date-fns";
import { getFilteredOptions } from "@/hooks/useFormMasterData";
import type { FormFieldConfig, DataSource } from "@/types/form-config";

interface DynamicFieldProps {
  field: FormFieldConfig;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
  error?: string;
  masterData: Record<string, Record<string, unknown>[]>;
  formValues: Record<string, unknown>;
}

function resolveLabel(labelKey: string, t: (key: string) => string): string {
  // If label_key looks like an i18n key (has dots), translate it
  if (labelKey.includes(".")) {
    const translated = t(labelKey);
    // If translation returns the key itself, it wasn't found — use raw
    return translated === labelKey ? labelKey : translated;
  }
  return labelKey;
}

export function DynamicField({
  field,
  value,
  onChange,
  error,
  masterData,
  formValues,
}: DynamicFieldProps) {
  const { t } = useTranslation();
  const label = resolveLabel(field.label_key, t);
  const requiredMark = field.is_required ? " *" : "";

  return (
    <div className="space-y-2">
      {field.field_type !== "toggle" && (
        <Label>
          {label}
          {requiredMark}
        </Label>
      )}

      <FieldInput
        field={field}
        value={value}
        onChange={onChange}
        masterData={masterData}
        formValues={formValues}
        label={label}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

/** Internal component that switches on field_type */
function FieldInput({
  field,
  value,
  onChange,
  masterData,
  formValues,
  label,
}: {
  field: FormFieldConfig;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
  masterData: Record<string, Record<string, unknown>[]>;
  formValues: Record<string, unknown>;
  label: string;
}) {
  switch (field.field_type) {
    case "number":
      return (
        <NumberField field={field} value={value} onChange={onChange} />
      );
    case "text":
      return (
        <Input
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(field.key, e.target.value)}
          placeholder={field.placeholder ?? ""}
          maxLength={field.validation?.max_length}
        />
      );
    case "textarea":
      return (
        <Textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(field.key, e.target.value)}
          placeholder={field.placeholder ?? ""}
          maxLength={field.validation?.max_length}
        />
      );
    case "select":
      return (
        <SelectField
          field={field}
          value={value}
          onChange={onChange}
          masterData={masterData}
          formValues={formValues}
        />
      );
    case "searchable_select":
      return (
        <SearchableSelectField
          field={field}
          value={value}
          onChange={onChange}
          masterData={masterData}
          formValues={formValues}
        />
      );
    case "date":
      return <DateField field={field} value={value} onChange={onChange} />;
    case "toggle":
      return (
        <div className="flex items-center space-x-2">
          <Switch
            checked={!!value}
            onCheckedChange={(checked) => onChange(field.key, checked)}
          />
          <Label>{label}</Label>
        </div>
      );
    case "file_upload":
      return <FileUploadField field={field} value={value} onChange={onChange} />;
    case "readonly":
      return (
        <Input
          type="text"
          value={String(value ?? "-")}
          disabled
          className="bg-muted"
        />
      );
    case "computed":
      return (
        <Input
          type="text"
          value={String(value ?? "0")}
          disabled
          className="bg-muted font-medium"
        />
      );
    default:
      return null;
  }
}

/** Number input with step/min/max from validation rules */
function NumberField({
  field,
  value,
  onChange,
}: {
  field: FormFieldConfig;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
}) {
  const v = field.validation;
  return (
    <Input
      type="number"
      value={value === undefined || value === null ? "" : String(value)}
      onChange={(e) => onChange(field.key, e.target.value)}
      placeholder={field.placeholder ?? ""}
      step={v?.step ?? (v?.integer ? 1 : "any")}
      min={v?.min}
      max={v?.max}
      inputMode={v?.integer ? "numeric" : "decimal"}
    />
  );
}

/** Standard dropdown select */
function SelectField({
  field,
  value,
  onChange,
  masterData,
  formValues,
}: {
  field: FormFieldConfig;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
  masterData: Record<string, Record<string, unknown>[]>;
  formValues: Record<string, unknown>;
}) {
  const ds = field.data_source;
  const options = ds
    ? getFilteredOptions(masterData, ds, formValues)
    : [];

  return (
    <Select
      value={(value as string) ?? ""}
      onValueChange={(v) => onChange(field.key, v)}
    >
      <SelectTrigger>
        <SelectValue placeholder={field.placeholder ?? "Select..."} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => {
          const optValue = String(opt[ds?.value_column ?? "id"] ?? "");
          const optLabel = String(opt[ds?.label_column ?? "name"] ?? "");
          return (
            <SelectItem key={optValue} value={optValue}>
              {optLabel}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

/** Searchable dropdown using Popover + Command */
function SearchableSelectField({
  field,
  value,
  onChange,
  masterData,
  formValues,
}: {
  field: FormFieldConfig;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
  masterData: Record<string, Record<string, unknown>[]>;
  formValues: Record<string, unknown>;
}) {
  const [open, setOpen] = useState(false);
  const ds = field.data_source;
  const options = ds
    ? getFilteredOptions(masterData, ds, formValues)
    : [];

  const selectedOption = useMemo(() => {
    if (!value || !ds) return null;
    return options.find(
      (opt) => String(opt[ds.value_column]) === String(value)
    );
  }, [value, options, ds]);

  const displayValue = selectedOption
    ? buildDisplayString(selectedOption, ds!)
    : field.placeholder ?? "Search...";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-start"
        >
          <Search className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">{displayValue}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <Command shouldFilter={true}>
          <CommandInput placeholder={field.placeholder ?? "Search..."} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const optValue = String(opt[ds?.value_column ?? "id"] ?? "");
                return (
                  <CommandItem
                    key={optValue}
                    value={buildSearchValue(opt, ds!)}
                    onSelect={() => {
                      onChange(field.key, optValue);
                      setOpen(false);
                    }}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {buildDisplayString(opt, ds!)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {buildSecondaryString(opt, ds!)}
                      </span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Build display strings for searchable selects */
function buildDisplayString(
  item: Record<string, unknown>,
  ds: DataSource
): string {
  const label = String(item[ds.label_column] ?? "");
  // For work_orders, show "PO - Style"
  if (ds.table === "work_orders") {
    const style = item.style ? ` - ${item.style}` : "";
    return `${label}${style}`;
  }
  return label;
}

function buildSecondaryString(
  item: Record<string, unknown>,
  ds: DataSource
): string {
  if (ds.table === "work_orders") {
    const buyer = item.buyer ?? "";
    const itemName = item.item ? ` / ${item.item}` : "";
    return `${buyer}${itemName}`;
  }
  return "";
}

function buildSearchValue(
  item: Record<string, unknown>,
  ds: DataSource
): string {
  if (ds.table === "work_orders") {
    return `${item.po_number ?? ""} ${item.buyer ?? ""} ${item.style ?? ""} ${item.item ?? ""}`;
  }
  return String(item[ds.label_column] ?? "");
}

/** Date picker using Popover + Calendar */
function DateField({
  field,
  value,
  onChange,
}: {
  field: FormFieldConfig;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
}) {
  const dateValue = value ? new Date(value as string) : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start text-left font-normal"
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {dateValue ? format(dateValue, "PPP") : field.placeholder ?? "Pick a date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={(date) => {
            if (date) {
              onChange(field.key, format(date, "yyyy-MM-dd"));
            }
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

/** File upload with preview */
function FileUploadField({
  field,
  value,
  onChange,
}: {
  field: FormFieldConfig;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
}) {
  const files = (value as File[]) ?? [];
  const maxFiles = field.validation?.max ? field.validation.max : 2;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const combined = [...files, ...selected].slice(0, maxFiles);
    onChange(field.key, combined);
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    onChange(field.key, updated);
  };

  return (
    <div className="space-y-2">
      {files.length < maxFiles && (
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground hover:border-primary">
          <Upload className="h-4 w-4" />
          <span>Upload file{maxFiles > 1 ? "s" : ""} (max {maxFiles})</span>
          <input
            type="file"
            accept="image/*"
            multiple={maxFiles > 1}
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      )}
      {files.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {files.map((file, i) => (
            <div key={i} className="relative">
              <img
                src={URL.createObjectURL(file)}
                alt={`Upload ${i + 1}`}
                className="h-16 w-16 rounded-md object-cover"
              />
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
