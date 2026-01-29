import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Plus,
  FileText,
  Trash2,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Play,
} from "lucide-react";
import { DEV_FACTORY_ID_PREFIX } from "@/lib/constants";
import { chunkText } from "@/utils/chunking";

interface KnowledgeDocument {
  id: string;
  title: string;
  description: string | null;
  document_type: string;
  source_url: string | null;
  language: string;
  is_global: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  factory_id: string | null;
  created_by: string | null;
  ingestion_status?: {
    id: string;
    document_id: string;
    status: string;
    error_message: string | null;
    chunks_created: number;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
  };
}

const DOCUMENT_TYPES = [
  { value: "manual", label: "User Manual" },
  { value: "tutorial", label: "Tutorial" },
  { value: "certificate", label: "Certificate/Compliance" },
  { value: "readme", label: "README/Help" },
  { value: "faq", label: "FAQ" },
  { value: "policy", label: "Policy Document" },
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "bn", label: "Bengali (বাংলা)" },
];

export default function KnowledgeBase() {
  const { profile, isAdminOrHigher } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ingestingDocId, setIngestingDocId] = useState<string | null>(null);
  const [ingestionProgress, setIngestionProgress] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    document_type: "manual",
    source_url: "",
    language: "en",
    is_global: false,
    content: "",
  });

  // Check admin access + dev factory only
  useEffect(() => {
    if (!isAdminOrHigher() || !profile?.factory_id?.startsWith(DEV_FACTORY_ID_PREFIX)) {
      navigate("/dashboard");
    }
  }, [isAdminOrHigher, profile, navigate]);

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    try {
      const { data: docs, error } = await supabase
        .from("knowledge_documents")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch ingestion status for each document
      const docIds = docs?.map((d) => d.id) || [];
      const { data: queue } = docIds.length > 0
        ? await supabase
            .from("document_ingestion_queue")
            .select("*")
            .in("document_id", docIds)
        : { data: [] };

      const docsWithStatus = (docs || []).map((doc) => ({
        ...doc,
        ingestion_status: queue?.find((q) => q.document_id === doc.id),
      }));

      setDocuments(docsWithStatus);
    } catch (err) {
      console.error("Error fetching documents:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load documents",
      });
    }
  }, [toast]);

  useEffect(() => {
    fetchDocuments().then(() => setLoading(false));
  }, [fetchDocuments]);

  // ──────────────────────────────────────────────
  // INGESTION — runs independently from the form
  // ──────────────────────────────────────────────
  const runIngestion = useCallback(async (documentId: string, content: string, docTitle: string) => {
    console.log("[KB] Starting ingestion for", documentId, "content length:", content.length);
    setIngestingDocId(documentId);
    setIngestionProgress("Preparing...");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Not authenticated");

      // Chunk the text (for-loop based, cannot infinite-loop)
      console.log("[KB] Chunking text...");
      const chunks = chunkText(content);
      console.log("[KB] Created", chunks.length, "chunks");

      if (chunks.length === 0) {
        throw new Error("No chunks generated from content");
      }

      setIngestionProgress(`0 / ${chunks.length} chunks`);

      // Clear old queue + chunks
      await supabase.from("document_ingestion_queue").delete().eq("document_id", documentId);
      await supabase.from("knowledge_chunks").delete().eq("document_id", documentId);

      // Create queue entry
      await supabase.from("document_ingestion_queue").insert({
        document_id: documentId,
        status: "processing",
        chunks_created: 0,
        started_at: new Date().toISOString(),
      });

      // Process each chunk via the ingest-chunk edge function
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        setIngestionProgress(`${i + 1} / ${chunks.length} chunks`);
        console.log(`[KB] Processing chunk ${i + 1}/${chunks.length}`);

        const response = await supabase.functions.invoke("ingest-chunk", {
          body: {
            document_id: documentId,
            chunk_index: chunk.index,
            content: chunk.content,
            section_heading: chunk.sectionHeading,
          },
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (response.error) {
          throw new Error(`Chunk ${i + 1}: ${response.error.message}`);
        }
        if (response.data?.error) {
          throw new Error(`Chunk ${i + 1}: ${response.data.error}`);
        }

        // Update queue progress
        await supabase
          .from("document_ingestion_queue")
          .update({ chunks_created: i + 1 })
          .eq("document_id", documentId);
      }

      // Mark completed
      await supabase
        .from("document_ingestion_queue")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          chunks_created: chunks.length,
        })
        .eq("document_id", documentId);

      console.log("[KB] Ingestion completed for", documentId);
      toast({ title: "Ingestion complete", description: `"${docTitle}" — ${chunks.length} chunks processed` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[KB] Ingestion failed:", msg);

      // Mark failed in queue
      await supabase
        .from("document_ingestion_queue")
        .update({ status: "failed", error_message: msg })
        .eq("document_id", documentId);

      toast({
        variant: "destructive",
        title: "Ingestion failed",
        description: msg,
      });
    } finally {
      setIngestingDocId(null);
      setIngestionProgress("");
      fetchDocuments();
    }
  }, [toast, fetchDocuments]);

  // ──────────────────────────────────────────────
  // FORM SUBMIT — saves document, then auto-ingests
  // ──────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!formData.title.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Title is required" });
      return;
    }
    if (!formData.content.trim() && !formData.source_url.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Please provide content or a source URL" });
      return;
    }

    setIsSubmitting(true);

    // Capture values before clearing
    const contentToIngest = formData.content.trim();
    const docTitle = formData.title.trim();

    try {
      // 1. Create document record
      const { data: doc, error: docError } = await supabase
        .from("knowledge_documents")
        .insert({
          title: formData.title,
          description: formData.description || null,
          document_type: formData.document_type,
          source_url: formData.source_url || null,
          language: formData.language,
          is_global: formData.is_global,
          factory_id: formData.is_global ? null : profile?.factory_id,
          created_by: (await supabase.auth.getUser()).data.user?.id,
          content: contentToIngest || null,
        })
        .select("id")
        .single();

      if (docError) throw docError;

      // 2. Close dialog and clear form IMMEDIATELY
      setFormData({
        title: "",
        description: "",
        document_type: "manual",
        source_url: "",
        language: "en",
        is_global: false,
        content: "",
      });
      setIsAddDialogOpen(false);
      setIsSubmitting(false);

      toast({ title: "Document added", description: "Starting ingestion..." });

      // 3. Refresh the table so the document appears
      await fetchDocuments();

      // 4. Start ingestion AFTER dialog is fully closed
      //    setTimeout ensures React has re-rendered and the dialog DOM is gone
      if (contentToIngest) {
        const docId = doc.id;
        setTimeout(() => {
          runIngestion(docId, contentToIngest, docTitle);
        }, 100);
      }
    } catch (err) {
      console.error("Error adding document:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to add document",
      });
      setIsSubmitting(false);
    }
  }, [formData, profile, toast, fetchDocuments, runIngestion]);

  // ──────────────────────────────────────────────
  // MANUAL INGEST — triggered from table row button
  // ──────────────────────────────────────────────
  const handleIngest = useCallback(async (doc: KnowledgeDocument) => {
    if (ingestingDocId) {
      toast({ variant: "destructive", title: "Please wait", description: "Another ingestion is in progress" });
      return;
    }

    try {
      // Fetch stored content from the document
      const { data: fullDoc, error: fetchErr } = await supabase
        .from("knowledge_documents")
        .select("content")
        .eq("id", doc.id)
        .single();

      if (fetchErr) throw fetchErr;

      const content = (fullDoc as any)?.content as string | null;
      if (!content) {
        toast({
          variant: "destructive",
          title: "No content",
          description: "This document has no stored content. Delete it and re-add with content.",
        });
        return;
      }

      runIngestion(doc.id, content, doc.title);
    } catch (err) {
      console.error("Ingest error:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to start ingestion",
      });
    }
  }, [ingestingDocId, toast, runIngestion]);

  const handleDelete = useCallback(async (doc: KnowledgeDocument) => {
    if (!confirm(`Are you sure you want to delete "${doc.title}"?`)) return;

    try {
      const { error } = await supabase
        .from("knowledge_documents")
        .delete()
        .eq("id", doc.id);

      if (error) throw error;

      toast({ title: "Deleted", description: "Document deleted successfully" });
      fetchDocuments();
    } catch (err) {
      console.error("Delete error:", err);
      toast({ variant: "destructive", title: "Error", description: "Failed to delete document" });
    }
  }, [toast, fetchDocuments]);

  const handleToggleActive = useCallback(async (doc: KnowledgeDocument) => {
    try {
      const { error } = await supabase
        .from("knowledge_documents")
        .update({ is_active: !doc.is_active })
        .eq("id", doc.id);

      if (error) throw error;
      fetchDocuments();
    } catch (err) {
      console.error("Toggle error:", err);
      toast({ variant: "destructive", title: "Error", description: "Failed to update document" });
    }
  }, [toast, fetchDocuments]);

  const getStatusBadge = (doc: KnowledgeDocument) => {
    // Show live progress for currently-ingesting document
    if (ingestingDocId === doc.id && ingestionProgress) {
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          {ingestionProgress}
        </Badge>
      );
    }

    const status = doc.ingestion_status;
    if (!status) {
      return (
        <Badge variant="outline" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          Not ingested
        </Badge>
      );
    }

    switch (status.status) {
      case "completed":
        return (
          <Badge variant="default" className="gap-1 bg-green-600">
            <CheckCircle className="h-3 w-3" />
            {status.chunks_created} chunks
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processing...
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="gap-1" title={status.error_message || ""}>
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status.status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-muted-foreground">
            Manage documents for the AI chat assistant
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchDocuments}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Document
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Knowledge Document</DialogTitle>
                <DialogDescription>
                  Add a document to the knowledge base. The content will be
                  chunked, embedded, and made searchable by the AI assistant.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      placeholder="e.g., ProductionPortal User Manual"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Document Type</Label>
                    <Select
                      value={formData.document_type}
                      onValueChange={(value) =>
                        setFormData({ ...formData, document_type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Brief description of the document"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Select
                      value={formData.language}
                      onValueChange={(value) =>
                        setFormData({ ...formData, language: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((lang) => (
                          <SelectItem key={lang.value} value={lang.value}>
                            {lang.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="source_url">Source URL (optional)</Label>
                    <Input
                      id="source_url"
                      type="url"
                      value={formData.source_url}
                      onChange={(e) =>
                        setFormData({ ...formData, source_url: e.target.value })
                      }
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_global"
                    checked={formData.is_global}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_global: checked })
                    }
                  />
                  <Label htmlFor="is_global">
                    Global document (visible to all factories)
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">
                    Content *
                    <span className="text-xs text-muted-foreground ml-2">
                      Paste the full text content of the document
                    </span>
                  </Label>
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) =>
                      setFormData({ ...formData, content: e.target.value })
                    }
                    placeholder="Paste the document content here..."
                    className="min-h-[200px] font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.content.length.toLocaleString()} characters
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Add Document
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>
            {documents.length} document{documents.length !== 1 ? "s" : ""} in
            knowledge base
          </CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No documents yet. Add your first document to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{doc.title}</p>
                        {doc.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                            {doc.description}
                          </p>
                        )}
                        {doc.is_global && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            Global
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {
                          DOCUMENT_TYPES.find((t) => t.value === doc.document_type)
                            ?.label || doc.document_type
                        }
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {LANGUAGES.find((l) => l.value === doc.language)?.label ||
                        doc.language}
                    </TableCell>
                    <TableCell>{getStatusBadge(doc)}</TableCell>
                    <TableCell>
                      <Switch
                        checked={doc.is_active}
                        onCheckedChange={() => handleToggleActive(doc)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {doc.source_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(doc.source_url!, "_blank")}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleIngest(doc)}
                          disabled={!!ingestingDocId}
                          title={doc.ingestion_status?.status === "completed" ? "Re-ingest document" : "Ingest document"}
                        >
                          {doc.ingestion_status?.status === "completed" ? (
                            <RefreshCw className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(doc)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
