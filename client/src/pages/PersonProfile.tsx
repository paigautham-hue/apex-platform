import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Building2, Users, ChevronRight, Pencil, Check, X,
  FileText, Upload, Trash2, Download, Sparkles, Plus, Loader2,
  ClipboardList, ChevronDown, ChevronUp, Eye, MessageSquare,
  ArrowRight, ArrowLeft, Star, AlertTriangle, TrendingUp, Zap, GitCompare
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import AIDeliberationPanel from "@/components/AIDeliberationPanel";
import { VoiceInput } from "@/components/VoiceInput";
import AppraisalCompareModal from "@/components/AppraisalCompareModal";

// ─── Self-Appraisal Upload Card ───────────────────────────────────────────────
function SelfAppraisalCard({ personId, tenantId }: { personId: number; tenantId: number }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data: appraisals, refetch } = trpc.appraisal.selfAppraisal.list.useQuery({ personId });
  const deleteMutation = trpc.appraisal.selfAppraisal.delete.useMutation({
    onSuccess: () => { toast.success("Deleted"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const uploadMutation = trpc.appraisal.selfAppraisal.upload.useMutation({
    onSuccess: () => { toast.success("Self-appraisal uploaded and extracted"); refetch(); setUploading(false); },
    onError: (e) => { toast.error("Upload failed: " + e.message); setUploading(false); },
  });

  const handleFile = async (file: File) => {
    if (file.size > 16 * 1024 * 1024) { toast.error("File must be under 16 MB"); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      const base64 = (e.target?.result as string).split(",")[1];
      uploadMutation.mutate({
        personId,
        fileBase64: base64,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Self-Appraisals (PACE)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-accent/60 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Uploading and extracting PACE data…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Upload className="h-6 w-6" />
              <p className="text-sm font-medium">Drop PACE self-appraisal here</p>
              <p className="text-xs">Word (.docx) or PDF — up to 16 MB</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".docx,.pdf,.doc"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>

        {/* Uploaded appraisals */}
        {appraisals && appraisals.length > 0 && (
          <div className="space-y-2">
            {appraisals.map((a) => (
              <div key={a.id} className="border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-accent shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{a.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.fiscalYear ? `FY ${a.fiscalYear} · ` : ""}
                        {new Date(a.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {a.extractedData && (
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                        className="h-7 px-2 text-xs"
                      >
                        {expanded === a.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        Preview
                      </Button>
                    )}
                    <a href={a.fileUrl} target="_blank" rel="noreferrer">
                      <Button variant="ghost" size="sm" className="h-7 px-2">
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </a>
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 px-2 text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate({ id: a.id })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {/* Extracted data preview */}
                {expanded === a.id && a.extractedData && (
                  <div className="border-t bg-muted/30 p-3 text-xs space-y-3">
                    {(a.extractedData as any).header && (
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries((a.extractedData as any).header).map(([k, v]) => v ? (
                          <div key={k}>
                            <span className="text-muted-foreground uppercase tracking-wide">{k}: </span>
                            <span className="font-medium">{String(v)}</span>
                          </div>
                        ) : null)}
                      </div>
                    )}
                    {(a.extractedData as any).kpiRows?.length > 0 && (
                      <div>
                        <p className="font-semibold mb-1 text-muted-foreground uppercase tracking-wide">KPI Rows ({(a.extractedData as any).kpiRows.length})</p>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {(a.extractedData as any).kpiRows.map((row: any, i: number) => (
                            <div key={i} className="bg-background rounded p-2">
                              <p className="font-medium">{row.goalName || row.kpiName || `KPI ${i + 1}`}</p>
                              {(row.selfAppraisal || row.employeeSelfAppraisal) && <p className="text-muted-foreground mt-0.5">Self: {(row.selfAppraisal || row.employeeSelfAppraisal)}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {(a.extractedData as any).overallComments?.employee && (
                      <div>
                        <p className="font-semibold mb-1 text-muted-foreground uppercase tracking-wide">Overall Self-Comments</p>
                        <p className="text-muted-foreground">{(a.extractedData as any).overallComments.employee}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {(!appraisals || appraisals.length === 0) && (
          <p className="text-xs text-muted-foreground text-center">No self-appraisals uploaded yet</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Role Mandate Card ────────────────────────────────────────────────────────
function RoleMandateCard({ personId, tenantId, role }: { personId: number; tenantId: number; role: any }) {
  const [editing, setEditing] = useState(false);
  const [purpose, setPurpose] = useState(role?.rolePurpose || "");
  const jdFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingJd, setUploadingJd] = useState(false);
  const [jdUploaded, setJdUploaded] = useState<{ url: string; textLength: number } | null>(null);

  const parseJsonArray = (val: unknown): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val as string[];
    try { const p = JSON.parse(val as string); return Array.isArray(p) ? p : []; } catch { return []; }
  };
  const [responsibilities, setResponsibilities] = useState<string[]>(() => parseJsonArray(role?.keyResponsibilities));
  const [successMetrics, setSuccessMetrics] = useState<string[]>(() => parseJsonArray(role?.successMetrics));
  const [newResp, setNewResp] = useState("");
  const [newMetric, setNewMetric] = useState("");

  const utils = trpc.useUtils();
  const updateMandate = trpc.person.updateRoleMandate.useMutation({
    onSuccess: () => {
      toast.success("Role mandate saved");
      utils.person.getById.invalidate({ personId, tenantId });
      setEditing(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const jdUploadMutation = trpc.appraisal.jdDocument.upload.useMutation({
    onSuccess: (data) => {
      setJdUploaded({ url: data.fileUrl, textLength: data.jdTextLength });
      toast.success(`JD uploaded — ${data.jdTextLength.toLocaleString()} characters extracted`);
      setUploadingJd(false);
      utils.person.getById.invalidate({ personId, tenantId });
    },
    onError: (e) => {
      toast.error("JD upload failed: " + e.message);
      setUploadingJd(false);
    },
  });

  const handleJdFile = (file: File) => {
    if (file.size > 16 * 1024 * 1024) { toast.error("File must be under 16 MB"); return; }
    setUploadingJd(true);
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      const base64 = (e.target?.result as string).split(",")[1];
      jdUploadMutation.mutate({
        roleId: role.id,
        fileBase64: base64,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!role?.id) return;
    updateMandate.mutate({
      roleId: role.id,
      tenantId,
      rolePurpose: purpose,
      keyResponsibilities: responsibilities,
      successMetrics,
    });
  };

  const addResp = () => { if (newResp.trim()) { setResponsibilities([...responsibilities, newResp.trim()]); setNewResp(""); } };
  const addMetric = () => { if (newMetric.trim()) { setSuccessMetrics([...successMetrics, newMetric.trim()]); setNewMetric(""); } };

  const hasJd = jdUploaded || role?.jdDocumentUrl;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Role Mandate
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* JD Upload Button */}
            {role?.id && (
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 gap-1.5 text-xs"
                  onClick={() => jdFileInputRef.current?.click()}
                  disabled={uploadingJd}
                >
                  {uploadingJd ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : hasJd ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {hasJd ? "JD Uploaded ✓" : "Upload JD"}
                </Button>
                <input
                  ref={jdFileInputRef}
                  type="file"
                  className="hidden"
                  accept=".docx,.pdf,.doc"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleJdFile(f); }}
                />
              </div>
            )}
            {!editing ? (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="h-8 px-2">
                <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button size="sm" onClick={handleSave} disabled={updateMandate.isPending} className="h-8 px-3">
                  {updateMandate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-8 px-2">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
        {/* JD status indicator */}
        {(jdUploaded || role?.jdDocumentUrl) && (
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="text-xs gap-1">
              <FileText className="h-3 w-3" />
              JD document on file
              {jdUploaded && ` — ${jdUploaded.textLength.toLocaleString()} chars`}
            </Badge>
            {(jdUploaded?.url || role?.jdDocumentUrl) && (
              <a href={jdUploaded?.url || role?.jdDocumentUrl} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">
                View
              </a>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Purpose */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Purpose</p>
          {editing ? (
            <div className="space-y-1">
              <Textarea
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="What does this role exist to do? (1–2 sentences)"
                className="min-h-[72px] text-sm"
              />
              <VoiceInput onTranscript={(t: string) => setPurpose((prev: string) => prev ? prev + " " + t : t)} />
            </div>
          ) : purpose ? (
            <p className="text-sm">{purpose}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">Not set — click Edit to add</p>
          )}
        </div>

        {/* Key Responsibilities */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Key Responsibilities</p>
          {responsibilities.length > 0 ? (
            <ul className="space-y-1">
              {responsibilities.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-accent mt-0.5">•</span>
                  <span className="flex-1">{r}</span>
                  {editing && (
                    <button onClick={() => setResponsibilities(responsibilities.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : !editing && (
            <p className="text-sm text-muted-foreground italic">None added</p>
          )}
          {editing && (
            <div className="flex gap-2 mt-2">
              <Input
                value={newResp}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewResp(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addResp()}
                placeholder="Add responsibility…"
                className="text-sm h-8"
              />
              <Button size="sm" variant="outline" onClick={addResp} className="h-8 px-2 shrink-0">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Success Metrics */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Success Looks Like</p>
          {successMetrics.length > 0 ? (
            <ul className="space-y-1">
              {successMetrics.map((m, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  <span className="flex-1">{m}</span>
                  {editing && (
                    <button onClick={() => setSuccessMetrics(successMetrics.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : !editing && (
            <p className="text-sm text-muted-foreground italic">None added</p>
          )}
          {editing && (
            <div className="flex gap-2 mt-2">
              <Input
                value={newMetric}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMetric(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addMetric()}
                placeholder="Add success criterion…"
                className="text-sm h-8"
              />
              <Button size="sm" variant="outline" onClick={addMetric} className="h-8 px-2 shrink-0">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────
const WIZARD_STEPS = [
  { id: 1, label: "Context Review", icon: Eye },
  { id: 2, label: "Your Input", icon: MessageSquare },
  { id: 3, label: "AI Enhancement", icon: Sparkles },
  { id: 4, label: "Side-by-Side", icon: ArrowRight },
  { id: 5, label: "Finalise", icon: Check },
];

function WizardStepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1">
      {WIZARD_STEPS.map((s, i) => {
        const Icon = s.icon;
        const done = current > s.id;
        const active = current === s.id;
        return (
          <div key={s.id} className="flex items-center">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              active ? "bg-accent text-accent-foreground shadow-sm" :
              done ? "bg-accent/20 text-accent" :
              "text-muted-foreground"
            }`}>
              <Icon className="h-3.5 w-3.5" />
              {s.label}
            </div>
            {i < WIZARD_STEPS.length - 1 && (
              <div className={`h-px w-4 shrink-0 ${done ? "bg-accent/40" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── PACE Appraisal Wizard ────────────────────────────────────────────────────
type WizardStep = 1 | 2 | 3 | 4 | 5;

interface ChairmanKpiInput {
  goalName: string;
  chairmanRawInput: string;
}

function PaceAppraisalWizard({ personId, personName, tenantId, onClose }: {
  personId: number; personName: string; tenantId: number; onClose: () => void;
}) {
  const [step, setStep] = useState<WizardStep>(1);
  const [selectedAppraisalId, setSelectedAppraisalId] = useState<number | undefined>();
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear().toString());

  // Step 2 state — Chairman's raw input
  const [chairmanKpiInputs, setChairmanKpiInputs] = useState<ChairmanKpiInput[]>([]);
  const [chairmanOverallView, setChairmanOverallView] = useState("");

  // Step 3/4 state — AI result
  const [appraisalResult, setAppraisalResult] = useState<any>(null);
  const [editedKpiRows, setEditedKpiRows] = useState<Record<number, string>>({});
  const [editedOverall, setEditedOverall] = useState("");

  // Step 5 state
  const [quadrant, setQuadrant] = useState("");
  const [fitDetermination, setFitDetermination] = useState("");

  const utils = trpc.useUtils();
  const { data: selfAppraisalList } = trpc.appraisal.selfAppraisal.list.useQuery({ personId });
  const { data: context, isLoading: contextLoading } = trpc.appraisal.pace.getContext.useQuery(
    { personId, selfAppraisalId: selectedAppraisalId },
    { enabled: step >= 1 }
  );
  // Auto-reparse: if context loaded but kpiRows is null and a self-appraisal exists, trigger reparse
  const [reparseTriggered, setReparseTriggered] = useState(false);
  const reparseMutation = trpc.appraisal.selfAppraisal.reparse.useMutation({
    onSuccess: () => {
      utils.appraisal.pace.getContext.invalidate({ personId });
      utils.appraisal.selfAppraisal.list.invalidate({ personId });
      setReparseTriggered(false);
    },
    onError: () => setReparseTriggered(false),
  });
  useEffect(() => {
    if (!context || reparseTriggered) return;
    const saData = context.selfAppraisalData as any;
    // If there's a self-appraisal but no kpiRows, auto-reparse
    if (saData && !saData.kpiRows) {
      // Find the self-appraisal id to reparse
      const saId = selectedAppraisalId ?? selfAppraisalList?.[0]?.id;
      if (saId) {
        setReparseTriggered(true);
        reparseMutation.mutate({ id: saId });
      }
    }
  }, [context, selectedAppraisalId, selfAppraisalList, reparseTriggered]);
  const synthesiseMutation = trpc.appraisal.pace.synthesise.useMutation({
    onSuccess: (data) => {
      setAppraisalResult(data);
      // Pre-fill editable rows from AI polished output
      const rows: Record<number, string> = {};
      data.paceData?.kpiRows?.forEach((row: any, i: number) => {
        rows[i] = row.polishedAppraiserComments || row.appraiserComments || "";
      });
      setEditedKpiRows(rows);
      setEditedOverall(data.paceData?.appraiserOverallComments || "");
      // Pre-fill quadrant suggestions
      if (data.quadrantSuggestion) setQuadrant(data.quadrantSuggestion);
      if (data.fitSuggestion) setFitDetermination(data.fitSuggestion);
      setStep(4);
    },
    onError: (e) => {
      toast.error("AI synthesis failed: " + e.message);
      setStep(2);
    },
  });

  const saveMutation = trpc.appraisal.pace.save.useMutation({
    onSuccess: () => { toast.success("Appraisal saved successfully"); setStep(5); },
    onError: (e) => toast.error(e.message),
  });
  const exportDocxMutation = trpc.appraisal.pace.exportDocx.useMutation({
    onSuccess: (data) => {
      const byteCharacters = atob(data.base64);
      const byteNumbers = new Array(byteCharacters.length).fill(0).map((_, i) => byteCharacters.charCodeAt(i));
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: data.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PACE document downloaded");
    },
    onError: (e) => toast.error("Export failed: " + e.message),
  });

  // Initialise KPI inputs when context loads and we move to step 2
  const initKpiInputs = useCallback(() => {
    const kpiRows = (context?.selfAppraisalData as any)?.kpiRows ?? [];
    if (kpiRows.length > 0 && chairmanKpiInputs.length === 0) {
      setChairmanKpiInputs(kpiRows.map((row: any) => ({
        goalName: row.goalName || row.kpiName || "KPI",
        chairmanRawInput: "",
      })));
    } else if (kpiRows.length === 0 && chairmanKpiInputs.length === 0) {
      // No self-appraisal — create one generic input
      setChairmanKpiInputs([{ goalName: "Overall Performance", chairmanRawInput: "" }]);
    }
  }, [context, chairmanKpiInputs.length]);

  const handleGoToStep2 = () => {
    initKpiInputs();
    setStep(2);
  };

  const handleRunAI = () => {
    setStep(3);
    synthesiseMutation.mutate({
      personId,
      selfAppraisalId: selectedAppraisalId,
      fiscalYear,
      chairmanKpiInputs,
      chairmanOverallView,
    });
  };

  const handleSaveFinal = () => {
    if (!appraisalResult?.id) return;
    const updatedPaceData = {
      ...appraisalResult.paceData,
      kpiRows: appraisalResult.paceData?.kpiRows?.map((row: any, i: number) => ({
        ...row,
        appraiserComments: editedKpiRows[i] ?? row.appraiserComments,
      })),
      appraiserOverallComments: editedOverall,
      quadrant,
      fitDetermination,
    };
    saveMutation.mutate({
      id: appraisalResult.id,
      paceData: updatedPaceData,
      quadrant,
      fitDetermination,
      status: "FINAL",
    });
  };

  const kpiRows = (context?.selfAppraisalData as any)?.kpiRows ?? [];

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto">
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              PACE Appraisal — {personName}
            </h2>
            <p className="text-muted-foreground text-sm mt-0.5">Human-first, AI-assisted appraisal flow</p>
          </div>
          <Button variant="ghost" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>

        {/* Step bar */}
        <WizardStepBar current={step} />

        {/* ── Step 1: Context Review ── */}
        {step === 1 && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Eye className="h-4 w-4 text-accent" />
                    Step 1 — Review Context Before Forming Your View
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Fiscal Year</label>
                    <Input
                      value={fiscalYear}
                      onChange={(e) => setFiscalYear(e.target.value)}
                      placeholder="e.g. FY25-26"
                      className="w-28 h-8 text-sm"
                    />
                    {selfAppraisalList && selfAppraisalList.length > 0 && (
                      <Select value={selectedAppraisalId?.toString() || "none"} onValueChange={(v) => setSelectedAppraisalId(v === "none" ? undefined : Number(v))}>
                        <SelectTrigger className="w-52 h-8 text-sm">
                          <SelectValue placeholder="Select self-appraisal…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Latest self-appraisal</SelectItem>
                          {selfAppraisalList.map((a) => (
                            <SelectItem key={a.id} value={String(a.id)}>
                              {a.fileName} {a.fiscalYear ? `(FY ${a.fiscalYear})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>

            {contextLoading ? (
              <Card><CardContent className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin text-accent mx-auto" /></CardContent></Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {/* JD / Role Mandate */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-accent" /> Job Description
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    {context?.jdDocumentText ? (
                      <div className="max-h-48 overflow-y-auto text-muted-foreground whitespace-pre-wrap text-xs leading-relaxed">
                        {context.jdDocumentText.slice(0, 1500)}{context.jdDocumentText.length > 1500 ? "…" : ""}
                      </div>
                    ) : context?.rolePurpose ? (
                      <div className="space-y-2">
                        <p className="font-medium">{context.rolePurpose}</p>
                        {(context.keyResponsibilities as string[])?.length > 0 && (
                          <ul className="space-y-1 text-muted-foreground">
                            {(context.keyResponsibilities as string[]).map((r, i) => (
                              <li key={i} className="flex gap-1.5"><span className="text-accent">•</span>{r}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground italic text-xs">No JD uploaded. Upload a JD in the Role Mandate section for richer AI context.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Self-Appraisal KPI Summary */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4 text-accent" /> Self-Appraisal
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {kpiRows.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {kpiRows.map((row: any, i: number) => (
                          <div key={i} className="border rounded p-2 text-xs space-y-1">
                            <p className="font-semibold text-sm">{row.goalName || row.kpiName || `KPI ${i + 1}`}</p>
                            {(row.selfAppraisal || row.employeeSelfAppraisal) && (
                              <p className="text-muted-foreground">{(row.selfAppraisal || row.employeeSelfAppraisal)}</p>
                            )}
                            {row.selfRating && (
                              <Badge variant="secondary" className="text-xs">{row.selfRating}</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : reparseMutation.isPending || reparseTriggered ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Extracting KPI rows from document…</span>
                      </div>
                    ) : context?.selfAppraisalData ? (
                      <p className="text-muted-foreground italic text-xs">Document uploaded but no structured KPI rows found. You can still proceed to enter your assessment manually.</p>
                    ) : (
                      <p className="text-muted-foreground italic text-xs">No self-appraisal uploaded.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Goals */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-accent" /> Goals ({context?.goals?.length ?? 0})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {context?.goals && context.goals.length > 0 ? (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {context.goals.map((g: any) => (
                          <div key={g.id} className="flex items-center gap-2 text-xs">
                            <Badge variant={g.status === "COMPLETED" ? "default" : "secondary"} className="text-xs shrink-0">
                              {g.status}
                            </Badge>
                            <span className="truncate">{g.name}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground italic text-xs">No goals recorded.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Observations */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Zap className="h-4 w-4 text-accent" /> Observations ({context?.observations?.length ?? 0})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {context?.observations && context.observations.length > 0 ? (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {context.observations.slice(0, 8).map((obs: any) => (
                          <div key={obs.id} className="border-l-2 border-accent/40 pl-2 text-xs">
                            <Badge
                              variant={obs.direction === "POSITIVE" ? "default" : obs.direction === "NEEDS_IMPROVEMENT" ? "destructive" : "secondary"}
                              className="text-xs mb-0.5"
                            >
                              {obs.direction?.replace(/_/g, " ")}
                            </Badge>
                            <p className="text-muted-foreground line-clamp-2">{obs.text}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground italic text-xs">No observations recorded.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleGoToStep2} className="gap-2" disabled={contextLoading}>
                I've reviewed the context — proceed to my input
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Chairman's Raw Input ── */}
        {step === 2 && (
          <div className="space-y-4">
            <Card className="border-accent/30 bg-accent/5">
              <CardContent className="py-3 px-4">
                <p className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-accent" />
                  Step 2 — Your Raw Assessment (AI will polish your words, not replace them)
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Write your honest view for each KPI in plain language. The AI will enhance the expression while preserving your judgment.
                </p>
              </CardContent>
            </Card>

            {/* KPI Inputs */}
            <div className="space-y-4">
              {chairmanKpiInputs.map((kpi, i) => {
                const selfRow = kpiRows[i];
                return (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">{kpi.goalName}</CardTitle>
                      {(selfRow?.selfAppraisal || selfRow?.employeeSelfAppraisal) && (
                        <div className="mt-1 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">Employee's self-assessment: </span>
                          {(selfRow.selfAppraisal || selfRow.employeeSelfAppraisal)}
                          {selfRow.selfRating && (
                            <Badge variant="secondary" className="ml-2 text-xs">{selfRow.selfRating}</Badge>
                          )}
                        </div>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                        Your view on this KPI
                      </label>
                      <Textarea
                        value={kpi.chairmanRawInput}
                        onChange={(e) => {
                          const updated = [...chairmanKpiInputs];
                          updated[i] = { ...updated[i], chairmanRawInput: e.target.value };
                          setChairmanKpiInputs(updated);
                        }}
                        placeholder="Write your honest assessment in plain language — e.g. 'Good delivery on targets but needs to improve communication with the board. Showed initiative on the acquisition.'"
                        className="min-h-[80px] text-sm"
                      />
                      <VoiceInput
                        onTranscript={(t: string) => {
                          const updated = [...chairmanKpiInputs];
                          updated[i] = { ...updated[i], chairmanRawInput: updated[i].chairmanRawInput ? updated[i].chairmanRawInput + " " + t : t };
                          setChairmanKpiInputs(updated);
                        }}
                      />
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Overall View */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Overall View of {personName}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Your overall narrative
                </label>
                <Textarea
                  value={chairmanOverallView}
                  onChange={(e) => setChairmanOverallView(e.target.value)}
                  placeholder="Summarise your overall assessment — performance, potential, concerns, and what you expect from them in the next year."
                  className="min-h-[100px] text-sm"
                />
                <VoiceInput onTranscript={(t: string) => setChairmanOverallView((prev: string) => prev ? prev + " " + t : t)} />
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to Context
              </Button>
              <Button
                onClick={handleRunAI}
                className="gap-2"
                disabled={!chairmanOverallView.trim() && chairmanKpiInputs.every(k => !k.chairmanRawInput.trim())}
              >
                <Sparkles className="h-4 w-4" />
                Let AI polish my assessment
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: AI Enhancement Loading ── */}
        {step === 3 && (
          <Card>
            <CardContent className="py-20 text-center space-y-5">
              <div className="relative mx-auto w-16 h-16">
                <div className="absolute inset-0 rounded-full border-4 border-accent/20 animate-ping" />
                <div className="relative h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-accent animate-pulse" />
                </div>
              </div>
              <div>
                <p className="font-semibold text-xl">AI is polishing your assessment…</p>
                <p className="text-muted-foreground text-sm mt-2 max-w-md mx-auto">
                  Reading the JD, self-appraisal, goals, and observations to enhance your words while preserving your judgment.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">This typically takes 15–30 seconds</p>
            </CardContent>
          </Card>
        )}

        {/* ── Step 4: Side-by-Side Review ── */}
        {step === 4 && appraisalResult && (
          <div className="space-y-4">
            <Card className="border-accent/30 bg-accent/5">
              <CardContent className="py-3 px-4">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Eye className="h-4 w-4 text-accent" />
                  Step 4 — Review & Edit: Your Words vs AI-Polished
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  The right column shows AI-polished text. Edit it freely — your final version is what gets saved.
                </p>
              </CardContent>
            </Card>

            {/* AI Synthesis Notes */}
            {appraisalResult.aiSynthesisSummary && (
              <Card className="border-accent/20">
                <CardContent className="py-3 px-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">AI Synthesis Notes</p>
                  <p className="text-sm text-muted-foreground italic">{appraisalResult.aiSynthesisSummary}</p>
                </CardContent>
              </Card>
            )}

            {/* KPI Side-by-Side */}
            {appraisalResult.paceData?.kpiRows?.map((row: any, i: number) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">{row.goalName || `KPI ${i + 1}`}</CardTitle>
                    <Badge
                      variant={row.source === "AI_SUGGESTED" ? "secondary" : "default"}
                      className="text-xs"
                    >
                      {row.source === "AI_SUGGESTED" ? "AI Suggested" : "Chairman Polished"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Left: Chairman's raw words */}
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Your Words</p>
                      <div className="p-3 bg-muted/40 rounded-lg text-sm text-muted-foreground min-h-[80px]">
                        {row.chairmanRaw || <span className="italic">No input provided</span>}
                      </div>
                    </div>
                    {/* Right: AI polished (editable) */}
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-accent uppercase tracking-wide">AI-Polished (edit freely)</p>
                      <Textarea
                        value={editedKpiRows[i] ?? row.polishedAppraiserComments ?? ""}
                        onChange={(e) => setEditedKpiRows({ ...editedKpiRows, [i]: e.target.value })}
                        className="min-h-[80px] text-sm border-accent/30 focus:border-accent"
                      />
                      <VoiceInput
                        onTranscript={(t: string) => setEditedKpiRows((prev: Record<number, string>) => ({
                          ...prev,
                          [i]: (prev[i] ?? "") + " " + t
                        }))}
                      />
                    </div>
                  </div>
                  {/* Employee self-assessment for reference */}
                  {(row.selfAppraisal || row.employeeSelfAppraisal) && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Employee's self-assessment: </span>
                        {(row.selfAppraisal || row.employeeSelfAppraisal)}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* Overall Comments Side-by-Side */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Overall Narrative</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Your Words</p>
                    <div className="p-3 bg-muted/40 rounded-lg text-sm text-muted-foreground min-h-[100px]">
                      {appraisalResult.paceData?.chairmanOverallRaw || <span className="italic">No input provided</span>}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-accent uppercase tracking-wide">AI-Polished (edit freely)</p>
                    <Textarea
                      value={editedOverall}
                      onChange={(e) => setEditedOverall(e.target.value)}
                      className="min-h-[100px] text-sm border-accent/30 focus:border-accent"
                    />
                    <VoiceInput onTranscript={(t: string) => setEditedOverall((prev: string) => prev ? prev + " " + t : t)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep(2)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to My Input
              </Button>
              <Button onClick={() => setStep(5)} className="gap-2">
                Proceed to Finalise
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 5: Finalise & Export ── */}
        {step === 5 && !saveMutation.isSuccess && (
          <div className="space-y-4">
            <Card className="border-accent/30 bg-accent/5">
              <CardContent className="py-3 px-4">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Star className="h-4 w-4 text-accent" />
                  Step 5 — Finalise: Set Quadrant & Save
                </p>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Quadrant */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Performance Quadrant</CardTitle>
                  {appraisalResult?.quadrantSuggestion && (
                    <p className="text-xs text-muted-foreground">AI suggests: <span className="font-medium text-accent">{appraisalResult.quadrantSuggestion.replace(/_/g, " ")}</span></p>
                  )}
                </CardHeader>
                <CardContent>
                  <Select value={quadrant} onValueChange={setQuadrant}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select quadrant…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STAR">
                        <div className="flex items-center gap-2">
                          <Star className="h-3.5 w-3.5 text-yellow-500" /> Star
                        </div>
                      </SelectItem>
                      <SelectItem value="HIGH_POTENTIAL">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-3.5 w-3.5 text-blue-500" /> High Potential
                        </div>
                      </SelectItem>
                      <SelectItem value="NEEDS_DEVELOPMENT">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Needs Development
                        </div>
                      </SelectItem>
                      <SelectItem value="BRILLIANT_JERK">
                        <div className="flex items-center gap-2">
                          <Zap className="h-3.5 w-3.5 text-red-500" /> Brilliant Jerk
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Fit Determination */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Fit Determination</CardTitle>
                  {appraisalResult?.fitSuggestion && (
                    <p className="text-xs text-muted-foreground">AI suggests: <span className="font-medium text-accent">{appraisalResult.fitSuggestion.replace(/_/g, " ")}</span></p>
                  )}
                </CardHeader>
                <CardContent>
                  <Select value={fitDetermination} onValueChange={setFitDetermination}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select fit…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STRONG_FIT">Strong Fit</SelectItem>
                      <SelectItem value="DEVELOPING">Developing</SelectItem>
                      <SelectItem value="CONCERNS">Concerns</SelectItem>
                      <SelectItem value="NOT_FIT">Not Fit</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </div>

            {/* Summary of what will be saved */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Appraisal Summary</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Person: </span><span className="font-medium">{personName}</span></div>
                  <div><span className="text-muted-foreground">Fiscal Year: </span><span className="font-medium">{fiscalYear}</span></div>
                  <div><span className="text-muted-foreground">KPI Rows: </span><span className="font-medium">{appraisalResult?.paceData?.kpiRows?.length ?? 0}</span></div>
                  <div><span className="text-muted-foreground">Status: </span><Badge variant="default" className="text-xs">FINAL</Badge></div>
                </div>
                {editedOverall && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-1">Overall narrative preview:</p>
                    <p className="text-sm line-clamp-3">{editedOverall}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep(4)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to Review
              </Button>
              <Button
                onClick={handleSaveFinal}
                disabled={saveMutation.isPending || !quadrant}
                className="gap-2"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Finalise & Save Appraisal
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 5: Done ── */}
        {step === 5 && saveMutation.isSuccess && (
          <Card>
            <CardContent className="py-16 text-center space-y-5">
              <div className="h-20 w-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
                <Check className="h-10 w-10 text-emerald-500" />
              </div>
              <div>
                <p className="font-bold text-2xl">Appraisal Finalised</p>
                <p className="text-muted-foreground text-sm mt-2 max-w-sm mx-auto">
                  The PACE appraisal for <strong>{personName}</strong> has been saved with your final assessment.
                </p>
              </div>
              {quadrant && (
                <Badge variant="default" className="text-sm px-4 py-1">
                  {quadrant.replace(/_/g, " ")}
                </Badge>
              )}
              <div className="flex items-center justify-center gap-3 flex-wrap">
                {appraisalResult?.id && (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => exportDocxMutation.mutate({ id: appraisalResult.id })}
                    disabled={exportDocxMutation.isPending}
                  >
                    {exportDocxMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating Word…</>
                    ) : (
                      <><Download className="h-4 w-4 mr-2" />Download as Word (.docx)</>
                    )}
                  </Button>
                )}
                <Button onClick={onClose} size="lg">Close</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── Appraisal Export Button (reusable) ─────────────────────────────────────
function AppraisalExportButton({ appraisalId }: { appraisalId: number }) {
  const exportDocxMutation = trpc.appraisal.pace.exportDocx.useMutation({
    onSuccess: (data) => {
      const byteCharacters = atob(data.base64);
      const byteNumbers = new Array(byteCharacters.length).fill(0).map((_, i) => byteCharacters.charCodeAt(i));
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: data.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PACE document downloaded");
    },
    onError: (e) => toast.error("Export failed: " + e.message),
  });
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => exportDocxMutation.mutate({ id: appraisalId })}
      disabled={exportDocxMutation.isPending}
    >
      {exportDocxMutation.isPending ? (
        <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Generating…</>
      ) : (
        <><Download className="h-3 w-3 mr-1.5" />Download Word</>
      )}
    </Button>
  );
}
// ─── Main PersonProfile ───────────────────────────────────────────────────────
export default function PersonProfile({ personId }: { personId: number }) {
  const [, setLocation] = useLocation();
  const [editingReportsTo, setEditingReportsTo] = useState(false);
  const [selectedReportsTo, setSelectedReportsTo] = useState<string>("");
   const [showAppraisalWizard, setShowAppraisalWizard] = useState(false);
  const [expandedAppraisalId, setExpandedAppraisalId] = useState<number | null>(null);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const { data: person, isLoading } = trpc.person.getById.useQuery({ personId, tenantId: 1 });
  const { data: pastAppraisals } = trpc.appraisal.pace.list.useQuery({ personId });
  const { data: observations } = trpc.observation.getByPerson.useQuery({ personId, tenantId: 1 });
  const { data: reportsTo, refetch: refetchReportsTo } = trpc.person.getReportsTo.useQuery({ personId, tenantId: 1 });
  const { data: allPeople } = trpc.person.list.useQuery({ tenantId: 1 });

  const utils = trpc.useUtils();
  const updateReportsTo = trpc.person.updateReportsTo.useMutation({
    onSuccess: () => {
      toast.success("Reporting structure updated");
      refetchReportsTo();
      utils.person.getById.invalidate({ personId, tenantId: 1 });
      setEditingReportsTo(false);
    },
    onError: (err) => toast.error("Failed to update: " + err.message),
  });

  const handleSaveReportsTo = () => {
    if (selectedReportsTo === "none") {
      updateReportsTo.mutate({ tenantId: 1, personId, reportsToPersonId: null });
    } else if (selectedReportsTo) {
      updateReportsTo.mutate({ tenantId: 1, personId, reportsToPersonId: Number(selectedReportsTo) });
    }
  };

  const handleStartEdit = () => {
    setSelectedReportsTo(reportsTo ? String(reportsTo.id) : "none");
    setEditingReportsTo(true);
  };

  if (isLoading) return (
    <div className="animate-pulse space-y-4">
      <div className="h-24 bg-muted rounded-lg"/>
      <div className="h-48 bg-muted rounded-lg"/>
      <div className="h-32 bg-muted rounded-lg"/>
    </div>
  );
  if (!person) return <div className="text-muted-foreground p-8 text-center">Person not found</div>;

  const tenureMonths = person.hireDate
    ? Math.floor((Date.now() - new Date(person.hireDate).getTime()) / (1000 * 60 * 60 * 24 * 30))
    : null;

  const reportingOptions = (allPeople || []).filter(p => p.id !== personId);

  return (
    <>
      {showAppraisalWizard && (
        <PaceAppraisalWizard
          personId={personId}
          personName={person.name || "Unknown"}
          tenantId={1}
          onClose={() => setShowAppraisalWizard(false)}
        />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
              <span className="font-bold text-2xl text-accent">{person.name?.charAt(0) || "?"}</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold">{person.name}</h1>
              <p className="text-muted-foreground text-lg">{person.currentRole?.title || "No role assigned"}</p>
              {person.email && (
                <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>{person.email}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAppraisalWizard(true)}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Appraise
            </Button>
            <Button onClick={() => setLocation('/meetings')}>Schedule 1:1</Button>
          </div>
        </div>

        {/* AI Panel Review */}
        {person.currentRoleId && (
          <AIDeliberationPanel
            targetType="ROLE"
            targetId={person.currentRoleId}
            targetName={person.name ?? undefined}
          />
        )}

        {/* Reporting Structure Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Reporting Structure
              </CardTitle>
              {!editingReportsTo && (
                <Button variant="ghost" size="sm" onClick={handleStartEdit} className="h-8 px-2">
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Reports To</p>
              {editingReportsTo ? (
                <div className="flex items-center gap-2">
                  <Select value={selectedReportsTo} onValueChange={setSelectedReportsTo}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select manager..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— No manager (top of hierarchy)</SelectItem>
                      {reportingOptions.map(p => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={handleSaveReportsTo} disabled={updateReportsTo.isPending} className="h-9 px-3">
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingReportsTo(false)} className="h-9 px-3">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {reportsTo ? (
                    <button
                      onClick={() => setLocation(`/people/${reportsTo.id}`)}
                      className="flex items-center gap-2 text-sm hover:text-accent transition-colors group"
                    >
                      <div className="h-7 w-7 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold">
                        {reportsTo.name?.charAt(0)}
                      </div>
                      <span className="font-medium">{reportsTo.name}</span>
                      <span className="text-muted-foreground text-xs">{(reportsTo as any).currentRole?.title}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-accent" />
                    </button>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">Not set — click Edit to assign</span>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Data Sufficiency</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">Level {person.dataSufficiencyLevel || 0}</p>
              <p className="text-sm text-muted-foreground">{person.evidenceCount || 0} observations</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Sources</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{person.sourceCount || 0}</p>
              <p className="text-sm text-muted-foreground">unique observers</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Tenure</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{tenureMonths !== null ? tenureMonths : "—"}</p>
              <p className="text-sm text-muted-foreground">months</p>
            </CardContent>
          </Card>
        </div>

        {/* Role Mandate */}
        {person.currentRole && (
          <RoleMandateCard personId={personId} tenantId={1} role={person.currentRole} />
        )}

        {/* Role Details */}
        {person.currentRole && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Role Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Title</p>
                  <p className="font-medium">{person.currentRole.title}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Role Type</p>
                  <Badge variant="secondary" className="text-xs">
                    {person.currentRole.roleType?.replace(/_/g, " ")}
                  </Badge>
                </div>
                {person.currentRole.startDate && (
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">In Role Since</p>
                    <p className="font-medium">{new Date(person.currentRole.startDate).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Status</p>
                  <Badge variant={person.currentRole.isActive ? "default" : "secondary"} className="text-xs">
                    {person.currentRole.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

         {/* Self-Appraisal Upload */}
        <SelfAppraisalCard personId={personId} tenantId={1} />
        {/* Appraisal History */}
        {pastAppraisals && pastAppraisals.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-accent" />
                  Appraisal History ({pastAppraisals.length})
                </CardTitle>
                {pastAppraisals.length >= 2 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => setShowCompareModal(true)}
                  >
                    <GitCompare className="h-3.5 w-3.5" />
                    Compare Years
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {pastAppraisals.map((a) => {
                const pd = a.paceData as any;
                const isExpanded = expandedAppraisalId === a.id;
                return (
                  <div key={a.id} className="border rounded-lg overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                      onClick={() => setExpandedAppraisalId(isExpanded ? null : a.id)}
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant={a.status === 'FINAL' ? 'default' : 'secondary'} className="text-xs">
                          {a.status ?? 'DRAFT'}
                        </Badge>
                        <span className="font-medium text-sm">FY {a.fiscalYear ?? 'Unknown'}</span>
                        {pd?.quadrant && (
                          <Badge variant="outline" className="text-xs">{pd.quadrant.replace(/_/g, ' ')}</Badge>
                        )}
                        {pd?.fitDetermination && (
                          <span className="text-xs text-muted-foreground">{pd.fitDetermination}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(a.createdAt).toLocaleDateString()}
                        </span>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3 border-t bg-muted/20">
                        {a.aiSynthesisSummary && (
                          <div className="pt-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">AI Summary</p>
                            <p className="text-sm">{a.aiSynthesisSummary}</p>
                          </div>
                        )}
                        {pd?.appraiserOverallComments && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Appraiser Overall Comments</p>
                            <p className="text-sm">{pd.appraiserOverallComments}</p>
                          </div>
                        )}
                        {pd?.kpiRows && pd.kpiRows.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">KPI Assessment ({pd.kpiRows.length} KPIs)</p>
                            <div className="space-y-2">
                              {pd.kpiRows.map((row: any, i: number) => (
                                <div key={i} className="bg-background rounded p-2 text-xs">
                                  <p className="font-medium">{row.goalName || `KPI ${i + 1}`} {row.weightage && <span className="text-muted-foreground">({row.weightage})</span>}</p>
                                  {row.appraiserComments && <p className="text-muted-foreground mt-0.5">{row.appraiserComments}</p>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex gap-2 pt-1">
                          <AppraisalExportButton appraisalId={a.id} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
        {/* Recent Observations */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Observations</CardTitle>
          </CardHeader>
          <CardContent>
            {observations && observations.length > 0 ? (
              <div className="space-y-3">
                {observations.slice(0, 5).map((obs) => (
                  <div key={obs.id} className="border-l-4 border-accent pl-4 py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant={obs.direction === "POSITIVE" ? "default" : obs.direction === "NEEDS_IMPROVEMENT" ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {obs.direction?.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(obs.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm">{obs.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-3">No observations yet</p>
                <Button variant="outline" size="sm" onClick={() => setLocation('/capture')}>
                  Capture first observation
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Appraisal Comparison Modal */}
      {showCompareModal && pastAppraisals && pastAppraisals.length >= 2 && (
        <AppraisalCompareModal
          open={showCompareModal}
          onClose={() => setShowCompareModal(false)}
          personName={person?.name ?? ""}
          appraisals={pastAppraisals}
        />
      )}
    </>
  );
}
