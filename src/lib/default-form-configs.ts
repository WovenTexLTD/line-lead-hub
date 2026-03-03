/**
 * Default form configurations for all 8 form types.
 * These serve as:
 * 1. System defaults (factory_id = null) seeded into the database
 * 2. Fallback if a factory has no custom config
 * 3. Reference for the admin Form Builder
 *
 * Each config mirrors the exact fields of its corresponding hardcoded form.
 */

import type { FormTemplateConfig, FormSectionConfig } from "@/types/form-config";

// Helper to generate stable IDs for default configs
let idCounter = 0;
function uid(prefix: string): string {
  return `default-${prefix}-${++idCounter}`;
}

// Reset counter for each call (idempotent)
function resetIds() {
  idCounter = 0;
}

// ─── Common Sections (shared across multiple forms) ───

function linePoSection(templateId: string): FormSectionConfig {
  const sectionId = uid("section-line-po");
  return {
    id: sectionId,
    key: "line_po_selection",
    title_key: "forms.selectLinePO",
    sort_order: 0,
    is_collapsible: false,
    is_active: true,
    fields: [
      {
        id: uid("field"),
        key: "line_id",
        db_column: "line_id",
        label_key: "forms.lineNo",
        field_type: "select",
        is_required: true,
        is_custom: false,
        sort_order: 0,
        is_active: true,
        data_source: {
          table: "lines",
          value_column: "id",
          label_column: "name",
          filters: { is_active: true },
          order_by: "line_id",
        },
      },
      {
        id: uid("field"),
        key: "work_order_id",
        db_column: "work_order_id",
        label_key: "forms.poNumber",
        field_type: "searchable_select",
        is_required: true,
        is_custom: false,
        sort_order: 1,
        is_active: true,
        placeholder: "Search PO...",
        data_source: {
          table: "work_orders",
          value_column: "id",
          label_column: "po_number",
          filters: { is_active: true },
          order_by: "po_number",
          depends_on: "line_id",
        },
      },
    ],
  };
}

function orderDetailsSection(templateId: string): FormSectionConfig {
  const sectionId = uid("section-order-details");
  return {
    id: sectionId,
    key: "order_details",
    title_key: "forms.orderDetailsAuto",
    sort_order: 1,
    is_collapsible: false,
    is_active: true,
    fields: [
      {
        id: uid("field"),
        key: "buyer_name",
        db_column: "buyer_name",
        label_key: "forms.buyer",
        field_type: "readonly",
        is_required: false,
        is_custom: false,
        sort_order: 0,
        is_active: true,
        auto_fill_from: { source_field: "work_order_id", source_table: "work_orders", source_column: "buyer" },
      },
      {
        id: uid("field"),
        key: "style_code",
        db_column: "style_code",
        label_key: "forms.style",
        field_type: "readonly",
        is_required: false,
        is_custom: false,
        sort_order: 1,
        is_active: true,
        auto_fill_from: { source_field: "work_order_id", source_table: "work_orders", source_column: "style" },
      },
      {
        id: uid("field"),
        key: "item_name",
        db_column: "item_name",
        label_key: "forms.item",
        field_type: "readonly",
        is_required: false,
        is_custom: false,
        sort_order: 2,
        is_active: true,
        auto_fill_from: { source_field: "work_order_id", source_table: "work_orders", source_column: "item" },
      },
      {
        id: uid("field"),
        key: "order_qty",
        db_column: "order_qty",
        label_key: "forms.orderQty",
        field_type: "readonly",
        is_required: false,
        is_custom: false,
        sort_order: 3,
        is_active: true,
        auto_fill_from: { source_field: "work_order_id", source_table: "work_orders", source_column: "order_qty" },
      },
      {
        id: uid("field"),
        key: "unit_name",
        db_column: "unit_name",
        label_key: "forms.unit",
        field_type: "readonly",
        is_required: false,
        is_custom: false,
        sort_order: 4,
        is_active: true,
        auto_fill_from: { source_field: "line_id", source_table: "units", source_column: "name" },
      },
      {
        id: uid("field"),
        key: "floor_name",
        db_column: "floor_name",
        label_key: "forms.floor",
        field_type: "readonly",
        is_required: false,
        is_custom: false,
        sort_order: 5,
        is_active: true,
        auto_fill_from: { source_field: "line_id", source_table: "floors", source_column: "name" },
      },
    ],
  };
}

