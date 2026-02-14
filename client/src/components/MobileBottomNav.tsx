import { useLocation } from "wouter";
import { Home, Users, Plus, User } from "lucide-react";

export default function MobileBottomNav() {
  const [location, setLocation] = useLocation();

  const navItems = [
    { path: "/today", icon: Home, label: "Today" },
    { path: "/people", icon: Users, label: "People" },
    { path: "/capture", icon: Plus, label: "Capture", primary: true },
    { path: "/profile", icon: User, label: "Me" },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border z-50 safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;
          
          if (item.primary) {
            return (
              <button
                key={item.path}
                onClick={() => setLocation(item.path)}
                className="flex flex-col items-center justify-center -mt-6"
              >
                <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg">
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <span className="text-xs mt-1 font-medium text-primary">
                  {item.label}
                </span>
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
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs mt-1">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
