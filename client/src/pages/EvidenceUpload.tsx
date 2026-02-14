import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Image, FileSpreadsheet, Presentation, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function EvidenceUpload() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extractionResult, setExtractionResult] = useState<any>(null);
  
  const uploadMutation = trpc.evidence.upload.useMutation();
  const { data: evidenceList } = trpc.evidence.list.useQuery({ tenantId: 1 });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await handleFileUpload(files[0]);
    }
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFileUpload(files[0]);
    }
  }, []);

  const handleFileUpload = async (file: File) => {
    if (file.size > 16 * 1024 * 1024) {
      toast.error("File size must be less than 16MB");
      return;
    }

    setUploading(true);
    setExtractionResult(null);

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        const base64Data = base64.split(',')[1]; // Remove data:image/png;base64, prefix

        try {
          const result = await uploadMutation.mutateAsync({
            fileData: base64Data,
            fileName: file.name,
            mimeType: file.type,
            tenantId: 1,
          });

          setExtractionResult(result);
          toast.success("File uploaded and processed successfully!");
        } catch (error) {
          toast.error("Failed to upload file");
          console.error(error);
        } finally {
          setUploading(false);
        }
      };

      reader.readAsDataURL(file);
    } catch (error) {
      toast.error("Failed to read file");
      setUploading(false);
    }
  };

  const getFileIcon = (type: string) => {
    if (type.includes('image')) return <Image className="h-8 w-8" />;
    if (type.includes('spreadsheet') || type.includes('excel')) return <FileSpreadsheet className="h-8 w-8" />;
    if (type.includes('presentation')) return <Presentation className="h-8 w-8" />;
    return <FileText className="h-8 w-8" />;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Upload className="h-8 w-8 text-primary" />
          Evidence Upload
        </h1>
        <p className="text-muted-foreground">
          Upload documents, presentations, or images for AI-powered extraction
        </p>
      </div>

      {/* Upload Zone */}
      <Card>
        <CardHeader>
          <CardTitle>Drop Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
          >
            <Upload className={`h-16 w-16 mx-auto mb-4 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
            <h3 className="text-lg font-semibold mb-2">
              {uploading ? "Processing..." : "Drop files here or click to upload"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Supports Excel, PowerPoint, PDF, Images, and Documents (max 16MB)
            </p>
            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={handleFileSelect}
              accept=".xlsx,.xls,.pptx,.ppt,.pdf,.png,.jpg,.jpeg,.doc,.docx"
              disabled={uploading}
            />
            <Button
              onClick={() => document.getElementById('file-upload')?.click()}
              disabled={uploading}
            >
              {uploading ? "Uploading..." : "Select File"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Extraction Results */}
      {extractionResult && (
        <div className="space-y-4">
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-semibold text-green-900">Upload Successful</p>
                  <p className="text-sm text-green-700">
                    File processed and {extractionResult.extraction.observations.length} observations extracted
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Document Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{extractionResult.extraction.summary}</p>
            </CardContent>
          </Card>

          {/* Extracted Observations */}
          {extractionResult.extraction.observations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Extracted Observations ({extractionResult.extraction.observations.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {extractionResult.extraction.observations.map((obs: any, index: number) => (
                    <div key={index} className="border-l-2 border-primary pl-4 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{obs.personName}</span>
                        <span className="text-xs px-2 py-1 rounded bg-accent/20">
                          {Math.round(obs.confidence * 100)}% confidence
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">{obs.text}</p>
                      <span className="text-xs text-muted-foreground">{obs.category}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Extracted Metrics */}
          {extractionResult.extraction.metrics.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Extracted Metrics ({extractionResult.extraction.metrics.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-3">
                  {extractionResult.extraction.metrics.map((metric: any, index: number) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{metric.name}</span>
                        <span className="text-xs px-2 py-1 rounded bg-accent/20">
                          {Math.round(metric.confidence * 100)}%
                        </span>
                      </div>
                      <p className="text-2xl font-mono font-bold text-primary">
                        {metric.value}{metric.unit}
                      </p>
                      <p className="text-xs text-muted-foreground">{metric.period}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Button
            variant="outline"
            onClick={() => setExtractionResult(null)}
            className="w-full"
          >
            Upload Another File
          </Button>
        </div>
      )}

      {/* Recent Uploads */}
      {evidenceList && evidenceList.length > 0 && !extractionResult && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Uploads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {evidenceList.slice(0, 10).map((evidence: any) => (
                <div key={evidence.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  {getFileIcon(evidence.type)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{evidence.type}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(evidence.uploadDate).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-accent/20">
                    Tier {evidence.credibilityTier}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