function remarksSection(templateId: string): FormSectionConfig {
  return {
    id: uid("section-remarks"),
    key: "remarks",
    title_key: "forms.optional",
    sort_order: 99,
    is_collapsible: false,
    is_active: true,
    fields: [
      {
        id: uid("field"),
        key: "remarks",
        db_column: "remarks",
        label_key: "forms.remarks",
        field_type: "textarea",
        is_required: false,
        is_custom: false,
        sort_order: 0,
        is_active: true,
        placeholder: "Any additional notes...",
      },
    ],
  };
}

// ─── 1. Sewing End of Day ───

function sewingEodConfig(): FormTemplateConfig {
  const id = uid("template");
  return {
    id,
    form_type: "sewing_eod",
    target_table: "sewing_actuals",
    name: "Sewing End of Day",
    sections: [
      linePoSection(id),
      orderDetailsSection(id),
      {
        id: uid("section"),
        key: "actual_output",
        title_key: "forms.actualOutput",
        sort_order: 2,
        is_collapsible: false,
        is_active: true,
        fields: [
          { id: uid("f"), key: "good_today", db_column: "good_today", label_key: "forms.goodOutput", field_type: "number", is_required: true, is_custom: false, sort_order: 0, is_active: true, validation: { integer: true, min: 0 } },
          { id: uid("f"), key: "reject_today", db_column: "reject_today", label_key: "forms.reject", field_type: "number", is_required: true, is_custom: false, sort_order: 1, is_active: true, validation: { integer: true, min: 0 } },
          { id: uid("f"), key: "rework_today", db_column: "rework_today", label_key: "forms.rework", field_type: "number", is_required: true, is_custom: false, sort_order: 2, is_active: true, validation: { integer: true, min: 0 } },
          { id: uid("f"), key: "cumulative_good_total", db_column: "cumulative_good_total", label_key: "forms.cumulativeGoodTotal", field_type: "number", is_required: true, is_custom: false, sort_order: 3, is_active: true, validation: { integer: true, min: 0 } },
          { id: uid("f"), key: "manpower_actual", db_column: "manpower_actual", label_key: "forms.manpowerActual", field_type: "number", is_required: true, is_custom: false, sort_order: 4, is_active: true, validation: { integer: true, min: 1 } },
          { id: uid("f"), key: "hours_actual", db_column: "hours_actual", label_key: "forms.hoursActual", field_type: "number", is_required: true, is_custom: false, sort_order: 5, is_active: true, validation: { min: 0.5, max: 24, step: 0.5 } },
          { id: uid("f"), key: "ot_hours_actual", db_column: "ot_hours_actual", label_key: "forms.otHoursActual", field_type: "number", is_required: false, is_custom: false, sort_order: 6, is_active: true, default_value: "0", validation: { min: 0, step: 0.5 } },
          { id: uid("f"), key: "actual_per_hour", db_column: "actual_per_hour", label_key: "forms.actualPerHour", field_type: "computed", is_required: false, is_custom: false, sort_order: 7, is_active: true, compute_expression: "round(good_today / hours_actual)" },
        ],
      },
      {
        id: uid("section"),
        key: "stage_progress",
        title_key: "forms.stageProgress",
        sort_order: 3,
        is_collapsible: false,
        is_active: true,
        fields: [
          { id: uid("f"), key: "actual_stage_id", db_column: "actual_stage_id", label_key: "forms.actualStage", field_type: "select", is_required: true, is_custom: false, sort_order: 0, is_active: true, data_source: { table: "stages", value_column: "id", label_column: "name", filters: { is_active: true }, order_by: "sequence" } },
          { id: uid("f"), key: "actual_stage_progress", db_column: "actual_stage_progress", label_key: "forms.stageProgressLabel", field_type: "select", is_required: true, is_custom: false, sort_order: 1, is_active: true, data_source: { table: "stage_progress_options", value_column: "label", label_column: "label", filters: { is_active: true }, order_by: "sort_order" } },
        ],
      },
      remarksSection(id),
    ],
    role_overrides: [],
  };
}

// ─── 2. Sewing Morning Targets ───

