/**
 * PACE Document Parser
 * Extracts structured data from PACE self-appraisal Word documents.
 * Handles both the blank CXO template and filled CEO/CXO forms.
 */

import mammoth from "mammoth";

export interface PaceKpiRow {
  orgUnit?: string;
  goalName?: string;
  goalObjective?: string;
  weightage?: string;
  employeeSelfAppraisal?: string;
  appraiserComments?: string;
}

export interface PaceFinancialRow {
  lineItem?: string;
  fy25Actual?: string;
  fy26Aop?: string;
  fy26Actual?: string;
  varVsAop?: string;
}

export interface PaceExtractedData {
  header?: {
    name?: string;
    company?: string;
    designation?: string;
    quadrant?: string;
    date?: string;
    fiscalYear?: string;
  };
  kpiRows?: PaceKpiRow[];
  financialTable?: PaceFinancialRow[];
  developmentGoals?: string[];
  employeeOverallComments?: string;
  appraiserOverallComments?: string;
  rawText?: string;
}

/**
 * Parse a PACE Word document buffer and extract structured data.
 */
export async function parsePaceDocument(buffer: Buffer): Promise<PaceExtractedData> {
  // Extract raw text using mammoth
  const result = await mammoth.extractRawText({ buffer });
  const rawText = result.value;

  const extracted: PaceExtractedData = { rawText };

  // --- Extract header info ---
  const header: PaceExtractedData["header"] = {};
  
  const nameMatch = rawText.match(/Name\s*[:|]\s*([^\n]+)/i);
  if (nameMatch) header.name = nameMatch[1].trim();
  
  const companyMatch = rawText.match(/Company\s*(?:Name)?\s*[:|]\s*([^\n]+)/i);
  if (companyMatch) header.company = companyMatch[1].trim();
  
  const designationMatch = rawText.match(/Designation\s*[:|]\s*([^\n]+)/i);
  if (designationMatch) header.designation = designationMatch[1].trim();
  
  const quadrantMatch = rawText.match(/(?:Company\s+)?Quadrant\s*[:|]\s*([^\n]+)/i);
  if (quadrantMatch) header.quadrant = quadrantMatch[1].trim();
  
  const dateMatch = rawText.match(/Date\s*(?:of\s*Review)?\s*[:|]\s*([^\n]+)/i);
  if (dateMatch) header.date = dateMatch[1].trim();

  // Detect fiscal year from document
  const fyMatch = rawText.match(/FY\s*(\d{2,4}[-–]\d{2,4})/i);
  if (fyMatch) header.fiscalYear = `FY ${fyMatch[1]}`;

  extracted.header = header;

  // --- Extract development goals ---
  const devGoals: string[] = [];
  const devSection = rawText.match(/Leadership Development Plan[^]*?(?=Overall Comments|$)/i);
  if (devSection) {
    const goalMatches = Array.from(devSection[0].matchAll(/\d+\.\s*([^\n]+)/g));
    for (const m of goalMatches) {
      const goal = m[1].trim();
      if (goal && goal.length > 5 && !goal.startsWith("_")) {
        devGoals.push(goal);
      }
    }
  }
  if (devGoals.length > 0) extracted.developmentGoals = devGoals;

  // --- Extract overall comments ---
  // Look for employee overall comments (text after "Overall Comments" section)
  const overallSection = rawText.match(/Overall Comments[^]*$/i);
  if (overallSection) {
    const text = overallSection[0].replace(/Overall Comments/i, "").trim();
    // Split into employee and appraiser parts if both present
    const lines = text.split("\n").filter(l => l.trim().length > 20);
    if (lines.length > 0) {
      extracted.employeeOverallComments = lines[0].trim();
      if (lines.length > 1) {
        extracted.appraiserOverallComments = lines[1].trim();
      }
    }
  }

  // --- Extract KPI rows from text patterns ---
  // The PACE form has rows: Org Unit | Goal Name | Goal Objective | Weightage | Self Appraisal | Appraiser Comments
  // We extract goals by looking for weightage patterns like "30%", "20%", "10%"
  const kpiRows: PaceKpiRow[] = [];
  
  // Find sections with weightage percentages — these are KPI rows
  const kpiPattern = /([A-Z][^\n]{3,50})\s*\|\s*([^\n]{3,100})\s*\|\s*([^\n]{3,200})\s*\|\s*(\d+%)\s*\|\s*([^\n]{10,})/g;
  const kpiMatches = Array.from(rawText.matchAll(kpiPattern));
  for (const m of kpiMatches) {
    kpiRows.push({
      orgUnit: m[1].trim(),
      goalName: m[2].trim(),
      goalObjective: m[3].trim(),
      weightage: m[4].trim(),
      employeeSelfAppraisal: m[5].trim(),
    });
  }

  // Fallback: look for goal names followed by self-appraisal text
  if (kpiRows.length === 0) {
    // Try to find goal blocks by looking for percentage patterns
    const goalBlocks = rawText.split(/\n(?=\w)/);
    for (const block of goalBlocks) {
      const weightMatch = block.match(/(\d+)%/);
      if (weightMatch && block.length > 50) {
        const lines = block.split("\n").filter(l => l.trim());
        if (lines.length >= 2) {
          kpiRows.push({
            goalName: lines[0].trim(),
            weightage: `${weightMatch[1]}%`,
            employeeSelfAppraisal: lines.slice(1).join(" ").trim(),
          });
        }
      }
    }
  }

  if (kpiRows.length > 0) extracted.kpiRows = kpiRows;

  // --- Extract financial table ---
  const financialRows: PaceFinancialRow[] = [];
  const financialSection = rawText.match(/(?:LINE ITEM|Financial Achievements)[^]*?(?=Individual Development|$)/i);
  if (financialSection) {
    const lines = financialSection[0].split("\n").filter(l => l.trim());
    for (const line of lines) {
      // Look for lines with financial data (₹ or numbers with Cr)
      if (line.includes("₹") || line.match(/\d+[\.,]\d+\s*Cr/i) || line.match(/\|\s*[\d\-\+]/)) {
        const parts = line.split(/\s{2,}|\t|\|/).map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          financialRows.push({
            lineItem: parts[0],
            fy25Actual: parts[1],
            fy26Aop: parts[2],
            fy26Actual: parts[3],
            varVsAop: parts[4],
          });
        }
      }
    }
  }
  if (financialRows.length > 0) extracted.financialTable = financialRows;

  return extracted;
}
