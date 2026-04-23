import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import CommandPalette from "./components/CommandPalette";
import FloatingActionButton from "./components/FloatingActionButton";
import MobileBottomNav from "@/components/MobileBottomNav";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import TodayFeed from "./pages/TodayFeed";
import People from "./pages/People";
import PersonProfile from "./pages/PersonProfile";
import Capture from "./pages/Capture";
import Goals from "./pages/Goals";
import Analytics from "./pages/Analytics";
import IncentiveSimulator from "./pages/IncentiveSimulator";
import Reflections from "./pages/Reflections";
import Decisions from "./pages/Decisions";
import Meetings from "./pages/Meetings";
import AskInterface from "./pages/AskInterface";
import Admin from "./pages/Admin";
import EvidenceUpload from "./pages/EvidenceUpload";
import WeeklyPulseCheck from "./pages/WeeklyPulseCheck";
import ReviewDraftPreview from "./pages/ReviewDraftPreview";
import NotificationPreferences from "./pages/NotificationPreferences";
import AccessChallenge from "./pages/AccessChallenge";
import AccessGrants from "./pages/AccessGrants";
import MyBridge from "./pages/MyBridge";
import MyIsland from "./pages/MyIsland";
import ChairmanDashboard from "./pages/ChairmanDashboard";
import ChairmanAssess from "./pages/ChairmanAssess";
import GovernanceAdmin from "./pages/GovernanceAdmin";
import ThreeSixty from "./pages/ThreeSixty";
import FinancialCockpit from "./pages/FinancialCockpit";
import Onboarding from "./pages/Onboarding";
import Me from "./pages/Me";
import Team from "./pages/Team";
import Group from "./pages/Group";

function Router() {
  return (
    <Switch>
      {/* Public landing page */}
      <Route path="/" component={Home} />
      
      {/* Onboarding wizard - full screen, no sidebar */}
      <Route path="/onboarding" component={Onboarding} />
      
      {/* Dashboard routes - wrapped in DashboardLayout */}
      <Route path="/today">
        <DashboardLayout>
          <TodayFeed />
        </DashboardLayout>
      </Route>

      {/* Universal fractal pages — same UI, role-scoped data */}
      <Route path="/me">
        <DashboardLayout>
          <Me />
        </DashboardLayout>
      </Route>

      <Route path="/team">
        <DashboardLayout>
          <Team />
        </DashboardLayout>
      </Route>

      <Route path="/group">
        <DashboardLayout>
          <Group />
        </DashboardLayout>
      </Route>

      {/* Legacy routes — kept for direct links; render existing pages */}
      <Route path="/my-bridge">
        <DashboardLayout>
          <MyBridge />
        </DashboardLayout>
      </Route>

      <Route path="/my-island">
        <DashboardLayout>
          <MyIsland />
        </DashboardLayout>
      </Route>

      <Route path="/chairman">
        <DashboardLayout>
          <ChairmanDashboard />
        </DashboardLayout>
      </Route>

      <Route path="/chairman/assess">
        <DashboardLayout>
          <ChairmanAssess />
        </DashboardLayout>
      </Route>

      <Route path="/governance-admin">
        <DashboardLayout>
          <GovernanceAdmin />
        </DashboardLayout>
      </Route>

      <Route path="/360">
        <DashboardLayout>
          <ThreeSixty />
        </DashboardLayout>
      </Route>

      <Route path="/financial-cockpit">
        <DashboardLayout>
          <FinancialCockpit />
        </DashboardLayout>
      </Route>
      
      <Route path="/people">
        <DashboardLayout>
          <People />
        </DashboardLayout>
      </Route>
      
      <Route path="/people/:personId">
        {(params) => (
          <DashboardLayout>
            <PersonProfile personId={parseInt(params.personId)} />
          </DashboardLayout>
        )}
      </Route>
      
      <Route path="/capture">
        <DashboardLayout>
          <Capture />
        </DashboardLayout>
      </Route>
      
      <Route path="/goals">
        <DashboardLayout>
          <Goals />
        </DashboardLayout>
      </Route>
      
      <Route path="/analytics">
        <DashboardLayout>
          <Analytics />
        </DashboardLayout>
      </Route>
      
      <Route path="/incentives">
        <DashboardLayout>
          <IncentiveSimulator />
        </DashboardLayout>
      </Route>
      
      <Route path="/reflections">
        <DashboardLayout>
          <Reflections />
        </DashboardLayout>
      </Route>
      
      <Route path="/decisions">
        <DashboardLayout>
          <Decisions />
        </DashboardLayout>
      </Route>
      
      <Route path="/meetings">
        <DashboardLayout>
          <Meetings />
        </DashboardLayout>
      </Route>
      
      <Route path="/ask">
        <DashboardLayout>
          <AskInterface />
        </DashboardLayout>
      </Route>
      
      <Route path="/admin">
        <DashboardLayout>
          <Admin />
        </DashboardLayout>
      </Route>
      
      <Route path="/evidence">
        <DashboardLayout>
          <EvidenceUpload />
        </DashboardLayout>
      </Route>
        <Route path="/pulse">
        {() => (
          <DashboardLayout>
            <WeeklyPulseCheck />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/reviews/draft/:personId">
        {() => (
          <DashboardLayout>
            <ReviewDraftPreview />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/settings/notifications">
        <DashboardLayout>
          <NotificationPreferences />
        </DashboardLayout>
      </Route>
      <Route path="/settings/access-challenge">
        <DashboardLayout>
          <AccessChallenge />
        </DashboardLayout>
      </Route>
      <Route path="/settings/access-grants">
        <DashboardLayout>
          <AccessGrants />
        </DashboardLayout>
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
      >
        <TooltipProvider>
          <Toaster />
      <CommandPalette />
      <FloatingActionButton />
      <Router />
          <MobileBottomNav />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;