function sewingTargetsConfig(): FormTemplateConfig {
  const id = uid("template");
  return {
    id,
    form_type: "sewing_targets",
    target_table: "sewing_targets",
    name: "Sewing Morning Targets",
    sections: [
      linePoSection(id),
      orderDetailsSection(id),
      {
        id: uid("section"),
        key: "todays_targets",
        title_key: "forms.todaysTargets",
        sort_order: 2,
        is_collapsible: false,
        is_active: true,
        fields: [
          { id: uid("f"), key: "per_hour_target", db_column: "per_hour_target", label_key: "forms.perHourTarget", field_type: "number", is_required: true, is_custom: false, sort_order: 0, is_active: true, validation: { integer: true, min: 1 } },
          { id: uid("f"), key: "manpower_planned", db_column: "manpower_planned", label_key: "forms.manpowerPlanned", field_type: "number", is_required: true, is_custom: false, sort_order: 1, is_active: true, validation: { integer: true, min: 1 } },
          { id: uid("f"), key: "hours_planned", db_column: "hours_planned", label_key: "forms.hoursPlanned", field_type: "number", is_required: true, is_custom: false, sort_order: 2, is_active: true, validation: { min: 0.5, max: 24, step: 0.5 } },
          { id: uid("f"), key: "ot_hours_planned", db_column: "ot_hours_planned", label_key: "forms.otHoursPlanned", field_type: "number", is_required: false, is_custom: false, sort_order: 3, is_active: true, default_value: "0", validation: { min: 0, step: 0.5 } },
          { id: uid("f"), key: "target_total_planned", db_column: null, label_key: "forms.targetTotalPlanned", field_type: "computed", is_required: false, is_custom: false, sort_order: 4, is_active: true, compute_expression: "round(per_hour_target * hours_planned)" },
        ],
      },
      {
        id: uid("section"),
        key: "stage_progress",
        title_key: "forms.stageProgress",
        sort_order: 3,
        is_collapsible: false,
        is_active: true,
        fields: [
          { id: uid("f"), key: "planned_stage_id", db_column: "planned_stage_id", label_key: "forms.plannedStage", field_type: "select", is_required: true, is_custom: false, sort_order: 0, is_active: true, data_source: { table: "stages", value_column: "id", label_column: "name", filters: { is_active: true }, order_by: "sequence" } },
          { id: uid("f"), key: "planned_stage_progress", db_column: "planned_stage_progress", label_key: "forms.stageProgressLabel", field_type: "select", is_required: true, is_custom: false, sort_order: 1, is_active: true, data_source: { table: "stage_progress_options", value_column: "label", label_column: "label", filters: { is_active: true }, order_by: "sort_order" } },
          { id: uid("f"), key: "next_milestone", db_column: "next_milestone", label_key: "forms.nextMilestone", field_type: "select", is_required: true, is_custom: false, sort_order: 2, is_active: true, data_source: { table: "next_milestone_options", value_column: "label", label_column: "label", filters: { is_active: true }, order_by: "sort_order" } },
          { id: uid("f"), key: "estimated_ex_factory", db_column: "estimated_ex_factory", label_key: "forms.estimatedExFactory", field_type: "date", is_required: false, is_custom: false, sort_order: 3, is_active: true },
        ],
      },
      remarksSection(id),
    ],
    role_overrides: [],
  };
}

// ─── 3. Finishing End of Day ───

