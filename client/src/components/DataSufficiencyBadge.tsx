import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, CheckCircle2, TrendingUp } from "lucide-react";

interface DataSufficiencyBadgeProps {
  level: 0 | 1 | 2 | 3 | 4;
  observationCount: number;
  uniqueSourceCount: number;
  showDetails?: boolean;
}

const LEVEL_CONFIG = {
  0: {
    label: "No Data",
    color: "bg-gray-500",
    textColor: "text-gray-700",
    icon: AlertCircle,
    description: "No observations recorded yet",
    progress: 0,
  },
  1: {
    label: "Minimal",
    color: "bg-red-500",
    textColor: "text-red-700",
    icon: AlertCircle,
    description: "1-4 observations from 1-2 sources",
    progress: 20,
  },
  2: {
    label: "Developing",
    color: "bg-amber-500",
    textColor: "text-amber-700",
    icon: TrendingUp,
    description: "5-9 observations from 2-3 sources",
    progress: 40,
  },
  3: {
    label: "Good",
    color: "bg-blue-500",
    textColor: "text-blue-700",
    icon: TrendingUp,
    description: "10-19 observations from 3-4 sources",
    progress: 70,
  },
  4: {
    label: "Excellent",
    color: "bg-green-500",
    textColor: "text-green-700",
    icon: CheckCircle2,
    description: "20+ observations from 4+ sources",
    progress: 100,
  },
};

export default function DataSufficiencyBadge({
  level,
  observationCount,
  uniqueSourceCount,
  showDetails = false,
}: DataSufficiencyBadgeProps) {
  const config = LEVEL_CONFIG[level];
  const Icon = config.icon;

  const content = (
    <div className="flex items-center gap-2">
      <Badge
        variant="outline"
        className={`${config.color} text-white border-transparent`}
      >
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
      {showDetails && (
        <span className="text-xs text-muted-foreground">
          {observationCount} obs • {uniqueSourceCount} sources
        </span>
      )}
    </div>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <div className="space-y-2">
          <div>
            <p className="font-medium">Data Sufficiency: Level {level}</p>
            <p className="text-xs text-muted-foreground">{config.description}</p>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Progress to next level</span>
              <span>{config.progress}%</span>
            </div>
            <Progress value={config.progress} className="h-1" />
          </div>
          <div className="text-xs space-y-1">
            <p>• {observationCount} total observations</p>
            <p>• {uniqueSourceCount} unique observers</p>
            {level < 4 && (
              <p className="text-muted-foreground italic">
                {level === 0 && "Add first observation to reach Level 1"}
                {level === 1 && "Need 5+ observations to reach Level 2"}
                {level === 2 && "Need 10+ observations to reach Level 3"}
                {level === 3 && "Need 20+ observations to reach Level 4"}
              </p>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
