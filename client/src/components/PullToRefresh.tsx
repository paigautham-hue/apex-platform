import { ReactNode } from "react";
import PullToRefreshComponent from "react-pull-to-refresh";
import { Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/useMobile";

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
}

export default function PullToRefresh({ children, onRefresh }: PullToRefreshProps) {
  const isMobile = useIsMobile();

  if (!isMobile) {
    return <>{children}</>;
  }

  const handleRefresh = async () => {
    await onRefresh();
  };

  return (
    <PullToRefreshComponent
      onRefresh={handleRefresh}
      resistance={2}
      className="pull-to-refresh-wrapper"
      icon={
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
      loading={
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      {children}
    </PullToRefreshComponent>
  );
}
