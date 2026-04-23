/**
 * MobileBottomNav — role-aware bottom nav for mobile.
 *
 * Always visible: /me (your workspace) + /capture mic (primary action)
 * Conditional:
 *   - /team if viewer has direct reports OR is fund-wide
 *   - /group if viewer is fund-wide OR has org leadership
 * Plus: hamburger menu for everything else.
 */

import { useLocation } from "wouter";
import { User, UsersRound, Network, Mic, Menu } from "lucide-react";
import { useViewer, canAccessTeamView, canAccessGroupView } from "@/hooks/useViewer";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const SECONDARY_LINKS = [
  { path: "/today", label: "Today" },
  { path: "/people", label: "People" },
  { path: "/financial-cockpit", label: "Financial Cockpit" },
  { path: "/360", label: "360 Feedback" },
  { path: "/meetings", label: "Meetings" },
  { path: "/decisions", label: "Decisions" },
  { path: "/reflections", label: "Reflections" },
  { path: "/incentives", label: "Incentives" },
  { path: "/ask", label: "Ask AI" },
  { path: "/analytics", label: "Analytics" },
  { path: "/governance-admin", label: "Governance Admin" },
  { path: "/admin", label: "Admin" },
  { path: "/settings/notifications", label: "Notification Preferences" },
  { path: "/settings/access-grants", label: "Access Grants" },
];

export default function MobileBottomNav() {
  const [location, setLocation] = useLocation();
  const { viewer } = useViewer();
  const [menuOpen, setMenuOpen] = useState(false);

  const showTeam = canAccessTeamView(viewer?.tier, viewer && viewer.directReportPersonIds.length > 0);
  const showGroup = canAccessGroupView(viewer?.tier, viewer?.isFundWide);

  type Item = { path: string; icon: React.ComponentType<{ className?: string }>; label: string; primary?: boolean };
  const items: Item[] = [{ path: "/me", icon: User, label: "Me" }];
  if (showTeam) items.push({ path: "/team", icon: UsersRound, label: "Team" });
  if (showGroup) items.push({ path: "/group", icon: Network, label: "Group" });
  // Primary action — voice capture
  items.push({ path: "/capture?voice=true", icon: Mic, label: "Voice", primary: true });

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border z-40 safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16 px-1">
        {items.map(item => {
          const Icon = item.icon;
          const isActive = location === item.path.split("?")[0];
          if (item.primary) {
            return (
              <button
                key={item.path}
                onClick={() => setLocation(item.path)}
                className="flex flex-col items-center justify-center -mt-6"
                aria-label={item.label}
              >
                <div className="w-14 h-14 rounded-full bg-teal-600 hover:bg-teal-700 flex items-center justify-center shadow-lg">
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <span className="text-[10px] mt-0.5 font-medium text-teal-600">{item.label}</span>
              </button>
            );
          }
          return (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
              aria-label={item.label}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </button>
          );
        })}
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button
              className="flex flex-col items-center justify-center flex-1 h-full text-muted-foreground"
              aria-label="More"
            >
              <Menu className="h-5 w-5" />
              <span className="text-[10px] mt-0.5">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>All sections</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {SECONDARY_LINKS.map(link => (
                <Button
                  key={link.path}
                  variant="outline"
                  className="justify-start"
                  onClick={() => {
                    setLocation(link.path);
                    setMenuOpen(false);
                  }}
                >
                  {link.label}
                </Button>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
