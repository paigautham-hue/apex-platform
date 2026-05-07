/**
 * PACE Document Parser
 * Extracts structured data from PACE self-appraisal Word documents.
 * Handles both the blank CXO template and filled CEO/CXO forms.
 *
 * The PACE template uses a Word table that mammoth flattens to plain text.
 * Each KPI row looks like:
 *   <number>
 *   <Goal Name>
 *   <Goal Objective>
 *   <Weightage>%
 *   <Employee Self Appraisal text>
 *   <Appraiser Comments text>   (may be empty)
 */

import mammoth from "mammoth";

export interface PaceKpiRow {
  rowNumber?: string;
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

  const nameMatch = rawText.match(/Name\s*\n([^\n]+)/i);
  if (nameMatch) header.name = nameMatch[1].trim();

  const companyMatch = rawText.match(/Company\s*(?:Name)?\s*\n([^\n]+)/i);
  if (companyMatch) header.company = companyMatch[1].trim();

  const designationMatch = rawText.match(/Designation\s*\n([^\n]+)/i);
  if (designationMatch) header.designation = designationMatch[1].trim();

  const quadrantMatch = rawText.match(/(?:Company\s+)?Quadrant\s*\n([^\n]+)/i);
  if (quadrantMatch) header.quadrant = quadrantMatch[1].trim();

  const dateMatch = rawText.match(/Date\s*(?:of\s*Review)?\s*\n([^\n]+)/i);
  if (dateMatch) header.date = dateMatch[1].trim();

  // Detect fiscal year from document
  const fyMatch = rawText.match(/FY\s*(\d{2,4}[-–]\d{2,4})/i);
  if (fyMatch) header.fiscalYear = `FY ${fyMatch[1]}`;

  extracted.header = header;

  // --- Extract KPI rows ---
  // Strategy 1: pipe-delimited (some templates)
  const kpiRows: PaceKpiRow[] = [];
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

  // Strategy 2: plain-text table rows (mammoth flattens Word tables to newlines)
  // Pattern: a row number alone on a line, followed by goal name, objective, weightage%, self-appraisal
  if (kpiRows.length === 0) {
    // Find the financial/performance section
    // Look for numbered rows: line = "1", "2", "3" etc. followed by goal data
    const lines = rawText.split("\n").map(l => l.trim());

    let i = 0;
    while (i < lines.length) {
      // A row starts with a standalone number (1-20)
      if (/^\d{1,2}$/.test(lines[i])) {
        const rowNum = lines[i];
        // Collect the next non-empty lines
        const rowLines: string[] = [];
        let j = i + 1;
        // Gather up to 8 non-empty lines or until next row number
        while (j < lines.length && rowLines.length < 8) {
          const l = lines[j];
          if (/^\d{1,2}$/.test(l) && rowLines.length >= 2) break; // next row
          if (l.length > 0) rowLines.push(l);
          j++;
        }

        // We need at least: goalName, goalObjective, weightage%, selfAppraisal
        if (rowLines.length >= 3) {
          // Find weightage line (contains %)
          const weightIdx = rowLines.findIndex(l => /^\d+%$/.test(l) || /^(\d+)%/.test(l));
          if (weightIdx >= 0) {
            const goalName = rowLines.slice(0, weightIdx).filter(l => !/^\d+%$/.test(l)).join(" ").trim();
            const weightage = rowLines[weightIdx].match(/(\d+%)/)?.[1] ?? "";
            // Everything after weightage is self-appraisal (and possibly appraiser comments)
            const afterWeight = rowLines.slice(weightIdx + 1);
            // Split self-appraisal from appraiser comments if there's a clear break
            // (appraiser comments are usually shorter and come after a blank-ish separator)
            const selfAppraisal = afterWeight.join(" ").trim();

            if (goalName.length > 2) {
              kpiRows.push({
                rowNumber: rowNum,
                goalName,
                weightage,
                employeeSelfAppraisal: selfAppraisal || undefined,
              });
            }
          }
        }
        i = j;
      } else {
        i++;
      }
    }
  }

  // Strategy 3: look for goal blocks by percentage patterns (last resort)
  if (kpiRows.length === 0) {
    const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const weightMatch = lines[i].match(/^(\d+)%$/);
      if (weightMatch && i > 0) {
        const goalName = lines[i - 1];
        const selfAppraisal = lines.slice(i + 1, i + 4).join(" ").trim();
        if (goalName.length > 3 && !goalName.match(/^\d+$/)) {
          kpiRows.push({
            goalName,
            weightage: `${weightMatch[1]}%`,
            employeeSelfAppraisal: selfAppraisal || undefined,
          });
        }
      }
    }
  }

  if (kpiRows.length > 0) extracted.kpiRows = kpiRows;

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
  const overallSection = rawText.match(/Overall Comments[^]*$/i);
  if (overallSection) {
    const text = overallSection[0].replace(/Overall Comments/i, "").trim();
    const lines = text.split("\n").filter(l => l.trim().length > 20);
    if (lines.length > 0) {
      extracted.employeeOverallComments = lines[0].trim();
      if (lines.length > 1) {
        extracted.appraiserOverallComments = lines[1].trim();
      }
    }
  }

  // --- Extract financial table ---
  const financialRows: PaceFinancialRow[] = [];
  const financialSection = rawText.match(/(?:LINE ITEM|Financial Achievements)[^]*?(?=Individual Development|$)/i);
  if (financialSection) {
    const lines = financialSection[0].split("\n").filter(l => l.trim());
    for (const line of lines) {
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
