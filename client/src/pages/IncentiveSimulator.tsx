import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, Calculator } from "lucide-react";

export default function IncentiveSimulator() {
  const [baseSalary, setBaseSalary] = useState(1000000);
  const [targetBonus, setTargetBonus] = useState(30);
  const [achievement, setAchievement] = useState(100);
  
  // Calculate incentive based on achievement
  const calculateIncentive = () => {
    const targetBonusAmount = (baseSalary * targetBonus) / 100;
    
    let multiplier = 1;
    if (achievement < 80) {
      multiplier = 0;
    } else if (achievement < 100) {
      multiplier = (achievement - 80) / 20 * 0.5; // 0-50% for 80-100%
    } else if (achievement <= 120) {
      multiplier = 0.5 + ((achievement - 100) / 20 * 0.5); // 50-100% for 100-120%
    } else {
      multiplier = 1 + ((achievement - 120) / 30 * 0.5); // 100-150% for 120-150%
      multiplier = Math.min(multiplier, 1.5); // Cap at 150%
    }
    
    return targetBonusAmount * multiplier;
  };

  const incentiveAmount = calculateIncentive();
  const totalCompensation = baseSalary + incentiveAmount;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <DollarSign className="h-8 w-8 text-primary" />
          Incentive Simulator
        </h1>
        <p className="text-muted-foreground">
          Model compensation scenarios in real-time
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Input Parameters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Base Salary (₹)</Label>
              <Input
                type="number"
                value={baseSalary}
                onChange={(e) => setBaseSalary(Number(e.target.value))}
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label>Target Bonus (%)</Label>
              <Input
                type="number"
                value={targetBonus}
                onChange={(e) => setTargetBonus(Number(e.target.value))}
                min={0}
                max={100}
              />
            </div>

            <div className="space-y-2">
              <Label>Achievement (%)</Label>
              <Input
                type="number"
                value={achievement}
                onChange={(e) => setAchievement(Number(e.target.value))}
                min={0}
                max={200}
              />
              <input
                type="range"
                value={achievement}
                onChange={(e) => setAchievement(Number(e.target.value))}
                min={0}
                max={200}
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Base Salary</Label>
              <p className="text-2xl font-mono font-bold">
                ₹{baseSalary.toLocaleString('en-IN')}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Incentive Amount</Label>
              <p className="text-2xl font-mono font-bold text-green-600">
                +₹{Math.round(incentiveAmount).toLocaleString('en-IN')}
              </p>
              <p className="text-sm text-muted-foreground">
                {((incentiveAmount / baseSalary) * 100).toFixed(1)}% of base salary
              </p>
            </div>

            <div className="pt-4 border-t">
              <Label className="text-muted-foreground">Total Compensation</Label>
              <p className="text-3xl font-mono font-bold text-primary">
                ₹{Math.round(totalCompensation).toLocaleString('en-IN')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Slabs Explanation */}
      <Card>
        <CardHeader>
          <CardTitle>Incentive Slabs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-200">
              <span className="font-medium">&lt; 80% Achievement</span>
              <span className="font-bold text-red-700">0% Payout</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 border border-yellow-200">
              <span className="font-medium">80-100% Achievement</span>
              <span className="font-bold text-yellow-700">0-50% Payout</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
              <span className="font-medium">100-120% Achievement</span>
              <span className="font-bold text-green-700">50-100% Payout</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-200">
              <span className="font-medium">120-150% Achievement</span>
              <span className="font-bold text-blue-700">100-150% Payout</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tips */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Adjust the sliders to see real-time compensation changes</li>
            <li>• Achievement below 80% results in zero incentive payout</li>
            <li>• Maximum payout is capped at 150% of target bonus</li>
            <li>• Actual payouts may vary based on company policy and individual performance</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
