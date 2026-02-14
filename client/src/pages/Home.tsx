import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { 
  Target, 
  Users, 
  TrendingUp, 
  Award, 
  Brain, 
  Shield 
} from "lucide-react";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect authenticated users to Today Feed
  useEffect(() => {
    if (isAuthenticated && !loading) {
      setLocation("/today");
    }
  }, [isAuthenticated, loading, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="skeleton h-8 w-48 mx-auto mb-4"></div>
          <div className="skeleton h-4 w-64 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto mb-16">
          <h1 className="text-5xl font-bold mb-6 text-foreground">
            APEX
          </h1>
          <p className="text-2xl mb-4 text-muted-foreground">
            AI-Powered Executive Excellence Platform
          </p>
          <p className="text-lg mb-8 text-muted-foreground max-w-2xl mx-auto">
            Transform how you manage performance, develop leaders, and drive organizational excellence 
            with AI-powered intelligence and evidence-based insights.
          </p>
          <div className="flex gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={() => window.location.href = getLoginUrl()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Get Started
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => window.location.href = getLoginUrl()}
            >
              Sign In
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <FeatureCard
            icon={<Brain className="h-8 w-8 text-accent" />}
            title="AI Intelligence"
            description="Synthesize observations into actionable insights. Get answers to complex questions about your organization."
          />
          <FeatureCard
            icon={<Target className="h-8 w-8 text-accent" />}
            title="Goal Cascading"
            description="Align strategy from portfolio to individual. Track progress with real-time metrics and driver trees."
          />
          <FeatureCard
            icon={<Users className="h-8 w-8 text-accent" />}
            title="Evidence-Based Reviews"
            description="Generate performance reviews from continuous observations. Reduce review time from hours to minutes."
          />
          <FeatureCard
            icon={<TrendingUp className="h-8 w-8 text-accent" />}
            title="Incentive Simulator"
            description="Model compensation scenarios in real-time. Understand the impact of performance on payouts."
          />
          <FeatureCard
            icon={<Award className="h-8 w-8 text-accent" />}
            title="Values Assessment"
            description="Track cultural fit with automated values scoring. Identify stars and values risks early."
          />
          <FeatureCard
            icon={<Shield className="h-8 w-8 text-accent" />}
            title="Multi-Tenant Security"
            description="Enterprise-grade data isolation. Complete audit trails. GDPR compliant from day one."
          />
        </div>

        {/* Key Benefits */}
        <div className="mt-20 max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Built for Executive Teams
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <BenefitCard
              title="For Chairmen & CEOs"
              items={[
                "Priority Zero card surfaces critical issues daily",
                "Cross-portfolio health at a glance",
                "Board-ready reports with one click"
              ]}
            />
            <BenefitCard
              title="For Managers"
              items={[
                "1:1 prep cards generated automatically",
                "Living review drafts save 80% of writing time",
                "Weekly pulse checks in under 2 minutes"
              ]}
            />
            <BenefitCard
              title="For Employees"
              items={[
                "Achievement suggestions from AI",
                "Transparent values profile with evidence",
                "Private reflection journal with trust ramp"
              ]}
            />
            <BenefitCard
              title="For CHROs"
              items={[
                "Async calibration reduces meeting time by 70%",
                "Configurable incentive structures",
                "Capability discovery across the organization"
              ]}
            />
          </div>
        </div>

        {/* CTA */}
        <div className="mt-20 text-center">
          <h2 className="text-3xl font-bold mb-6">
            Ready to Transform Your Organization?
          </h2>
          <Button 
            size="lg" 
            onClick={() => window.location.href = getLoginUrl()}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Start Your Journey
          </Button>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="card p-6 hover:shadow-lg transition-shadow">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

function BenefitCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="card p-6">
      <h3 className="text-xl font-semibold mb-4">{title}</h3>
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-start">
            <span className="text-accent mr-2">✓</span>
            <span className="text-muted-foreground">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