function finishingEodConfig(): FormTemplateConfig {
  const id = uid("template");
  return {
    id,
    form_type: "finishing_eod",
    target_table: "finishing_actuals",
    name: "Finishing End of Day",
    sections: [
      linePoSection(id),
      orderDetailsSection(id),
      {
        id: uid("section"),
        key: "qc_production",
        title_key: "forms.qcProduction",
        sort_order: 2,
        is_collapsible: false,
        is_active: true,
        fields: [
          { id: uid("f"), key: "day_qc_pass", db_column: "day_qc_pass", label_key: "finishing.dayQcPass", field_type: "number", is_required: true, is_custom: false, sort_order: 0, is_active: true, validation: { integer: true, min: 0 } },
          { id: uid("f"), key: "total_qc_pass", db_column: "total_qc_pass", label_key: "finishing.totalQcPass", field_type: "number", is_required: true, is_custom: false, sort_order: 1, is_active: true, validation: { integer: true, min: 0 } },
          { id: uid("f"), key: "day_poly", db_column: "day_poly", label_key: "finishing.dayPoly", field_type: "number", is_required: true, is_custom: false, sort_order: 2, is_active: true, validation: { integer: true, min: 0 } },
          { id: uid("f"), key: "total_poly", db_column: "total_poly", label_key: "finishing.totalPoly", field_type: "number", is_required: true, is_custom: false, sort_order: 3, is_active: true, validation: { integer: true, min: 0 } },
          { id: uid("f"), key: "day_carton", db_column: "day_carton", label_key: "finishing.dayCarton", field_type: "number", is_required: true, is_custom: false, sort_order: 4, is_active: true, validation: { integer: true, min: 0 } },
          { id: uid("f"), key: "total_carton", db_column: "total_carton", label_key: "finishing.totalCarton", field_type: "number", is_required: true, is_custom: false, sort_order: 5, is_active: true, validation: { integer: true, min: 0 } },
          { id: uid("f"), key: "average_production", db_column: "average_production", label_key: "finishing.averageProduction", field_type: "number", is_required: false, is_custom: false, sort_order: 6, is_active: true, default_value: "0", validation: { integer: true, min: 0 } },
        ],
      },
      {
        id: uid("section"),
        key: "manpower_hours",
        title_key: "forms.manpowerHours",
        sort_order: 3,
        is_collapsible: false,
        is_active: true,
        fields: [
          { id: uid("f"), key: "m_power_actual", db_column: "m_power_actual", label_key: "finishing.mPowerActual", field_type: "number", is_required: true, is_custom: false, sort_order: 0, is_active: true, validation: { integer: true, min: 1 } },
          { id: uid("f"), key: "ot_manpower_actual", db_column: "ot_manpower_actual", label_key: "finishing.otManpowerActual", field_type: "number", is_required: false, is_custom: false, sort_order: 1, is_active: true, default_value: "0", validation: { integer: true, min: 0 } },
          { id: uid("f"), key: "day_hour_actual", db_column: "day_hour_actual", label_key: "finishing.dayHourActual", field_type: "number", is_required: true, is_custom: false, sort_order: 2, is_active: true, validation: { min: 0, step: 0.5 } },
          { id: uid("f"), key: "day_over_time_actual", db_column: "day_over_time_actual", label_key: "finishing.dayOverTimeActual", field_type: "number", is_required: true, is_custom: false, sort_order: 3, is_active: true, validation: { min: 0, step: 0.5 } },
          { id: uid("f"), key: "total_hour", db_column: "total_hour", label_key: "finishing.totalHour", field_type: "number", is_required: false, is_custom: false, sort_order: 4, is_active: true, default_value: "0", validation: { min: 0, step: 0.5 } },
          { id: uid("f"), key: "total_over_time", db_column: "total_over_time", label_key: "finishing.totalOverTime", field_type: "number", is_required: false, is_custom: false, sort_order: 5, is_active: true, default_value: "0", validation: { min: 0, step: 0.5 } },
        ],
      },
      remarksSection(id),
    ],
    role_overrides: [],
  };
}

// ─── 4. Finishing Morning Targets ───

function finishingTargetsConfig(): FormTemplateConfig {
  const id = uid("template");
  return {
    id,
    form_type: "finishing_targets",
    target_table: "finishing_targets",
    name: "Finishing Morning Targets",
    sections: [
      linePoSection(id),
      orderDetailsSection(id),
      {
        id: uid("section"),
        key: "todays_targets",
        title_key: "forms.todaysTargets",
        sort_order: 2,
        is_collapsible: false,
        is_active: true,
        fields: [
          { id: uid("f"), key: "per_hour_target", db_column: "per_hour_target", label_key: "forms.perHourTarget", field_type: "number", is_required: true, is_custom: false, sort_order: 0, is_active: true, validation: { integer: true, min: 1 } },
          { id: uid("f"), key: "m_power_planned", db_column: "m_power_planned", label_key: "finishing.mPowerPlanned", field_type: "number", is_required: true, is_custom: false, sort_order: 1, is_active: true, validation: { integer: true, min: 1 } },
          { id: uid("f"), key: "day_hour_planned", db_column: "day_hour_planned", label_key: "finishing.dayHourPlanned", field_type: "number", is_required: true, is_custom: false, sort_order: 2, is_active: true, validation: { min: 0, step: 0.5 } },
          { id: uid("f"), key: "day_over_time_planned", db_column: "day_over_time_planned", label_key: "finishing.dayOverTimePlanned", field_type: "number", is_required: true, is_custom: false, sort_order: 3, is_active: true, validation: { min: 0, step: 0.5 } },
          { id: uid("f"), key: "ot_manpower_planned", db_column: "ot_manpower_planned", label_key: "finishing.otManpowerPlanned", field_type: "number", is_required: false, is_custom: false, sort_order: 4, is_active: true, default_value: "0", validation: { integer: true, min: 0 } },
        ],
      },
      remarksSection(id),
    ],
    role_overrides: [],
  };
}

// ─── 5. Cutting End of Day ───

