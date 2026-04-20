import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DollarSign } from "lucide-react";
import { useMemo } from "react";

const TENANT_ID = 1;

// Metric naming convention seeded by seed-evergreen.ts:
//   "<Metric> FY<YY>" e.g. "Revenue FY27", "EBITDA FY27", "PBT FY27"
// Actuals use periodType QUARTERLY for Q1-Q4, MONTHLY for YTD inputs,
// ANNUAL for full-year targets.

type Summary = {
  orgUnitId: number;
  metricName: string;
  actualValue: string | number | null;
  targetValue: string | number | null;
  periodType: "MONTHLY" | "QUARTERLY" | "ANNUAL" | "CUMULATIVE_YTD";
  periodDate: string | Date;
};

function toNumber(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function fmtCr(v: number | null): string {
  if (v == null) return "—";
  return `₹${v.toFixed(0)}`;
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

function varianceColor(pct: number | null) {
  if (pct == null) return "";
  const abs = Math.abs(pct);
  if (abs <= 5) return "text-emerald-700";
  if (abs <= 20) return "text-amber-700";
  return "text-red-700";
}

function varianceBadge(pct: number | null) {
  if (pct == null) return null;
  const abs = Math.abs(pct);
  if (abs <= 5) return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
  if (abs <= 20) return "bg-amber-500/15 text-amber-700 border-amber-500/30";
  return "bg-red-500/15 text-red-700 border-red-500/30";
}

export default function FinancialCockpit() {
  const { data: orgUnits } = trpc.tenant.listOrgUnits.useQuery({ tenantId: TENANT_ID });
  const { data: summaries } = trpc.governance.listFinancialSummaries.useQuery({
    tenantId: TENANT_ID,
  });

  const companies = useMemo(
    () => (orgUnits ?? []).filter((u) => u.type === "PORTFOLIO_COMPANY"),
    [orgUnits],
  );

  const byCompany = useMemo(() => {
    const map = new Map<number, Summary[]>();
    for (const s of (summaries ?? []) as Summary[]) {
      const list = map.get(s.orgUnitId) ?? [];
      list.push(s);
      map.set(s.orgUnitId, list);
    }
    return map;
  }, [summaries]);

  const companyMetrics = (orgUnitId: number) => {
    const rows = byCompany.get(orgUnitId) ?? [];
    // Pick the latest ANNUAL target for each metric name; sum QUARTERLY actuals
    const findAnnualTarget = (metricName: string): number | null => {
      const annual = rows
        .filter((r) => r.metricName === metricName && r.periodType === "ANNUAL")
        .sort((a, b) => new Date(b.periodDate).getTime() - new Date(a.periodDate).getTime())[0];
      return annual ? toNumber(annual.targetValue) : null;
    };

    const sumQuarterly = (metricName: string): { ytd: number | null; quarters: (number | null)[] } => {
      const quarterRows = rows
        .filter((r) => r.metricName === metricName && r.periodType === "QUARTERLY")
        .sort((a, b) => new Date(a.periodDate).getTime() - new Date(b.periodDate).getTime());
      const quarters: (number | null)[] = [null, null, null, null];
      let sum = 0;
      let any = false;
      for (let i = 0; i < Math.min(4, quarterRows.length); i++) {
        const v = toNumber(quarterRows[i].actualValue);
        quarters[i] = v;
        if (v != null) {
          sum += v;
          any = true;
        }
      }
      return { ytd: any ? sum : null, quarters };
    };

    const revBudget = findAnnualTarget("Revenue FY27");
    const revYtd = sumQuarterly("Revenue FY27");
    const ebitdaBudget = findAnnualTarget("EBITDA FY27");
    const ebitdaYtd = sumQuarterly("EBITDA FY27");
    const pbtBudget = findAnnualTarget("PBT FY27");
    const revLastYear = findAnnualTarget("Revenue FY26");

    const revVariance =
      revBudget != null && revYtd.ytd != null
        ? ((revYtd.ytd - revBudget) / revBudget) * 100
        : null;
    const yoy =
      revBudget != null && revLastYear != null && revLastYear > 0
        ? ((revBudget - revLastYear) / revLastYear) * 100
        : null;
    const ebitdaPct =
      revBudget != null && ebitdaBudget != null && revBudget > 0
        ? (ebitdaBudget / revBudget) * 100
        : null;

    return {
      revBudget,
      revLastYear,
      yoy,
      revYtd: revYtd.ytd,
      revQuarters: revYtd.quarters,
      revVariance,
      ebitdaBudget,
      ebitdaPct,
      ebitdaYtd: ebitdaYtd.ytd,
      ebitdaQuarters: ebitdaYtd.quarters,
      pbtBudget,
    };
  };

  const totals = useMemo(() => {
    let revBudget = 0;
    let revYtd = 0;
    let ebitdaBudget = 0;
    let ebitdaYtd = 0;
    let pbtBudget = 0;
    let any = false;
    for (const c of companies) {
      const m = companyMetrics(c.id);
      if (m.revBudget != null) {
        revBudget += m.revBudget;
        any = true;
      }
      if (m.revYtd != null) revYtd += m.revYtd;
      if (m.ebitdaBudget != null) ebitdaBudget += m.ebitdaBudget;
      if (m.ebitdaYtd != null) ebitdaYtd += m.ebitdaYtd;
      if (m.pbtBudget != null) pbtBudget += m.pbtBudget;
    }
    const variance =
      revBudget > 0 && revYtd > 0 ? ((revYtd - revBudget) / revBudget) * 100 : null;
    return any
      ? { revBudget, revYtd, ebitdaBudget, ebitdaYtd, pbtBudget, variance }
      : null;
  }, [companies, summaries]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
          <DollarSign className="h-7 w-7" />
          Financial Cockpit
        </h1>
        <p className="text-muted-foreground">
          FY27 budget vs YTD actuals across all portfolio companies. Figures in ₹ Crore.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Portfolio Financials — FY27</CardTitle>
        </CardHeader>
        <CardContent>
          {companies.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No portfolio companies found. Run the Evergreen Fund seed script to populate.
            </p>
          )}
          {companies.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead className="text-right">FY26 Rev</TableHead>
                    <TableHead className="text-right">FY27 Budget</TableHead>
                    <TableHead className="text-right">YoY%</TableHead>
                    <TableHead className="text-right">EBITDA</TableHead>
                    <TableHead className="text-right">EBITDA%</TableHead>
                    <TableHead className="text-right">PBT</TableHead>
                    <TableHead className="text-right">Q1</TableHead>
                    <TableHead className="text-right">Q2</TableHead>
                    <TableHead className="text-right">Q3</TableHead>
                    <TableHead className="text-right">Q4</TableHead>
                    <TableHead className="text-right">YTD Actual</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((company) => {
                    const m = companyMetrics(company.id);
                    return (
                      <TableRow key={company.id}>
                        <TableCell className="font-medium">{company.name}</TableCell>
                        <TableCell className="text-right">{fmtCr(m.revLastYear)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmtCr(m.revBudget)}</TableCell>
                        <TableCell className={`text-right ${varianceColor(m.yoy)}`}>
                          {fmtPct(m.yoy)}
                        </TableCell>
                        <TableCell className="text-right">{fmtCr(m.ebitdaBudget)}</TableCell>
                        <TableCell className="text-right">{fmtPct(m.ebitdaPct)}</TableCell>
                        <TableCell className="text-right">{fmtCr(m.pbtBudget)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {fmtCr(m.revQuarters[0])}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {fmtCr(m.revQuarters[1])}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {fmtCr(m.revQuarters[2])}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {fmtCr(m.revQuarters[3])}
                        </TableCell>
                        <TableCell className="text-right">{fmtCr(m.revYtd)}</TableCell>
                        <TableCell className="text-right">
                          {m.revVariance == null ? (
                            "—"
                          ) : (
                            <Badge className={varianceBadge(m.revVariance) ?? ""}>
                              {fmtPct(m.revVariance)}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {totals && (
                    <TableRow className="font-bold border-t-2">
                      <TableCell>Group Total</TableCell>
                      <TableCell className="text-right">—</TableCell>
                      <TableCell className="text-right">{fmtCr(totals.revBudget)}</TableCell>
                      <TableCell className="text-right">—</TableCell>
                      <TableCell className="text-right">{fmtCr(totals.ebitdaBudget)}</TableCell>
                      <TableCell className="text-right">
                        {totals.revBudget > 0
                          ? fmtPct((totals.ebitdaBudget / totals.revBudget) * 100)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">{fmtCr(totals.pbtBudget)}</TableCell>
                      <TableCell className="text-right">—</TableCell>
                      <TableCell className="text-right">—</TableCell>
                      <TableCell className="text-right">—</TableCell>
                      <TableCell className="text-right">—</TableCell>
                      <TableCell className="text-right">{fmtCr(totals.revYtd)}</TableCell>
                      <TableCell className="text-right">
                        {totals.variance == null ? (
                          "—"
                        ) : (
                          <Badge className={varianceBadge(totals.variance) ?? ""}>
                            {fmtPct(totals.variance)}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        Color bands: green ≤5% variance, amber 5–20%, red &gt;20%. Actuals entry UI (CEO-only,
        per-company) arrives in the next iteration — for now actuals flow in via the financial
        upload pipeline and direct metricValues writes.
      </div>
    </div>
  );
}
