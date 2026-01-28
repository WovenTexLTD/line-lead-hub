import { useState } from "react";
import { ThumbsUp, ThumbsDown, ExternalLink, FileText, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType, ChatCitation } from "@/hooks/useChat";

interface ChatMessageProps {
  message: ChatMessageType;
  onFeedback?: (messageId: string, feedback: "thumbs_up" | "thumbs_down") => void;
  onViewSource?: (chunkId: string) => Promise<any>;
  language: "en" | "bn";
}

export function ChatMessage({
  message,
  onFeedback,
  onViewSource,
  language,
}: ChatMessageProps) {
  const [feedback, setFeedback] = useState<"thumbs_up" | "thumbs_down" | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<any>(null);
  const [loadingSource, setLoadingSource] = useState(false);

  const isUser = message.role === "user";
  const isLoading = message.isLoading;

  const handleFeedback = (type: "thumbs_up" | "thumbs_down") => {
    setFeedback(type);
    onFeedback?.(message.id, type);
  };

  const handleViewSource = async (citation: ChatCitation) => {
    if (!onViewSource) return;

    setLoadingSource(true);
    try {
      const source = await onViewSource(citation.chunkId);
      if (source) {
        setSelectedSource(source);
      }
    } finally {
      setLoadingSource(false);
    }
  };

  // Format message content with markdown-like rendering
  const formatContent = (content: string) => {
    // Simple markdown parsing for common patterns
    return content
      .split("\n")
      .map((line, i) => {
        // Headers
        if (line.startsWith("## ")) {
          return (
            <h3 key={i} className="font-semibold text-base mt-3 mb-1">
              {line.slice(3)}
            </h3>
          );
        }
        if (line.startsWith("# ")) {
          return (
            <h2 key={i} className="font-bold text-lg mt-3 mb-1">
              {line.slice(2)}
            </h2>
          );
        }
        // Bullet points
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <li key={i} className="ml-4 list-disc">
              {line.slice(2)}
            </li>
          );
        }
        // Numbered lists
        if (/^\d+\.\s/.test(line)) {
          return (
            <li key={i} className="ml-4 list-decimal">
              {line.replace(/^\d+\.\s/, "")}
            </li>
          );
        }
        // Regular paragraphs
        if (line.trim()) {
          return (
            <p key={i} className="mb-2">
              {line}
            </p>
          );
        }
        return <br key={i} />;
      });
  };

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className={cn(
          "text-xs",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}>
          {isUser ? "U" : "AI"}
        </AvatarFallback>
      </Avatar>

      {/* Message Content */}
      <div
        className={cn(
          "flex flex-col max-w-[80%]",
          isUser ? "items-end" : "items-start"
        )}
      >
        <div
          className={cn(
            "rounded-lg px-4 py-2 text-sm",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted",
            isLoading && "animate-pulse"
          )}
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{language === "bn" ? "চিন্তা করছি..." : "Thinking..."}</span>
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {formatContent(message.content)}
            </div>
          )}
        </div>

        {/* No Evidence Warning */}
        {message.noEvidence && !isUser && (
          <div className="flex items-center gap-1 mt-1 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            <span>
              {language === "bn"
                ? "নির্দিষ্ট তথ্য উৎসে পাওয়া যায়নি"
                : "Specific information not found in sources"}
            </span>
          </div>
        )}

        {/* Citations */}
        {message.citations && message.citations.length > 0 && !isUser && (
          <Collapsible open={sourcesOpen} onOpenChange={setSourcesOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 h-auto py-1 px-2 text-xs"
              >
                <FileText className="h-3 w-3 mr-1" />
                {language === "bn"
                  ? `${message.citations.length}টি উৎস`
                  : `${message.citations.length} source${message.citations.length > 1 ? "s" : ""}`}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              {message.citations.map((citation, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 text-xs p-2 bg-muted/50 rounded border"
                >
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {citation.documentType}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{citation.documentTitle}</p>
                    {citation.sectionHeading && (
                      <p className="text-muted-foreground truncate">
                        {citation.sectionHeading}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {citation.sourceUrl && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => window.open(citation.sourceUrl!, "_blank")}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => handleViewSource(citation)}
                      disabled={loadingSource}
                    >
                      {loadingSource ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        language === "bn" ? "দেখুন" : "View"
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Feedback Buttons */}
        {!isUser && !isLoading && (
          <div className="flex items-center gap-1 mt-1">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-6 w-6",
                feedback === "thumbs_up" && "text-green-600 bg-green-100 dark:bg-green-900/30"
              )}
              onClick={() => handleFeedback("thumbs_up")}
            >
              <ThumbsUp className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-6 w-6",
                feedback === "thumbs_down" && "text-red-600 bg-red-100 dark:bg-red-900/30"
              )}
              onClick={() => handleFeedback("thumbs_down")}
            >
              <ThumbsDown className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Source Detail Dialog */}
      <Dialog open={!!selectedSource} onOpenChange={() => setSelectedSource(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedSource?.document?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">{selectedSource?.document?.document_type}</Badge>
              {selectedSource?.section_heading && (
                <span>• {selectedSource.section_heading}</span>
              )}
              {selectedSource?.page_number && (
                <span>• Page {selectedSource.page_number}</span>
              )}
            </div>
            <div className="p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap">
              {selectedSource?.content}
            </div>
            {selectedSource?.document?.source_url && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(selectedSource.document.source_url, "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {language === "bn" ? "মূল উৎস দেখুন" : "View Original Source"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