function cuttingEodConfig(): FormTemplateConfig {
  const id = uid("template");
  return {
    id,
    form_type: "cutting_eod",
    target_table: "cutting_actuals",
    name: "Cutting End of Day",
    sections: [
      linePoSection(id),
      orderDetailsSection(id),
      {
        id: uid("section"),
        key: "actual_capacities",
        title_key: "cutting.actualCapacities",
        sort_order: 2,
        is_collapsible: false,
        is_active: true,
        fields: [
          { id: uid("f"), key: "man_power", db_column: "man_power", label_key: "cutting.manPower", field_type: "number", is_required: true, is_custom: false, sort_order: 0, is_active: true, validation: { integer: true, min: 0 } },
          { id: uid("f"), key: "marker_capacity", db_column: "marker_capacity", label_key: "cutting.markerCapacity", field_type: "number", is_required: true, is_custom: false, sort_order: 1, is_active: true, validation: { integer: true, min: 0 } },
          { id: uid("f"), key: "lay_capacity", db_column: "lay_capacity", label_key: "cutting.layCapacity", field_type: "number", is_required: true, is_custom: false, sort_order: 2, is_active: true, validation: { integer: true, min: 0 } },
          { id: uid("f"), key: "cutting_capacity", db_column: "cutting_capacity", label_key: "cutting.cuttingCapacity", field_type: "number", is_required: true, is_custom: false, sort_order: 3, is_active: true, validation: { integer: true, min: 0 } },
          { id: uid("f"), key: "under_qty", db_column: "under_qty", label_key: "cutting.underQty", field_type: "number", is_required: false, is_custom: false, sort_order: 4, is_active: true, default_value: "0", validation: { integer: true, min: 0 } },
          { id: uid("f"), key: "hours_actual", db_column: "hours_actual", label_key: "cutting.hoursActual", field_type: "number", is_required: true, is_custom: false, sort_order: 5, is_active: true, validation: { min: 0.5, max: 24, step: 0.5 } },
          { id: uid("f"), key: "ot_hours_actual", db_column: "ot_hours_actual", label_key: "cutting.otHoursActual", field_type: "number", is_required: false, is_custom: false, sort_order: 6, is_active: true, default_value: "0", validation: { min: 0, step: 0.5 } },
          { id: uid("f"), key: "ot_manpower_actual", db_column: "ot_manpower_actual", label_key: "cutting.otManpowerActual", field_type: "number", is_required: false, is_custom: false, sort_order: 7, is_active: true, default_value: "0", validation: { integer: true, min: 0 } },
        ],
      },
      {
        id: uid("section"),
        key: "daily_output",
        title_key: "cutting.dailyActuals",
        sort_order: 3,
        is_collapsible: false,
        is_active: true,
        fields: [
          { id: uid("f"), key: "day_cutting", db_column: "day_cutting", label_key: "cutting.dayCutting", field_type: "number", is_required: true, is_custom: false, sort_order: 0, is_active: true, validation: { integer: true, min: 0 } },
          { id: uid("f"), key: "day_input", db_column: "day_input", label_key: "cutting.dayInput", field_type: "number", is_required: true, is_custom: false, sort_order: 1, is_active: true, validation: { integer: true, min: 0 } },
          { id: uid("f"), key: "actual_per_hour", db_column: "actual_per_hour", label_key: "forms.actualPerHour", field_type: "computed", is_required: false, is_custom: false, sort_order: 2, is_active: true, compute_expression: "round(day_cutting / hours_actual)" },
        ],
      },
      {
        id: uid("section"),
        key: "cumulative_totals",
        title_key: "cutting.cumulativeTotals",
        sort_order: 4,
        is_collapsible: false,
        is_active: true,
        fields: [
          { id: uid("f"), key: "total_cutting", db_column: "total_cutting", label_key: "cutting.totalCutting", field_type: "readonly", is_required: false, is_custom: false, sort_order: 0, is_active: true },
          { id: uid("f"), key: "total_input", db_column: "total_input", label_key: "cutting.totalInput", field_type: "readonly", is_required: false, is_custom: false, sort_order: 1, is_active: true },
          { id: uid("f"), key: "balance", db_column: "balance", label_key: "cutting.balance", field_type: "readonly", is_required: false, is_custom: false, sort_order: 2, is_active: true },
        ],
      },
      {
        id: uid("section"),
        key: "leftover",
        title_key: "cutting.leftoverFabric",
        sort_order: 5,
        is_collapsible: true,
        is_active: true,
        fields: [
          { id: uid("f"), key: "leftover_recorded", db_column: "leftover_recorded", label_key: "cutting.leftoverRecorded", field_type: "toggle", is_required: false, is_custom: false, sort_order: 0, is_active: true, default_value: "false" },
          { id: uid("f"), key: "leftover_type", db_column: "leftover_type", label_key: "cutting.leftoverType", field_type: "select", is_required: false, is_custom: false, sort_order: 1, is_active: true, visible_when: { field: "leftover_recorded", equals: true }, data_source: { table: "_static_leftover_types", value_column: "value", label_column: "label" } },
          { id: uid("f"), key: "leftover_unit", db_column: "leftover_unit", label_key: "cutting.leftoverUnit", field_type: "select", is_required: false, is_custom: false, sort_order: 2, is_active: true, visible_when: { field: "leftover_recorded", equals: true }, data_source: { table: "_static_leftover_units", value_column: "value", label_column: "label" } },
          { id: uid("f"), key: "leftover_quantity", db_column: "leftover_quantity", label_key: "cutting.leftoverQuantity", field_type: "number", is_required: false, is_custom: false, sort_order: 3, is_active: true, visible_when: { field: "leftover_recorded", equals: true }, validation: { min: 0, step: 0.01 } },
          { id: uid("f"), key: "leftover_location", db_column: "leftover_location", label_key: "cutting.leftoverLocation", field_type: "text", is_required: false, is_custom: false, sort_order: 4, is_active: true, visible_when: { field: "leftover_recorded", equals: true } },
          { id: uid("f"), key: "leftover_notes", db_column: "leftover_notes", label_key: "cutting.leftoverNotes", field_type: "textarea", is_required: false, is_custom: false, sort_order: 5, is_active: true, visible_when: { field: "leftover_recorded", equals: true } },
        ],
      },
    ],
    role_overrides: [],
  };
}

