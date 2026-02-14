import { useState } from "react";
import { Plus, Mic, FileText, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/useMobile";
import { useLocation } from "wouter";

export default function FloatingActionButton() {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();

  if (!isMobile) return null;

  const actions = [
    {
      icon: FileText,
      label: "Quick Capture",
      onClick: () => {
        setLocation("/capture");
        setIsOpen(false);
      },
      color: "bg-blue-600 hover:bg-blue-700",
    },
    {
      icon: Mic,
      label: "Voice Note",
      onClick: () => {
        setLocation("/capture?voice=true");
        setIsOpen(false);
      },
      color: "bg-purple-600 hover:bg-purple-700",
    },
    {
      icon: Users,
      label: "Pulse Check",
      onClick: () => {
        setLocation("/pulse-check");
        setIsOpen(false);
      },
      color: "bg-green-600 hover:bg-green-700",
    },
  ];

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Action buttons */}
      <div className="fixed bottom-20 right-4 z-50 md:hidden">
        <div className="flex flex-col gap-3 items-end">
          {isOpen &&
            actions.map((action, index) => (
              <div
                key={index}
                className="flex items-center gap-3 animate-in slide-in-from-bottom-2"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <span className="text-sm font-medium bg-white px-3 py-1.5 rounded-full shadow-lg">
                  {action.label}
                </span>
                <Button
                  size="icon"
                  className={`h-12 w-12 rounded-full shadow-lg ${action.color}`}
                  onClick={action.onClick}
                >
                  <action.icon className="h-5 w-5 text-white" />
                </Button>
              </div>
            ))}
        </div>
      </div>

      {/* Main FAB */}
      <Button
        size="icon"
        className={`fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg z-50 md:hidden transition-transform ${
          isOpen ? "rotate-45 bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary/90"
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Plus className="h-6 w-6 text-white" />
      </Button>
    </>
  );
}
