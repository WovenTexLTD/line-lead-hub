import { useState, useRef, useEffect } from "react";
import { Send, Loader2, RotateCcw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useChat } from "@/hooks/useChat";
import { ChatMessage } from "./ChatMessage";
import { QuickActions } from "./QuickActions";
import { LanguageToggle } from "./LanguageToggle";

export function ChatPanel() {
  const {
    messages,
    isLoading,
    error,
    language,
    setLanguage,
    sendMessage,
    submitFeedback,
    clearConversation,
    fetchSource,
  } = useChat();

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const message = input;
    setInput("");
    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleQuickAction = (prompt: string) => {
    sendMessage(prompt);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Messages Area */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <div className="text-muted-foreground mb-6">
              <p className="text-lg font-medium mb-2">
                {language === "bn"
                  ? "আমি কীভাবে সাহায্য করতে পারি?"
                  : "How can I help you today?"}
              </p>
              <p className="text-sm">
                {language === "bn"
                  ? "প্রোডাকশন পোর্টাল সম্পর্কে প্রশ্ন করুন"
                  : "Ask me about ProductionPortal features, compliance, or troubleshooting"}
              </p>
            </div>
            <QuickActions onSelect={handleQuickAction} language={language} />
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onFeedback={submitFeedback}
                onViewSource={fetchSource}
                language={language}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive" className="mx-4 mb-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Footer */}
      <div className="border-t p-4 space-y-3">
        {/* Language Toggle & Clear */}
        <div className="flex items-center justify-between">
          <LanguageToggle language={language} onToggle={setLanguage} />
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearConversation}
              className="text-xs"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              {language === "bn" ? "নতুন চ্যাট" : "New chat"}
            </Button>
          )}
        </div>

        {/* Input Area */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              language === "bn"
                ? "আপনার প্রশ্ন লিখুন..."
                : "Type your question..."
            }
            className="min-h-[44px] max-h-[120px] resize-none"
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !input.trim()}
            className="h-[44px] w-[44px] shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>

        <p className="text-[10px] text-muted-foreground text-center">
          {language === "bn"
            ? "এই সহকারী ভুল করতে পারে। গুরুত্বপূর্ণ তথ্যের জন্য অফিসিয়াল ডকুমেন্টেশন দেখুন।"
            : "This assistant can make mistakes. Check official documentation for important information."}
        </p>
      </div>
    </div>
  );
}