// ─── 6. Sewing Update ───

function sewingUpdateConfig(): FormTemplateConfig {
  const id = uid("template");
  return {
    id,
    form_type: "sewing_update",
    target_table: "production_updates_sewing",
    name: "Sewing Update",
    sections: [
      linePoSection(id),
      orderDetailsSection(id),
      {
        id: uid("section"),
        key: "production_numbers",
        title_key: "forms.productionNumbers",
        sort_order: 2,
        is_collapsible: false,
        is_active: true,
        fields: [
          { id: uid("f"), key: "per_hour_target", db_column: "per_hour_target", label_key: "forms.perHourTarget", field_type: "number", is_required: true, is_custom: false, sort_order: 0, is_active: true, validation: { integer: true, min: 0 } },
          { id: uid("f"), key: "output_qty", db_column: "output_qty", label_key: "forms.dayProduction", field_type: "number", is_required: true, is_custom: false, sort_order: 1, is_active: true, validation: { integer: true, min: 0 } },
          { id: uid("f"), key: "reject_qty", db_column: "reject_qty", label_key: "forms.rejectToday", field_type: "number", is_required: true, is_custom: false, sort_order: 2, is_active: true, validation: { integer: true, min: 0 } },
          { id: uid("f"), key: "rework_qty", db_column: "rework_qty", label_key: "forms.reworkToday", field_type: "number", is_required: true, is_custom: false, sort_order: 3, is_active: true, validation: { integer: true, min: 0 } },
          { id: uid("f"), key: "cumulative_good_total", db_column: "cumulative_good_total", label_key: "forms.totalProduction", field_type: "number", is_required: true, is_custom: false, sort_order: 4, is_active: true, validation: { integer: true, min: 0 } },
          { id: uid("f"), key: "ot_hours", db_column: "ot_hours", label_key: "cutting.otHours", field_type: "number", is_required: true, is_custom: false, sort_order: 5, is_active: true, validation: { min: 0, step: 0.5 } },
          { id: uid("f"), key: "manpower", db_column: "manpower", label_key: "cutting.manPower", field_type: "number", is_required: true, is_custom: false, sort_order: 6, is_active: true, validation: { integer: true, min: 0 } },
        ],
      },
      {
        id: uid("section"),
        key: "tracking",
        title_key: "forms.tracking",
        sort_order: 3,
        is_collapsible: false,
        is_active: true,
        fields: [
          { id: uid("f"), key: "stage_id", db_column: "stage_id", label_key: "forms.currentStage", field_type: "select", is_required: true, is_custom: false, sort_order: 0, is_active: true, data_source: { table: "stages", value_column: "id", label_column: "name", filters: { is_active: true }, order_by: "sequence" } },
          { id: uid("f"), key: "stage_progress", db_column: "stage_progress", label_key: "forms.stageProgressLabel", field_type: "select", is_required: true, is_custom: false, sort_order: 1, is_active: true, data_source: { table: "stage_progress_options", value_column: "label", label_column: "label", filters: { is_active: true }, order_by: "sort_order" } },
          { id: uid("f"), key: "estimated_ex_factory", db_column: "estimated_ex_factory", label_key: "forms.estimatedExFactory", field_type: "date", is_required: false, is_custom: false, sort_order: 2, is_active: true },
          { id: uid("f"), key: "next_milestone", db_column: "next_milestone", label_key: "forms.nextMilestone", field_type: "select", is_required: true, is_custom: false, sort_order: 3, is_active: true, data_source: { table: "next_milestone_options", value_column: "label", label_column: "label", filters: { is_active: true }, order_by: "sort_order" } },
        ],
      },
      {
        id: uid("section"),
        key: "photos_notes",
        title_key: "forms.photosNotes",
        sort_order: 4,
        is_collapsible: false,
        is_active: true,
        fields: [
          { id: uid("f"), key: "photos", db_column: null, label_key: "forms.photos", field_type: "file_upload", is_required: false, is_custom: false, sort_order: 0, is_active: true, validation: { max: 2 } },
          { id: uid("f"), key: "notes", db_column: "notes", label_key: "forms.remarks", field_type: "textarea", is_required: false, is_custom: false, sort_order: 1, is_active: true },
        ],
      },
    ],
    role_overrides: [],
  };
}

