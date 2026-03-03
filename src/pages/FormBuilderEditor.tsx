/**
 * FormBuilderEditor — Admin page for editing a single form template.
 * Left panel: sections + fields with drag-and-drop reorder.
 * Right panel: field property editor.
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { clearFormConfigCache } from "@/hooks/useFormConfig";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  GripVertical,
  Plus,
  Trash2,
  Pencil,
  Save,
  Eye,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import type {
  FormType,
  FormSectionConfig,
  FormFieldConfig,
  FieldType,
  FormRoleOverride,
} from "@/types/form-config";
import { FORM_TYPE_LABELS, FIELD_TYPE_OPTIONS } from "@/types/form-config";

// ─── Sortable item for drag-and-drop ───

function SortableItem({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <button
        type="button"
        className="cursor-grab text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// ─── Main Editor ───

export default function FormBuilderEditor() {
  const { formType } = useParams<{ formType: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [templateId, setTemplateId] = useState<string | null>(null);
  const [sections, setSections] = useState<FormSectionConfig[]>([]);
  const [roleOverrides, setRoleOverrides] = useState<FormRoleOverride[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddFieldDialog, setShowAddFieldDialog] = useState(false);
  const [showAddSectionDialog, setShowAddSectionDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // New field/section form state
  const [newFieldKey, setNewFieldKey] = useState("");
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState<FieldType>("text");
  const [newSectionKey, setNewSectionKey] = useState("");
  const [newSectionTitle, setNewSectionTitle] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ─── Load template data ───

  useEffect(() => {
    if (profile?.factory_id && formType) {
      loadTemplate();
    }
  }, [profile?.factory_id, formType]);

  async function loadTemplate() {
    setLoading(true);
    try {
      // Fetch template
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: tmpl } = await (supabase as any)
        .from("form_templates")
        .select("*")
        .eq("factory_id", profile!.factory_id)
        .eq("form_type", formType)
        .single();

      if (!tmpl) {
        toast.error("Template not found. Initialize defaults first.");
        navigate("/setup/form-builder");
        return;
      }

      setTemplateId(tmpl.id);

      // Fetch sections
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: secs } = await (supabase as any)
        .from("form_sections")
        .select("*")
        .eq("template_id", tmpl.id)
        .order("sort_order", { ascending: true });

      // Fetch fields
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: fields } = await (supabase as any)
        .from("form_fields")
        .select("*")
        .eq("template_id", tmpl.id)
        .order("sort_order", { ascending: true });

      // Fetch role overrides
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: overrides } = await (supabase as any)
        .from("form_role_overrides")
        .select("*")
        .eq("template_id", tmpl.id);

      // Assemble sections with fields
      const assembled: FormSectionConfig[] = (secs ?? []).map((s: any) => ({
        id: s.id,
        key: s.key,
        title_key: s.title_key,
        description: s.description ?? undefined,
        sort_order: s.sort_order,
        is_collapsible: s.is_collapsible,
        is_active: s.is_active,
        fields: (fields ?? [])
          .filter((f: any) => f.section_id === s.id)
          .map((f: any) => ({
            id: f.id,
            key: f.key,
            db_column: f.db_column,
            label_key: f.label_key,
            field_type: f.field_type,
            is_required: f.is_required,
            is_custom: f.is_custom,
            sort_order: f.sort_order,
            is_active: f.is_active,
            default_value: f.default_value ?? undefined,
            placeholder: f.placeholder ?? undefined,
            validation: f.validation ?? undefined,
            data_source: f.data_source ?? undefined,
            compute_expression: f.compute_expression ?? undefined,
            auto_fill_from: f.auto_fill_from ?? undefined,
            visible_when: f.visible_when ?? undefined,
          })),
      }));

      setSections(assembled);
      setRoleOverrides(
        (overrides ?? []).map((o: any) => ({
          role: o.role,
          hidden_field_ids: o.hidden_field_ids ?? [],
          hidden_section_ids: o.hidden_section_ids ?? [],
          required_overrides: o.required_overrides ?? {},
        }))
      );

      if (assembled.length > 0) {
        setSelectedSectionId(assembled[0].id);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load template");
    } finally {
      setLoading(false);
    }
  }

  // ─── Get selected field/section ───

  const selectedField = sections
    .flatMap((s) => s.fields)
    .find((f) => f.id === selectedFieldId);

  const selectedSection = sections.find((s) => s.id === selectedSectionId);
  const activeSection = sections.find((s) => s.id === selectedSectionId);

  // ─── Drag handlers ───

  function handleSectionDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setSections((prev) => {
      const oldIndex = prev.findIndex((s) => s.id === active.id);
      const newIndex = prev.findIndex((s) => s.id === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex);
      return reordered.map((s, i) => ({ ...s, sort_order: i }));
    });
  }

  function handleFieldDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !selectedSectionId) return;

    setSections((prev) =>
      prev.map((section) => {
        if (section.id !== selectedSectionId) return section;
        const oldIndex = section.fields.findIndex((f) => f.id === active.id);
        const newIndex = section.fields.findIndex((f) => f.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return section;
        const reordered = arrayMove(section.fields, oldIndex, newIndex);
        return {
          ...section,
          fields: reordered.map((f, i) => ({ ...f, sort_order: i })),
        };
      })
    );
  }

  // ─── Field update ───

  function updateField(fieldId: string, updates: Partial<FormFieldConfig>) {
    setSections((prev) =>
      prev.map((section) => ({
        ...section,
        fields: section.fields.map((f) =>
          f.id === fieldId ? { ...f, ...updates } : f
        ),
      }))
    );
  }

  function updateSection(sectionId: string, updates: Partial<FormSectionConfig>) {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, ...updates } : s))
    );
  }

  // ─── Add field ───

  function addField() {
    if (!selectedSectionId || !newFieldKey || !newFieldLabel) return;

    const newField: FormFieldConfig = {
      id: `new-${Date.now()}`,
      key: newFieldKey.replace(/\s+/g, "_").toLowerCase(),
      db_column: null,
      label_key: newFieldLabel,
      field_type: newFieldType,
      is_required: false,
      is_custom: true,
      sort_order: (activeSection?.fields.length ?? 0),
      is_active: true,
    };

    setSections((prev) =>
      prev.map((s) =>
        s.id === selectedSectionId
          ? { ...s, fields: [...s.fields, newField] }
          : s
      )
    );

    setNewFieldKey("");
    setNewFieldLabel("");
    setNewFieldType("text");
    setShowAddFieldDialog(false);
    setSelectedFieldId(newField.id);
  }

  // ─── Add section ───

  function addSection() {
    if (!newSectionKey || !newSectionTitle) return;

    const newSection: FormSectionConfig = {
      id: `new-${Date.now()}`,
      key: newSectionKey.replace(/\s+/g, "_").toLowerCase(),
      title_key: newSectionTitle,
      sort_order: sections.length,
      is_collapsible: false,
      is_active: true,
      fields: [],
    };

    setSections((prev) => [...prev, newSection]);
    setSelectedSectionId(newSection.id);
    setNewSectionKey("");
    setNewSectionTitle("");
    setShowAddSectionDialog(false);
  }

  // ─── Delete field ───

  function deleteField(fieldId: string) {
    setSections((prev) =>
      prev.map((s) => ({
        ...s,
        fields: s.fields.filter((f) => f.id !== fieldId),
      }))
    );
    if (selectedFieldId === fieldId) setSelectedFieldId(null);
  }

  // ─── Delete section ───

  function deleteSection(sectionId: string) {
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
    if (selectedSectionId === sectionId) {
      setSelectedSectionId(sections.find((s) => s.id !== sectionId)?.id ?? null);
    }
    setSelectedFieldId(null);
  }

  // ─── Save all changes ───

  async function saveTemplate() {
    if (!templateId) return;
    setSaving(true);

    try {
      // Delete existing sections and fields, then re-insert
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("form_fields")
        .delete()
        .eq("template_id", templateId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("form_sections")
        .delete()
        .eq("template_id", templateId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("form_role_overrides")
        .delete()
        .eq("template_id", templateId);

      // Re-insert sections and fields
      for (const section of sections) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: sec } = await (supabase as any)
          .from("form_sections")
          .insert({
            template_id: templateId,
            key: section.key,
            title_key: section.title_key,
            description: section.description ?? null,
            sort_order: section.sort_order,
            is_collapsible: section.is_collapsible,
            is_active: section.is_active,
          })
          .select()
          .single();

        if (!sec) continue;

        for (const field of section.fields) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from("form_fields").insert({
            section_id: sec.id,
            template_id: templateId,
            key: field.key,
            db_column: field.db_column ?? null,
            label_key: field.label_key,
            field_type: field.field_type,
            is_required: field.is_required,
            is_custom: field.is_custom,
            sort_order: field.sort_order,
            is_active: field.is_active,
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

      // Re-insert role overrides
      for (const override of roleOverrides) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("form_role_overrides").insert({
          template_id: templateId,
          role: override.role,
          hidden_field_ids: override.hidden_field_ids,
          hidden_section_ids: override.hidden_section_ids,
          required_overrides: override.required_overrides,
        });
      }

      // Update template timestamp
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("form_templates")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", templateId);

      // Clear cache so users get fresh config
      clearFormConfigCache();

      toast.success("Form template saved");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  // ─── Loading ───

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const formLabel = FORM_TYPE_LABELS[formType as FormType] ?? formType;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/setup/form-builder")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{formLabel}</h1>
            <p className="text-xs text-muted-foreground">
              Drag to reorder, click to edit properties
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
            <Eye className="mr-1 h-4 w-4" />
            Preview
          </Button>
          <Button size="sm" onClick={saveTemplate} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Sections & Fields */}
        <div className="lg:col-span-2 space-y-4">
          {/* Sections list with drag */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
            <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {sections.map((section) => (
                <SortableItem key={section.id} id={section.id}>
                  <Card
                    className={`cursor-pointer transition-colors ${
                      selectedSectionId === section.id ? "border-primary" : ""
                    }`}
                    onClick={() => {
                      setSelectedSectionId(section.id);
                      setSelectedFieldId(null);
                    }}
                  >
                    <CardHeader className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">
                          {section.title_key}
                        </CardTitle>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">
                            {section.fields.length} fields
                          </Badge>
                          {section.is_collapsible && (
                            <Badge variant="secondary" className="text-xs">
                              collapsible
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSection(section.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    {/* Fields within selected section */}
                    {selectedSectionId === section.id && (
                      <CardContent className="pt-0 px-4 pb-3">
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handleFieldDragEnd}
                        >
                          <SortableContext
                            items={section.fields.map((f) => f.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            <div className="space-y-1">
                              {section.fields.map((field) => (
                                <SortableItem key={field.id} id={field.id}>
                                  <div
                                    className={`flex items-center justify-between rounded-md px-3 py-2 text-sm cursor-pointer hover:bg-muted ${
                                      selectedFieldId === field.id
                                        ? "bg-primary/10 border border-primary/30"
                                        : "bg-muted/50"
                                    }`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedFieldId(field.id);
                                    }}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="truncate max-w-[200px]">
                                        {field.label_key}
                                      </span>
                                      <Badge variant="outline" className="text-[10px] py-0">
                                        {field.field_type}
                                      </Badge>
                                      {field.is_required && (
                                        <span className="text-destructive text-xs">*</span>
                                      )}
                                      {field.is_custom && (
                                        <Badge variant="secondary" className="text-[10px] py-0">
                                          custom
                                        </Badge>
                                      )}
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteField(field.id);
                                      }}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </SortableItem>
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>

                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowAddFieldDialog(true);
                          }}
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          Add Field
                        </Button>
                      </CardContent>
                    )}
                  </Card>
                </SortableItem>
              ))}
            </SortableContext>
          </DndContext>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowAddSectionDialog(true)}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Section
          </Button>
        </div>

        {/* Right: Field/Section Editor */}
        <div className="space-y-4">
          {selectedField ? (
            <FieldEditorPanel
              field={selectedField}
              onUpdate={(updates) => updateField(selectedField.id, updates)}
              roleOverrides={roleOverrides}
              onRoleOverridesChange={setRoleOverrides}
              templateId={templateId}
            />
          ) : selectedSection ? (
            <SectionEditorPanel
              section={selectedSection}
              onUpdate={(updates) => updateSection(selectedSection.id, updates)}
            />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Click a section or field to edit its properties
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Add Field Dialog */}
      <Dialog open={showAddFieldDialog} onOpenChange={setShowAddFieldDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Field</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Field Key</Label>
              <Input
                value={newFieldKey}
                onChange={(e) => setNewFieldKey(e.target.value)}
                placeholder="e.g., custom_metric"
              />
            </div>
            <div>
              <Label>Label</Label>
              <Input
                value={newFieldLabel}
                onChange={(e) => setNewFieldLabel(e.target.value)}
                placeholder="e.g., Custom Metric"
              />
            </div>
            <div>
              <Label>Field Type</Label>
              <Select value={newFieldType} onValueChange={(v) => setNewFieldType(v as FieldType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddFieldDialog(false)}>
              Cancel
            </Button>
            <Button onClick={addField} disabled={!newFieldKey || !newFieldLabel}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Section Dialog */}
      <Dialog open={showAddSectionDialog} onOpenChange={setShowAddSectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Section</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Section Key</Label>
              <Input
                value={newSectionKey}
                onChange={(e) => setNewSectionKey(e.target.value)}
                placeholder="e.g., custom_section"
              />
            </div>
            <div>
              <Label>Section Title</Label>
              <Input
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                placeholder="e.g., Custom Section"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSectionDialog(false)}>
              Cancel
            </Button>
            <Button onClick={addSection} disabled={!newSectionKey || !newSectionTitle}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Field Editor Panel ───

function FieldEditorPanel({
  field,
  onUpdate,
  roleOverrides,
  onRoleOverridesChange,
  templateId,
}: {
  field: FormFieldConfig;
  onUpdate: (updates: Partial<FormFieldConfig>) => void;
  roleOverrides: FormRoleOverride[];
  onRoleOverridesChange: (overrides: FormRoleOverride[]) => void;
  templateId: string | null;
}) {
  const ROLES = ["sewing", "finishing", "cutting", "storage", "worker", "admin", "owner"];

  function isFieldHiddenForRole(role: string): boolean {
    const override = roleOverrides.find((o) => o.role === role);
    return override?.hidden_field_ids.includes(field.id) ?? false;
  }

  function toggleFieldVisibility(role: string) {
    onRoleOverridesChange(
      ROLES.map((r) => {
        const existing = roleOverrides.find((o) => o.role === r) ?? {
          role: r,
          hidden_field_ids: [],
          hidden_section_ids: [],
          required_overrides: {},
        };

        if (r !== role) return existing;

        const isHidden = existing.hidden_field_ids.includes(field.id);
        return {
          ...existing,
          hidden_field_ids: isHidden
            ? existing.hidden_field_ids.filter((id) => id !== field.id)
            : [...existing.hidden_field_ids, field.id],
        };
      })
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Field Properties</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <Label className="text-xs">Label</Label>
          <Input
            value={field.label_key}
            onChange={(e) => onUpdate({ label_key: e.target.value })}
            className="h-8 text-sm"
          />
        </div>

        <div>
          <Label className="text-xs">Key</Label>
          <Input value={field.key} disabled className="h-8 text-sm bg-muted" />
        </div>

        <div>
          <Label className="text-xs">DB Column</Label>
          <Input
            value={field.db_column ?? ""}
            onChange={(e) => onUpdate({ db_column: e.target.value || null })}
            className="h-8 text-sm"
            placeholder="null (custom field)"
          />
        </div>

        <div>
          <Label className="text-xs">Field Type</Label>
          <Select
            value={field.field_type}
            onValueChange={(v) => onUpdate({ field_type: v as FieldType })}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-xs">Required</Label>
          <Switch
            checked={field.is_required}
            onCheckedChange={(checked) => onUpdate({ is_required: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-xs">Active</Label>
          <Switch
            checked={field.is_active}
            onCheckedChange={(checked) => onUpdate({ is_active: checked })}
          />
        </div>

        <div>
          <Label className="text-xs">Placeholder</Label>
          <Input
            value={field.placeholder ?? ""}
            onChange={(e) => onUpdate({ placeholder: e.target.value || undefined })}
            className="h-8 text-sm"
          />
        </div>

        <div>
          <Label className="text-xs">Default Value</Label>
          <Input
            value={field.default_value ?? ""}
            onChange={(e) => onUpdate({ default_value: e.target.value || undefined })}
            className="h-8 text-sm"
          />
        </div>

        {field.field_type === "number" && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Min</Label>
                <Input
                  type="number"
                  value={field.validation?.min ?? ""}
                  onChange={(e) =>
                    onUpdate({
                      validation: {
                        ...field.validation,
                        min: e.target.value ? Number(e.target.value) : undefined,
                      },
                    })
                  }
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Max</Label>
                <Input
                  type="number"
                  value={field.validation?.max ?? ""}
                  onChange={(e) =>
                    onUpdate({
                      validation: {
                        ...field.validation,
                        max: e.target.value ? Number(e.target.value) : undefined,
                      },
                    })
                  }
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Step</Label>
                <Input
                  type="number"
                  value={field.validation?.step ?? ""}
                  onChange={(e) =>
                    onUpdate({
                      validation: {
                        ...field.validation,
                        step: e.target.value ? Number(e.target.value) : undefined,
                      },
                    })
                  }
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Integer only</Label>
              <Switch
                checked={field.validation?.integer ?? false}
                onCheckedChange={(checked) =>
                  onUpdate({
                    validation: { ...field.validation, integer: checked },
                  })
                }
              />
            </div>
          </>
        )}

        {field.field_type === "computed" && (
          <div>
            <Label className="text-xs">Compute Expression</Label>
            <Input
              value={field.compute_expression ?? ""}
              onChange={(e) => onUpdate({ compute_expression: e.target.value || undefined })}
              className="h-8 text-sm"
              placeholder="e.g., good_today / hours_actual"
            />
          </div>
        )}

        {/* Role Visibility */}
        <div>
          <Label className="text-xs font-medium mb-2 block">Role Visibility</Label>
          <div className="space-y-1">
            {ROLES.map((role) => (
              <div key={role} className="flex items-center justify-between">
                <span className="text-xs capitalize">{role}</span>
                <Switch
                  checked={!isFieldHiddenForRole(role)}
                  onCheckedChange={() => toggleFieldVisibility(role)}
                />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Section Editor Panel ───

function SectionEditorPanel({
  section,
  onUpdate,
}: {
  section: FormSectionConfig;
  onUpdate: (updates: Partial<FormSectionConfig>) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Section Properties</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <Label className="text-xs">Title</Label>
          <Input
            value={section.title_key}
            onChange={(e) => onUpdate({ title_key: e.target.value })}
            className="h-8 text-sm"
          />
        </div>

        <div>
          <Label className="text-xs">Key</Label>
          <Input value={section.key} disabled className="h-8 text-sm bg-muted" />
        </div>

        <div>
          <Label className="text-xs">Description</Label>
          <Textarea
            value={section.description ?? ""}
            onChange={(e) => onUpdate({ description: e.target.value || undefined })}
            className="text-sm"
            rows={2}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-xs">Collapsible</Label>
          <Switch
            checked={section.is_collapsible}
            onCheckedChange={(checked) => onUpdate({ is_collapsible: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-xs">Active</Label>
          <Switch
            checked={section.is_active}
            onCheckedChange={(checked) => onUpdate({ is_active: checked })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
