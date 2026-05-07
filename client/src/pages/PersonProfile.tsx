import { useState, useRef } from "react";
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
  ClipboardList, ChevronDown, ChevronUp
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import AIDeliberationPanel from "@/components/AIDeliberationPanel";

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
                              {row.selfAppraisal && <p className="text-muted-foreground mt-0.5">Self: {row.selfAppraisal}</p>}
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Role Mandate
          </CardTitle>
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
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Purpose */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Purpose</p>
          {editing ? (
            <Textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="What does this role exist to do? (1–2 sentences)"
              className="min-h-[72px] text-sm"
            />
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

// ─── PACE Appraisal Wizard ────────────────────────────────────────────────────
function PaceAppraisalWizard({ personId, personName, tenantId, onClose }: {
  personId: number; personName: string; tenantId: number; onClose: () => void;
}) {
  const [step, setStep] = useState<"select" | "synthesising" | "review" | "done">("select");
  const [selectedAppraisalId, setSelectedAppraisalId] = useState<number | undefined>();
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear().toString());
  const [appraisalData, setAppraisalData] = useState<any>(null);
  const [editedRows, setEditedRows] = useState<Record<number, string>>({});
  const [overallComments, setOverallComments] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: selfAppraisals } = trpc.appraisal.selfAppraisal.list.useQuery({ personId });
  const synthesise = trpc.appraisal.pace.synthesise.useMutation({
    onSuccess: (data) => {
      setAppraisalData(data);
      // Pre-fill editable fields from AI output
      const rows: Record<number, string> = {};
      data.paceData?.kpiRows?.forEach((row: any, i: number) => {
        rows[i] = row.appraiserComments || "";
      });
      setEditedRows(rows);
      setOverallComments(data.paceData?.appraiserOverallComments || "");
      setStep("review");
    },
    onError: (e) => { toast.error("Synthesis failed: " + e.message); setStep("select"); },
  });
  const saveAppraisal = trpc.appraisal.pace.save.useMutation({
    onSuccess: () => { toast.success("Appraisal saved"); setStep("done"); },
    onError: (e) => toast.error(e.message),
  });

  const handleSynthesize = () => {
    setStep("synthesising");
    synthesise.mutate({ personId, selfAppraisalId: selectedAppraisalId, fiscalYear });
  };

  const handleSave = async () => {
    if (!appraisalData?.id) return;
    setSaving(true);
    // Merge edited rows back into paceData
    const updatedPaceData = {
      ...appraisalData.paceData,
      kpiRows: appraisalData.paceData?.kpiRows?.map((row: any, i: number) => ({
        ...row,
        appraiserComments: editedRows[i] ?? row.appraiserComments,
      })),
      appraiserOverallComments: overallComments,
    };
    saveAppraisal.mutate({
      id: appraisalData.id,
      paceData: updatedPaceData,
      status: "FINAL",
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              PACE Appraisal — {personName}
            </h2>
            <p className="text-muted-foreground text-sm mt-0.5">AI-assisted appraisal using all available data</p>
          </div>
          <Button variant="ghost" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>

        {/* Step: Select */}
        {step === "select" && (
          <Card>
            <CardHeader><CardTitle>Configure Appraisal</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Fiscal Year</label>
                <Input
                  value={fiscalYear}
                  onChange={(e) => setFiscalYear(e.target.value)}
                  placeholder="e.g. FY25-26"
                  className="max-w-xs"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Self-Appraisal Document (optional)</label>
                {selfAppraisals && selfAppraisals.length > 0 ? (
                  <Select value={selectedAppraisalId?.toString() || "none"} onValueChange={(v) => setSelectedAppraisalId(v === "none" ? undefined : Number(v))}>
                    <SelectTrigger className="max-w-sm">
                      <SelectValue placeholder="Select self-appraisal…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— No self-appraisal (use observations only)</SelectItem>
                      {selfAppraisals.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.fileName} {a.fiscalYear ? `(FY ${a.fiscalYear})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground">No self-appraisals uploaded yet. The AI will use observations and goals only.</p>
                )}
              </div>
              <div className="pt-2">
                <Button onClick={handleSynthesize} className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Generate AI Appraisal
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Synthesising */}
        {step === "synthesising" && (
          <Card>
            <CardContent className="py-16 text-center space-y-4">
              <Loader2 className="h-10 w-10 animate-spin text-accent mx-auto" />
              <div>
                <p className="font-semibold text-lg">Synthesising appraisal…</p>
                <p className="text-muted-foreground text-sm mt-1">
                  Reading observations, goals, financial data, and self-appraisal. This may take 15–30 seconds.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Review */}
        {step === "review" && appraisalData && (
          <div className="space-y-4">
            {/* AI Signal Summary */}
            {appraisalData.aiSignalSummary && (
              <Card className="border-accent/30 bg-accent/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-accent" /> AI Signal Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  {appraisalData.aiSignalSummary.strengths?.length > 0 && (
                    <div>
                      <p className="font-medium text-emerald-600 dark:text-emerald-400">Strengths</p>
                      <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                        {appraisalData.aiSignalSummary.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                  {appraisalData.aiSignalSummary.concerns?.length > 0 && (
                    <div>
                      <p className="font-medium text-amber-600 dark:text-amber-400">Areas for Development</p>
                      <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                        {appraisalData.aiSignalSummary.concerns.map((c: string, i: number) => <li key={i}>{c}</li>)}
                      </ul>
                    </div>
                  )}
                  {appraisalData.aiSignalSummary.overallNarrative && (
                    <p className="text-muted-foreground italic">{appraisalData.aiSignalSummary.overallNarrative}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* KPI Rows */}
            {appraisalData.paceData?.kpiRows?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">KPI Appraisal — Edit Appraiser Comments</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {appraisalData.paceData.kpiRows.map((row: any, i: number) => (
                    <div key={i} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm">{row.goalName || row.kpiName || `KPI ${i + 1}`}</p>
                          {row.weightage && <Badge variant="secondary" className="text-xs mt-0.5">{row.weightage}% weight</Badge>}
                        </div>
                      </div>
                      {row.selfAppraisal && (
                        <div className="bg-muted/40 rounded p-2 text-xs">
                          <span className="font-medium text-muted-foreground">Self: </span>
                          {row.selfAppraisal}
                        </div>
                      )}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Your Appraiser Comment</label>
                        <Textarea
                          value={editedRows[i] || ""}
                          onChange={(e) => setEditedRows({ ...editedRows, [i]: e.target.value })}
                          placeholder="Enter your assessment of this KPI…"
                          className="min-h-[72px] text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Overall Comments */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Overall Appraiser Comments</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={overallComments}
                  onChange={(e) => setOverallComments(e.target.value)}
                  placeholder="Your overall assessment of this person's performance and potential…"
                  className="min-h-[120px] text-sm"
                />
              </CardContent>
            </Card>

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setStep("select")}>← Regenerate</Button>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Finalise Appraisal
              </Button>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
                <Check className="h-8 w-8 text-emerald-500" />
              </div>
              <div>
                <p className="font-semibold text-xl">Appraisal Finalised</p>
                <p className="text-muted-foreground text-sm mt-1">
                  The PACE appraisal for {personName} has been saved.
                </p>
              </div>
              <Button onClick={onClose}>Close</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── Main PersonProfile ───────────────────────────────────────────────────────
export default function PersonProfile({ personId }: { personId: number }) {
  const [, setLocation] = useLocation();
  const [editingReportsTo, setEditingReportsTo] = useState(false);
  const [selectedReportsTo, setSelectedReportsTo] = useState<string>("");
  const [showAppraisalWizard, setShowAppraisalWizard] = useState(false);

  const { data: person, isLoading } = trpc.person.getById.useQuery({ personId, tenantId: 1 });
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
    </>
  );
}