// ─── 7. Finishing Update ───

function finishingUpdateConfig(): FormTemplateConfig {
  const id = uid("template");
  return {
    id,
    form_type: "finishing_update",
    target_table: "finishing_actuals",
    name: "Finishing Update",
    sections: [
      linePoSection(id),
      orderDetailsSection(id),
      {
        id: uid("section"),
        key: "finishing_metrics",
        title_key: "forms.finishingMetrics",
        sort_order: 2,
        is_collapsible: false,
        is_active: true,
        fields: [
          { id: uid("f"), key: "m_power_actual", db_column: "m_power_actual", label_key: "finishing.mPowerActual", field_type: "number", is_required: true, is_custom: false, sort_order: 0, is_active: true, validation: { integer: true, min: 0 } },
          { id: uid("f"), key: "per_hour_target", db_column: "per_hour_target", label_key: "forms.perHourTarget", field_type: "number", is_required: true, is_custom: false, sort_order: 1, is_active: true, validation: { integer: true, min: 0 } },
          { id: uid("f"), key: "day_qc_pass", db_column: "day_qc_pass", label_key: "finishing.dayQcPass", field_type: "number", is_required: true, is_custom: false, sort_order: 2, is_active: true, validation: { integer: true, min: 0 } },
          { id: uid("f"), key: "total_qc_pass", db_column: "total_qc_pass", label_key: "finishing.totalQcPass", field_type: "number", is_required: true, is_custom: false, sort_order: 3, is_active: true, validation: { integer: true, min: 0 } },
          { id: uid("f"), key: "day_poly", db_column: "day_poly", label_key: "finishing.dayPoly", field_type: "number", is_required: true, is_custom: false, sort_order: 4, is_active: true, validation: { integer: true, min: 0 } },
          { id: uid("f"), key: "total_poly", db_column: "total_poly", label_key: "finishing.totalPoly", field_type: "number", is_required: true, is_custom: false, sort_order: 5, is_active: true, validation: { integer: true, min: 0 } },
          { id: uid("f"), key: "average_production", db_column: "average_production", label_key: "finishing.averageProduction", field_type: "number", is_required: false, is_custom: false, sort_order: 6, is_active: true, default_value: "0", validation: { integer: true, min: 0 } },
          { id: uid("f"), key: "day_over_time_actual", db_column: "day_over_time_actual", label_key: "finishing.dayOverTimeActual", field_type: "number", is_required: true, is_custom: false, sort_order: 7, is_active: true, validation: { min: 0, max: 24 } },
          { id: uid("f"), key: "total_over_time", db_column: "total_over_time", label_key: "finishing.totalOverTime", field_type: "number", is_required: true, is_custom: false, sort_order: 8, is_active: true, validation: { min: 0 } },
          { id: uid("f"), key: "day_hour_actual", db_column: "day_hour_actual", label_key: "finishing.dayHourActual", field_type: "number", is_required: true, is_custom: false, sort_order: 9, is_active: true, validation: { min: 0, max: 24 } },
          { id: uid("f"), key: "total_hour", db_column: "total_hour", label_key: "finishing.totalHour", field_type: "number", is_required: true, is_custom: false, sort_order: 10, is_active: true, validation: { min: 0 } },
          { id: uid("f"), key: "day_carton", db_column: "day_carton", label_key: "finishing.dayCarton", field_type: "number", is_required: true, is_custom: false, sort_order: 11, is_active: true, validation: { integer: true, min: 0 } },
          { id: uid("f"), key: "total_carton", db_column: "total_carton", label_key: "finishing.totalCarton", field_type: "number", is_required: true, is_custom: false, sort_order: 12, is_active: true, validation: { integer: true, min: 0 } },
        ],
      },
      remarksSection(id),
    ],
    role_overrides: [],
  };
}

