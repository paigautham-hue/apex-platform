import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Search,
  Users,
  Target,
  FileText,
  Calendar,
  Settings,
  Plus,
  TrendingUp,
  MessageSquare,
  DollarSign,
} from "lucide-react";

type CommandAction = {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  keywords: string[];
};

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();

  const { data: people } = trpc.person.list.useQuery({ tenantId: 1 });

  // Keyboard shortcut to open/close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const commands: CommandAction[] = [
    {
      id: "capture-observation",
      label: "Capture Observation",
      icon: <Plus className="h-4 w-4" />,
      action: () => {
        setLocation("/capture");
        setOpen(false);
      },
      keywords: ["capture", "observation", "note", "feedback", "f10"],
    },
    {
      id: "view-people",
      label: "View People",
      icon: <Users className="h-4 w-4" />,
      action: () => {
        setLocation("/people");
        setOpen(false);
      },
      keywords: ["people", "team", "employees", "staff"],
    },
    {
      id: "view-goals",
      label: "View Goals",
      icon: <Target className="h-4 w-4" />,
      action: () => {
        setLocation("/goals");
        setOpen(false);
      },
      keywords: ["goals", "objectives", "targets", "okr"],
    },
    {
      id: "ai-ask",
      label: "Ask AI",
      icon: <MessageSquare className="h-4 w-4" />,
      action: () => {
        setLocation("/ask");
        setOpen(false);
      },
      keywords: ["ask", "ai", "query", "question", "search"],
    },
    {
      id: "analytics",
      label: "View Analytics",
      icon: <TrendingUp className="h-4 w-4" />,
      action: () => {
        setLocation("/analytics");
        setOpen(false);
      },
      keywords: ["analytics", "reports", "insights", "data", "metrics"],
    },
    {
      id: "meetings",
      label: "1:1 Meetings",
      icon: <Calendar className="h-4 w-4" />,
      action: () => {
        setLocation("/meetings");
        setOpen(false);
      },
      keywords: ["meetings", "1:1", "one-on-one", "prep"],
    },
    {
      id: "incentives",
      label: "Incentive Simulator",
      icon: <DollarSign className="h-4 w-4" />,
      action: () => {
        setLocation("/incentives");
        setOpen(false);
      },
      keywords: ["incentives", "compensation", "bonus", "payout", "simulator"],
    },
    {
      id: "reflections",
      label: "Self Reflections",
      icon: <FileText className="h-4 w-4" />,
      action: () => {
        setLocation("/reflections");
        setOpen(false);
      },
      keywords: ["reflections", "self", "journal", "thoughts"],
    },
    {
      id: "admin",
      label: "Admin Dashboard",
      icon: <Settings className="h-4 w-4" />,
      action: () => {
        setLocation("/admin");
        setOpen(false);
      },
      keywords: ["admin", "settings", "configuration", "manage"],
    },
  ];

  // Add people as searchable commands
  const peopleCommands: CommandAction[] =
    people?.map((person: any) => ({
      id: `person-${person.id}`,
      label: `Go to ${person.name}`,
      icon: <Users className="h-4 w-4" />,
      action: () => {
        setLocation(`/people/${person.id}`);
        setOpen(false);
      },
      keywords: [person.name.toLowerCase(), "person", "profile"],
    })) || [];

  const allCommands = [...commands, ...peopleCommands];

  // Filter commands based on search
  const filteredCommands = allCommands.filter((cmd) => {
    const searchLower = search.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(searchLower) ||
      cmd.keywords.some((keyword) => keyword.includes(searchLower))
    );
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 max-w-2xl">
        <div className="border-b">
          <div className="flex items-center gap-3 px-4 py-3">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Type a command or search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              autoFocus
            />
            <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
              <span className="text-xs">ESC</span>
            </kbd>
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No results found
            </div>
          ) : (
            <div className="space-y-1">
              {filteredCommands.slice(0, 10).map((cmd) => (
                <button
                  key={cmd.id}
                  onClick={cmd.action}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-accent transition-colors"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    {cmd.icon}
                  </div>
                  <span className="flex-1 font-medium">{cmd.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t px-4 py-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Press Cmd+K or Ctrl+K to toggle</span>
            <span>ESC to close</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
