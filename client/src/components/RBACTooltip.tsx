import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RBACTooltipProps {
  userRole: "CHAIRMAN" | "GROUP_CEO" | "GROUP_CHRO" | "CEO" | "CXO" | "CXO_PLUS_1" | "EMPLOYEE";
  dataType: "person_profile" | "observation" | "review" | "financial" | "goal" | "calibration";
  reason: string;
}

const ROLE_LABELS = {
  CHAIRMAN: "Chairman",
  GROUP_CEO: "Group CEO",
  GROUP_CHRO: "Group CHRO",
  CEO: "CEO",
  CXO: "CXO",
  CXO_PLUS_1: "CXO+1",
  EMPLOYEE: "Employee",
};

const DATA_TYPE_LABELS = {
  person_profile: "Person Profile",
  observation: "Observation",
  review: "Performance Review",
  financial: "Financial Data",
  goal: "Goal/Plan",
  calibration: "Calibration Session",
};

export default function RBACTooltip({ userRole, dataType, reason }: RBACTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
          <HelpCircle className="h-3 w-3 mr-1" />
          Why can I see this?
        </Button>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-600" />
            <p className="font-medium">Access Explanation</p>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Your Role:</span>
              <span className="font-medium">{ROLE_LABELS[userRole]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data Type:</span>
              <span className="font-medium">{DATA_TYPE_LABELS[dataType]}</span>
            </div>
          </div>

          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              <strong>Reason:</strong> {reason}
            </p>
          </div>

          <div className="pt-2 border-t text-xs text-muted-foreground">
            <p>
              If you believe this access is incorrect, you can{" "}
              <button className="text-blue-600 hover:underline">
                report/challenge access
              </button>
              .
            </p>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
