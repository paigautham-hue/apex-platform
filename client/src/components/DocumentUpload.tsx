import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Upload, File, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface DocumentUploadProps {
  onUploadComplete: (fileUrl: string, fileName: string, fileType: string) => void;
  acceptedTypes?: string;
  maxSizeMB?: number;
  buttonVariant?: "default" | "outline" | "ghost";
  buttonText?: string;
  className?: string;
}

export function DocumentUpload({
  onUploadComplete,
  acceptedTypes = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv",
  maxSizeMB = 10,
  buttonVariant = "outline",
  buttonText = "Upload Document",
  className = ""
}: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const uploadMutation = trpc.evidence.upload.useMutation({
    onSuccess: (data: any) => {
      if (selectedFile) {
        onUploadComplete(data.url, selectedFile.name, selectedFile.type);
        toast.success("Document uploaded successfully");
        setSelectedFile(null);
      }
      setIsUploading(false);
    },
    onError: (error: any) => {
      toast.error(`Upload failed: ${error.message}`);
      setIsUploading(false);
    }
  });

  const handleFileSelect = useCallback((file: File) => {
    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      toast.error(`File size exceeds ${maxSizeMB}MB limit`);
      return;
    }

    setSelectedFile(file);
    
    // Auto-upload
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      uploadMutation.mutate({
        fileName: file.name,
        mimeType: file.type,
        fileData: base64,
        tenantId: 1
      });
    };
    reader.readAsDataURL(file);
  }, [maxSizeMB]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  return (
    <div className={className}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragging ? "border-primary bg-primary/5" : "border-border"
        }`}
      >
        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Uploading...</p>
          </div>
        ) : selectedFile ? (
          <div className="flex items-center justify-center gap-3">
            <File className="h-6 w-6 text-primary" />
            <span className="text-sm font-medium">{selectedFile.name}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setSelectedFile(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium mb-1">
                Drag and drop your document here
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                or click to browse (max {maxSizeMB}MB)
              </p>
            </div>
            <label htmlFor="file-upload">
              <Button type="button" variant={buttonVariant} asChild>
                <span>{buttonText}</span>
              </Button>
              <input
                id="file-upload"
                type="file"
                className="hidden"
                accept={acceptedTypes}
                onChange={handleFileInputChange}
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
