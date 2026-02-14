/**
 * AI-Powered File Extraction Service
 * Extracts observations, metrics, and person mentions from uploaded files
 */

import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";

export type FileType = "excel" | "powerpoint" | "pdf" | "image" | "document" | "unknown";

export type ExtractionResult = {
  observations: Array<{
    personName: string;
    text: string;
    category: string;
    confidence: number;
  }>;
  metrics: Array<{
    name: string;
    value: number;
    unit: string;
    period: string;
    confidence: number;
  }>;
  summary: string;
  fileType: FileType;
  extractedText: string;
};

/**
 * Detect file type from MIME type
 */
export function detectFileType(mimeType: string): FileType {
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) {
    return "excel";
  }
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) {
    return "powerpoint";
  }
  if (mimeType.includes("pdf")) {
    return "pdf";
  }
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  if (mimeType.includes("document") || mimeType.includes("word")) {
    return "document";
  }
  return "unknown";
}

/**
 * Upload file to S3 and return URL
 */
export async function uploadFile(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  tenantId: number
): Promise<{ url: string; key: string }> {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(7);
  const fileKey = `tenant-${tenantId}/evidence/${timestamp}-${randomSuffix}-${fileName}`;
  
  const result = await storagePut(fileKey, fileBuffer, mimeType);
  
  return {
    url: result.url,
    key: fileKey
  };
}

/**
 * Extract text content from file using AI vision/document understanding
 */
export async function extractTextFromFile(
  fileUrl: string,
  fileType: FileType,
  mimeType: string
): Promise<string> {
  // For images and PDFs, use vision capabilities
  if (fileType === "image" || fileType === "pdf") {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "Extract all text content from this image or document. Include any tables, charts, or data visible."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please extract all text from this file:"
            },
            {
              type: "image_url",
              image_url: {
                url: fileUrl,
                detail: "high"
              }
            }
          ]
        }
      ]
    });
    
    const content = response.choices[0]?.message?.content;
    return typeof content === 'string' ? content : "";
  }
  
  // For other file types, we'd need additional processing
  // For now, return a placeholder
  return "Text extraction for this file type requires additional processing.";
}

/**
 * Extract observations and metrics from text using AI
 */
export async function extractObservationsAndMetrics(
  text: string,
  fileType: FileType
): Promise<ExtractionResult> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are an AI assistant that extracts performance observations and metrics from business documents.

Extract:
1. Observations: Any mentions of people's performance, achievements, or behaviors
2. Metrics: Any numerical KPIs, targets, or measurements
3. Summary: A brief summary of the document

For observations, identify:
- Person name (if mentioned)
- The observation text
- Category (achievement, behavior, skill, etc.)
- Confidence (0-1)

For metrics, identify:
- Metric name
- Value (number only)
- Unit (%, ₹, units, etc.)
- Period (Q1 2024, Jan 2024, etc.)
- Confidence (0-1)`
      },
      {
        role: "user",
        content: `Extract observations and metrics from this ${fileType} content:\n\n${text}`
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "extraction_result",
        strict: true,
        schema: {
          type: "object",
          properties: {
            observations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  personName: { type: "string" },
                  text: { type: "string" },
                  category: { type: "string" },
                  confidence: { type: "number" }
                },
                required: ["personName", "text", "category", "confidence"],
                additionalProperties: false
              }
            },
            metrics: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  value: { type: "number" },
                  unit: { type: "string" },
                  period: { type: "string" },
                  confidence: { type: "number" }
                },
                required: ["name", "value", "unit", "period", "confidence"],
                additionalProperties: false
              }
            },
            summary: { type: "string" }
          },
          required: ["observations", "metrics", "summary"],
          additionalProperties: false
        }
      }
    }
  });

  const content = response.choices[0]?.message?.content;
  const parsed = JSON.parse(typeof content === 'string' ? content : "{}");
  
  return {
    ...parsed,
    fileType,
    extractedText: text
  };
}

/**
 * Complete file processing pipeline
 */
export async function processUploadedFile(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  tenantId: number
): Promise<{
  fileUrl: string;
  fileKey: string;
  extraction: ExtractionResult;
}> {
  // Step 1: Detect file type
  const fileType = detectFileType(mimeType);
  
  // Step 2: Upload to S3
  const { url, key } = await uploadFile(fileBuffer, fileName, mimeType, tenantId);
  
  // Step 3: Extract text content
  const extractedText = await extractTextFromFile(url, fileType, mimeType);
  
  // Step 4: Extract observations and metrics
  const extraction = await extractObservationsAndMetrics(extractedText, fileType);
  
  return {
    fileUrl: url,
    fileKey: key,
    extraction
  };
}