// ─── 8. Report Blocker ───

function reportBlockerConfig(): FormTemplateConfig {
  const id = uid("template");
  return {
    id,
    form_type: "report_blocker",
    target_table: "blockers",
    name: "Report Blocker",
    sections: [
      {
        id: uid("section"),
        key: "line_po_selection",
        title_key: "forms.selectLinePO",
        sort_order: 0,
        is_collapsible: false,
        is_active: true,
        fields: [
          {
            id: uid("f"),
            key: "line_id",
            db_column: "line_id",
            label_key: "forms.lineNo",
            field_type: "select",
            is_required: false,
            is_custom: false,
            sort_order: 0,
            is_active: true,
            data_source: {
              table: "lines",
              value_column: "id",
              label_column: "name",
              filters: { is_active: true },
              order_by: "line_id",
            },
          },
          {
            id: uid("f"),
            key: "work_order_id",
            db_column: "work_order_id",
            label_key: "forms.poNumber",
            field_type: "searchable_select",
            is_required: true,
            is_custom: false,
            sort_order: 1,
            is_active: true,
            placeholder: "Search PO...",
            data_source: {
              table: "work_orders",
              value_column: "id",
              label_column: "po_number",
              filters: { is_active: true },
              order_by: "po_number",
              depends_on: "line_id",
            },
          },
        ],
      },
      {
        id: uid("section"),
        key: "blocker_details",
        title_key: "blockers.blockerDetails",
        sort_order: 1,
        is_collapsible: false,
        is_active: true,
        fields: [
          { id: uid("f"), key: "blocker_type_id", db_column: "blocker_type_id", label_key: "blockers.blockerType", field_type: "select", is_required: true, is_custom: false, sort_order: 0, is_active: true, data_source: { table: "blocker_types", value_column: "id", label_column: "name", filters: { is_active: true }, order_by: "sort_order" } },
          { id: uid("f"), key: "blocker_owner", db_column: "blocker_owner", label_key: "blockers.blockerOwner", field_type: "select", is_required: true, is_custom: false, sort_order: 1, is_active: true, data_source: { table: "blocker_owner_options", value_column: "label", label_column: "label", filters: { is_active: true }, order_by: "sort_order" } },
          { id: uid("f"), key: "blocker_impact", db_column: "blocker_impact", label_key: "blockers.severity", field_type: "select", is_required: true, is_custom: false, sort_order: 2, is_active: true, data_source: { table: "blocker_impact_options", value_column: "label", label_column: "label", filters: { is_active: true }, order_by: "sort_order" } },
          { id: uid("f"), key: "blocker_resolution_date", db_column: "blocker_resolution_date", label_key: "blockers.expectedResolution", field_type: "date", is_required: true, is_custom: false, sort_order: 3, is_active: true },
          { id: uid("f"), key: "blocker_description", db_column: "blocker_description", label_key: "blockers.description", field_type: "textarea", is_required: true, is_custom: false, sort_order: 4, is_active: true, validation: { min_length: 1 } },
        ],
      },
    ],
    role_overrides: [],
  };
}

// ─── Export all default configs ───

export function getDefaultFormConfigs(): FormTemplateConfig[] {
  resetIds();
  return [
    sewingEodConfig(),
    sewingTargetsConfig(),
    finishingEodConfig(),
    finishingTargetsConfig(),
    cuttingEodConfig(),
    sewingUpdateConfig(),
    finishingUpdateConfig(),
    reportBlockerConfig(),
  ];
}

export function getDefaultConfigByType(formType: string): FormTemplateConfig | undefined {
  return getDefaultFormConfigs().find((c) => c.form_type === formType);
}
