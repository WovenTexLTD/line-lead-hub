import { HelpCircle, AlertTriangle, Award, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuickActionsProps {
  onSelect: (prompt: string) => void;
  language: "en" | "bn";
}

const QUICK_ACTIONS = {
  en: [
    {
      icon: HelpCircle,
      label: "How do I...",
      prompt: "How do I submit my end-of-day production report?",
    },
    {
      icon: AlertTriangle,
      label: "Troubleshoot",
      prompt: "I'm having trouble with the morning targets form. It's not saving my data.",
    },
    {
      icon: Award,
      label: "Certifications",
      prompt: "What certifications does the factory have? Are they current?",
    },
    {
      icon: Headphones,
      label: "Contact support",
      prompt: "How can I contact support for help with a technical issue?",
    },
  ],
  bn: [
    {
      icon: HelpCircle,
      label: "কিভাবে করব...",
      prompt: "আমি কিভাবে দিনের শেষে প্রোডাকশন রিপোর্ট জমা দেব?",
    },
    {
      icon: AlertTriangle,
      label: "সমস্যা সমাধান",
      prompt: "সকালের টার্গেট ফর্মে সমস্যা হচ্ছে। ডাটা সেভ হচ্ছে না।",
    },
    {
      icon: Award,
      label: "সার্টিফিকেশন",
      prompt: "ফ্যাক্টরির কি কি সার্টিফিকেশন আছে? সেগুলো কি বর্তমান?",
    },
    {
      icon: Headphones,
      label: "সাপোর্ট",
      prompt: "টেকনিক্যাল সমস্যার জন্য সাপোর্টের সাথে কিভাবে যোগাযোগ করব?",
    },
  ],
};

export function QuickActions({ onSelect, language }: QuickActionsProps) {
  const actions = QUICK_ACTIONS[language];

  return (
    <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
      {actions.map((action, index) => (
        <Button
          key={index}
          variant="outline"
          size="sm"
          className="h-auto py-3 px-3 flex flex-col items-center gap-1 text-center"
          onClick={() => onSelect(action.prompt)}
        >
          <action.icon className="h-5 w-5 text-muted-foreground" />
          <span className="text-xs font-normal">{action.label}</span>
        </Button>
      ))}
    </div>
  );
}
