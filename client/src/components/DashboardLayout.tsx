import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import NotificationCenter from "./NotificationCenter";
import { Home, Users, Target, BarChart3, MessageSquare, Calendar, Settings, LogOut, PanelLeft, Plus, Brain, FileText, DollarSign, Lightbulb, Anchor, Palmtree, Ship, Settings2, UsersRound, Bell, ShieldAlert, KeyRound, ChevronDown, User as UserIcon, Network, Mic } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { useViewer, canAccessTeamView, canAccessGroupView } from "@/hooks/useViewer";

// Primary fractal nav (always visible, conditionally enabled)
const primaryNav = [
  { icon: UserIcon, label: "Me", path: "/me", always: true },
  { icon: UsersRound, label: "Team", path: "/team", requiresTeam: true },
  { icon: Network, label: "Group", path: "/group", requiresGroup: true },
];

// Action nav — quick capture
const actionNav = [
  { icon: Mic, label: "Capture", path: "/capture?voice=true" },
];

// Secondary nav — everything else, grouped
const secondaryNav = [
  { icon: Home, label: "Today", path: "/today" },
  { icon: Users, label: "People", path: "/people" },
  { icon: DollarSign, label: "Financial Cockpit", path: "/financial-cockpit" },
  { icon: UsersRound, label: "360 Feedback", path: "/360" },
  { icon: Calendar, label: "Meetings", path: "/meetings" },
  { icon: Brain, label: "AI Ask", path: "/ask" },
  { icon: Target, label: "Goals", path: "/goals" },
  { icon: BarChart3, label: "Analytics", path: "/analytics" },
  { icon: DollarSign, label: "Incentives", path: "/incentives" },
  { icon: Lightbulb, label: "Reflections", path: "/reflections" },
  { icon: FileText, label: "Decisions", path: "/decisions" },
];

const adminNav = [
  { icon: Settings2, label: "Governance Admin", path: "/governance-admin" },
  { icon: Settings, label: "Admin", path: "/admin" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  const [, navigate] = useLocation();

  // Check if onboarding is needed. `retry: 1` so a single flaky preferences
  // call doesn't keep `isLoading` true through 3+ retries and leave users
  // staring at the skeleton.
  const { data: onboardingStatus, isLoading: onboardingLoading } =
    trpc.preferences.checkOnboarding.useQuery(undefined, { enabled: !!user, retry: 1 });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  useEffect(() => {
    // Only redirect when we have an *explicit* "not completed" response from
    // the backend. If the query errored or returned null, stay on the current
    // page — existing users (pre-onboarding-feature) have no preferences row
    // and should not be bounced into a wizard they've already finished.
    if (!user) return;
    if (onboardingLoading) return;
    if (onboardingStatus && onboardingStatus.completed === false) {
      navigate("/onboarding");
    }
  }, [user, onboardingLoading, onboardingStatus, navigate]);

  // Only gate on the auth check. The onboarding query is allowed to resolve
  // in the background; if it eventually returns "not completed", the effect
  // above redirects. A flaky preferences call should not keep the skeleton
  // on screen indefinitely.
  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Sign in to continue
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Access to this dashboard requires authentication. Continue to launch the login flow.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

const settingsSubItems = [
  { icon: Bell, label: "Notifications", path: "/settings/notifications" },
  { icon: KeyRound, label: "Access Grants", path: "/settings/access-grants" },
  { icon: ShieldAlert, label: "Access Challenge", path: "/settings/access-challenge" },
];

function SettingsSubmenu({
  location,
  setLocation,
  isCollapsed,
}: {
  location: string;
  setLocation: (path: string) => void;
  isCollapsed: boolean;
}) {
  const isSettingsActive = settingsSubItems.some((i) => i.path === location);
  const [open, setOpen] = useState(isSettingsActive);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isSettingsActive && isCollapsed}
        onClick={() => {
          if (isCollapsed) {
            // When collapsed, only navigate if we're not already on a
            // settings subpage. This prevents clicking Settings from bouncing
            // the user off /settings/access-grants back to /settings/notifications.
            if (!isSettingsActive) {
              setLocation("/settings/notifications");
            }
          } else {
            setOpen((o) => !o);
          }
        }}
        tooltip="Settings"
        className="h-10 transition-all font-normal"
      >
        <Settings className={`h-4 w-4 ${isSettingsActive ? "text-primary" : ""}`} />
        <span className="flex-1">Settings</span>
        {!isCollapsed && (
          <ChevronDown
            className={`h-3 w-3 text-muted-foreground transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        )}
      </SidebarMenuButton>

      {/* Sub-items — only visible when expanded */}
      {open && !isCollapsed && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border/50 pl-3">
          {settingsSubItems.map((sub) => {
            const isActive = location === sub.path;
            return (
              <button
                key={sub.path}
                onClick={() => setLocation(sub.path)}
                className={`flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }`}
              >
                <sub.icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-primary" : ""}`} />
                {sub.label}
              </button>
            );
          })}
        </div>
      )}
    </SidebarMenuItem>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const allItems = [...primaryNav, ...actionNav, ...secondaryNav, ...adminNav];
  const activeMenuItem = allItems.find(item => item.path === location);
  const isMobile = useIsMobile();
  const { viewer } = useViewer();
  const showTeam = canAccessTeamView(viewer?.tier, viewer && viewer.directReportPersonIds.length > 0);
  const showGroup = canAccessGroupView(viewer?.tier, viewer?.isFundWide);

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold tracking-tight truncate">
                    Navigation
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            {/* Primary fractal nav */}
            <SidebarMenu className="px-2 py-1">
              {primaryNav
                .filter(item => {
                  if (item.always) return true;
                  if (item.requiresTeam) return showTeam;
                  if (item.requiresGroup) return showGroup;
                  return true;
                })
                .map(item => {
                  const isActive = location === item.path;
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => setLocation(item.path)}
                        tooltip={item.label}
                        className="h-10 transition-all font-medium"
                      >
                        <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
            </SidebarMenu>

            {/* Action: voice capture */}
            <SidebarMenu className="px-2 py-1 border-t border-border/50 mt-2">
              {actionNav.map(item => {
                const isActive = location === item.path.split("?")[0];
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-10 transition-all font-medium text-teal-600 dark:text-teal-400"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            {/* Secondary nav */}
            <SidebarMenu className="px-2 py-1 border-t border-border/50 mt-2">
              {secondaryNav.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-9 transition-all font-normal"
                    >
                      <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {/* Settings Submenu */}
              <SettingsSubmenu location={location} setLocation={setLocation} isCollapsed={isCollapsed} />
            </SidebarMenu>

            {/* Admin nav */}
            <SidebarMenu className="px-2 py-1 border-t border-border/50 mt-2">
              {adminNav.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-9 transition-all font-normal text-muted-foreground"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? "Menu"}
                  </span>
                </div>
              </div>
            </div>
            <NotificationCenter />
          </div>
        )}
        <main className="flex-1 p-4">{children}</main>
      </SidebarInset>
    </>
  );
}
