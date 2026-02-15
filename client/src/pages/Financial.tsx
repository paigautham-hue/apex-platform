import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, CheckCircle, ArrowRight, ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DocumentUpload } from "@/components/DocumentUpload";

type WizardStep = "upload" | "review" | "confirm" | "complete";

export default function Financial() {
  const [currentStep, setCurrentStep] = useState<WizardStep>("upload");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [selectedOrgUnit, setSelectedOrgUnit] = useState<number | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");

  const { data: orgUnits } = trpc.tenant.listOrgUnits.useQuery({ tenantId: 1 });
  const { data: financialUploads } = trpc.financial.listUploads.useQuery({ tenantId: 1 });
  
  const uploadMutation = trpc.evidence.upload.useMutation();
  const createFinancialUploadMutation = trpc.financial.createUpload.useMutation({
    onSuccess: () => {
      toast.success("Financial data uploaded successfully!");
      setCurrentStep("complete");
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 16 * 1024 * 1024) {
      toast.error("File size must be less than 16MB");
      return;
    }

    setUploadedFile(file);

    // Convert to base64 and extract
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      const base64Data = base64.split(',')[1];

      try {
        toast.info("Processing file with AI...");
        const result = await uploadMutation.mutateAsync({
          fileData: base64Data,
          fileName: file.name,
          mimeType: file.type,
          tenantId: 1,
        });

        setExtractedData(result.extraction);
        setCurrentStep("review");
        toast.success("File processed successfully!");
      } catch (error) {
        toast.error("Failed to process file");
        console.error(error);
      }
    };

    reader.readAsDataURL(file);
  };

  const handleConfirm = async () => {
    if (!selectedOrgUnit || !selectedPeriod) {
      toast.error("Please select org unit and period");
      return;
    }

    if (!extractedData) {
      toast.error("No extracted data available");
      return;
    }

    // Create financial upload record
    await createFinancialUploadMutation.mutateAsync({
      tenantId: 1,
      orgUnitId: selectedOrgUnit,
      period: selectedPeriod,
      extractedMetrics: extractedData.metrics,
      status: "CONFIRMED",
    });
  };

  const renderStepIndicator = () => {
    const steps = [
      { id: "upload", label: "Upload" },
      { id: "review", label: "Review" },
      { id: "confirm", label: "Confirm" },
      { id: "complete", label: "Complete" },
    ];

    const currentIndex = steps.findIndex(s => s.id === currentStep);

    return (
      <div className="flex items-center justify-center gap-2 mb-8">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
              index <= currentIndex
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground"
            }`}>
              {index < currentIndex ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <span>{index + 1}</span>
              )}
            </div>
            {index < steps.length - 1 && (
              <div className={`w-16 h-0.5 ${
                index < currentIndex ? "bg-primary" : "bg-border"
              }`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <FileSpreadsheet className="h-8 w-8 text-primary" />
          Financial Upload Wizard
        </h1>
        <p className="text-muted-foreground">
          Upload financial data and automatically extract metrics
        </p>
      </div>

      {renderStepIndicator()}

      {/* Step 1: Upload */}
      {currentStep === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Financial Data</CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentUpload
              onUploadComplete={async (fileUrl: string, fileName: string, fileType: string) => {
                // File has been uploaded to S3, now extract with AI
                try {
                  toast.info("Processing file with AI...");
                  
                  // Fetch the file from S3 and convert to base64
                  const response = await fetch(fileUrl);
                  const blob = await response.blob();
                  const reader = new FileReader();
                  
                  reader.onload = async (e) => {
                    const base64 = e.target?.result as string;
                    const base64Data = base64.split(',')[1];

                    const result = await uploadMutation.mutateAsync({
                      fileData: base64Data,
                      fileName: fileName,
                      mimeType: fileType,
                      tenantId: 1,
                    });

                    setExtractedData(result.extraction);
                    setCurrentStep("review");
                    toast.success("File processed successfully!");
                  };
                  
                  reader.readAsDataURL(blob);
                } catch (error) {
                  toast.error("Failed to process file");
                  console.error(error);
                }
              }}
              acceptedTypes=".xlsx,.xls,.csv"
              maxSizeMB={16}
              buttonText="Upload Financial Data"
            />
          </CardContent>
        </Card>
      )}

      {/* Step 2: Review Extracted Data */}
      {currentStep === "review" && extractedData && (
        <>
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-semibold text-green-900">File Processed Successfully</p>
                  <p className="text-sm text-green-700">
                    Extracted {extractedData.metrics.length} metrics from {uploadedFile?.name}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Extracted Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {extractedData.metrics.map((metric: any, index: number) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{metric.name}</span>
                      <span className="text-xs px-2 py-1 rounded bg-accent/20">
                        {Math.round(metric.confidence * 100)}% confidence
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-2xl font-mono font-bold text-primary">
                          {metric.value}{metric.unit}
                        </p>
                        <p className="text-xs text-muted-foreground">{metric.period}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setCurrentStep("upload");
                setExtractedData(null);
                setUploadedFile(null);
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={() => setCurrentStep("confirm")}
              className="flex-1"
            >
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </>
      )}

      {/* Step 3: Confirm Details */}
      {currentStep === "confirm" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Confirm Upload Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Organization Unit</label>
                <Select value={selectedOrgUnit?.toString()} onValueChange={(val) => setSelectedOrgUnit(Number(val))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select org unit..." />
                  </SelectTrigger>
                  <SelectContent>
                    {orgUnits?.map((unit: any) => (
                      <SelectItem key={unit.id} value={unit.id.toString()}>
                        {unit.name} ({unit.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Period</label>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select period..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Q1_2024">Q1 2024</SelectItem>
                    <SelectItem value="Q2_2024">Q2 2024</SelectItem>
                    <SelectItem value="Q3_2024">Q3 2024</SelectItem>
                    <SelectItem value="Q4_2024">Q4 2024</SelectItem>
                    <SelectItem value="FY_2024">FY 2024</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="border rounded-lg p-4 bg-accent/10">
                <p className="text-sm font-medium mb-2">Summary</p>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>File: {uploadedFile?.name}</p>
                  <p>Metrics: {extractedData?.metrics.length || 0}</p>
                  <p>Org Unit: {orgUnits?.find((u: any) => u.id === selectedOrgUnit)?.name || 'Not selected'}</p>
                  <p>Period: {selectedPeriod || 'Not selected'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setCurrentStep("review")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!selectedOrgUnit || !selectedPeriod || createFinancialUploadMutation.isPending}
              className="flex-1"
            >
              {createFinancialUploadMutation.isPending ? "Uploading..." : "Confirm Upload"}
            </Button>
          </div>
        </>
      )}

      {/* Step 4: Complete */}
      {currentStep === "complete" && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-12 pb-12 text-center">
            <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-600" />
            <h3 className="text-2xl font-bold mb-2 text-green-900">Upload Complete!</h3>
            <p className="text-green-700 mb-6">
              Financial data has been successfully uploaded and metrics have been extracted.
            </p>
            <div className="flex gap-2 justify-center">
              <Button
                variant="outline"
                onClick={() => {
                  setCurrentStep("upload");
                  setExtractedData(null);
                  setUploadedFile(null);
                  setSelectedOrgUnit(null);
                  setSelectedPeriod("");
                }}
              >
                Upload Another File
              </Button>
              <Button onClick={() => window.location.href = "/analytics"}>
                View Analytics
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Uploads */}
      {currentStep === "upload" && financialUploads && financialUploads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Uploads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {financialUploads.slice(0, 5).map((upload: any) => (
                <div key={upload.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{upload.period}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(upload.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    upload.status === 'PROCESSED' ? 'bg-green-100 text-green-800' :
                    upload.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {upload.status}
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
