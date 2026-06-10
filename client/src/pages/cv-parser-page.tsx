import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, getQueryFn } from "@/lib/queryClient";
import { getAccessToken } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  FileText,
  Trash2,
  Users,
  Sparkles,
  MapPin,
  Mail,
  Phone,
  Briefcase,
  GraduationCap,
  Code,
  Award,
  ArrowLeft,
  LogOut,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
  Search,
  Eye,
  Clock,
} from "lucide-react";

interface CandidateData {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  designation: string | null;
  summary: string | null;
  totalExperienceYears: number | null;
  skills: string[] | null;
  technologies: string[] | null;
  experience: { role: string; company: string; duration: string; description: string }[] | null;
  education: { degree: string; institution: string; year: string }[] | null;
  projects: { name: string; description: string; technologies: string[] }[] | null;
  certifications: string[] | null;
  languages: string[] | null;
  cvUrl: string | null;
  cvFileName: string | null;
  source: string | null;
  createdAt: string;
}

interface StatsData {
  total: number;
  byCvUpload: number;
  byExcelImport: number;
  byManual: number;
}

export default function CvParserPage() {
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [expandedCandidate, setExpandedCandidate] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<CandidateData | null>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();

  // Fetch candidates
  const { data: candidatesData, isLoading: candidatesLoading } = useQuery<{
    success: boolean;
    candidates: CandidateData[];
    total: number;
  }>({
    queryKey: ["/api/candidates"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Fetch stats
  const { data: statsData } = useQuery<{
    success: boolean;
    stats: StatsData;
  }>({
    queryKey: ["/api/candidates/stats"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Fetch credits
  const { data: credits } = useQuery<{ creditsRemaining: number }>({
    queryKey: ["/api/credits"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const candidates = candidatesData?.candidates || [];
  const stats = statsData?.stats || { total: 0, byCvUpload: 0, byExcelImport: 0, byManual: 0 };

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/candidates/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers,
      });
      if (!res.ok) throw new Error("Failed to delete candidate");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/candidates/stats"] });
      toast({ title: "Candidate deleted", description: "Candidate removed successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  // CV Upload handler
  const handleCvUpload = useCallback(async (file: File) => {
    if (file.type !== "application/pdf") {
      toast({ title: "Invalid file", description: "Please upload a PDF file", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 10MB", variant: "destructive" });
      return;
    }

    setIsParsing(true);
    setParsedPreview(null);
    try {
      const formData = new FormData();
      formData.append("cv", file);
      const token = getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/candidates/parse-cv", {
        method: "POST",
        body: formData,
        credentials: "include",
        headers,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to parse CV");
      }
      setParsedPreview(data.candidate);
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/candidates/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      toast({ title: "CV Parsed Successfully!", description: `Extracted data for ${data.candidate.fullName || "candidate"}` });
    } catch (err: any) {
      toast({ title: "CV Parsing Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsParsing(false);
    }
  }, [toast]);

  // Excel import handler
  const handleExcelImport = useCallback(async (file: File) => {
    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/candidates/import-excel", {
        method: "POST",
        body: formData,
        credentials: "include",
        headers,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to import file");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/candidates/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      toast({
        title: "Import Complete",
        description: `Imported ${data.imported} candidates. ${data.errors?.length || 0} errors.`,
      });
      setShowImportModal(false);
    } catch (err: any) {
      toast({ title: "Import Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  }, [toast]);

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleCvUpload(e.dataTransfer.files[0]);
  }, [handleCvUpload]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md shadow-sm border-b border-slate-200/60 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => (window.location.href = "/")}
                className="text-slate-500 hover:text-slate-800"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md shadow-violet-200">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">AI CV Parser</h1>
                <p className="text-xs text-slate-500">Upload, parse & manage candidates</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-full px-4 py-1.5">
                <Award className="h-4 w-4 text-violet-600" />
                <span className="text-sm font-semibold text-violet-700">{credits?.creditsRemaining ?? 0} credits</span>
              </div>
              {user?.role === 'recruiter' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => (window.location.href = "/search")}
                  className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                >
                  <Search className="h-4 w-4 mr-1" />
                  AI Search
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  logoutMutation.mutate(undefined, { onSuccess: () => (window.location.href = "/") })
                }
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Candidates", value: stats.total, icon: Users, color: "from-blue-500 to-blue-600", bg: "bg-blue-50" },
            { label: "CV Uploads", value: stats.byCvUpload, icon: FileText, color: "from-violet-500 to-violet-600", bg: "bg-violet-50" },
            { label: "Excel Imports", value: stats.byExcelImport, icon: FileSpreadsheet, color: "from-emerald-500 to-emerald-600", bg: "bg-emerald-50" },
            { label: "Credits Left", value: credits?.creditsRemaining ?? 0, icon: Award, color: "from-amber-500 to-amber-600", bg: "bg-amber-50" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 bg-gradient-to-br ${color} bg-clip-text`} style={{ color: color.includes("blue") ? "#3b82f6" : color.includes("violet") ? "#8b5cf6" : color.includes("emerald") ? "#10b981" : "#f59e0b" }} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{value}</p>
                  <p className="text-xs text-slate-500">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column — Upload Area */}
          <div className="space-y-6">
            {/* CV Upload Zone */}
            <Card className="border-0 shadow-sm overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-violet-500 to-indigo-600 text-white pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="w-5 h-5" />
                  AI CV Parser
                </CardTitle>
                <p className="text-violet-100 text-sm mt-1">Upload a PDF resume to extract candidate data with AI</p>
              </CardHeader>
              <CardContent className="p-6">
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => cvInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
                    dragActive
                      ? "border-violet-400 bg-violet-50 scale-[1.02]"
                      : isParsing
                        ? "border-violet-300 bg-violet-50/50"
                        : "border-slate-200 hover:border-violet-300 hover:bg-violet-50/30"
                  }`}
                >
                  {isParsing ? (
                    <div className="space-y-4">
                      <div className="relative mx-auto w-16 h-16">
                        <div className="absolute inset-0 rounded-full border-4 border-violet-200"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-violet-500 border-t-transparent animate-spin"></div>
                        <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-violet-500 animate-pulse" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-700">AI is parsing your CV...</p>
                        <p className="text-sm text-slate-500 mt-1">Extracting skills, experience, education & more</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="mx-auto w-14 h-14 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center">
                        <Upload className="w-7 h-7 text-violet-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-700">Drop PDF here or click to upload</p>
                        <p className="text-sm text-slate-400 mt-1">PDF files up to 10MB • Costs 10 credits</p>
                      </div>
                    </div>
                  )}
                  <input
                    ref={cvInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleCvUpload(e.target.files[0]);
                      e.target.value = "";
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Excel Import */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">Excel Import</h3>
                      <p className="text-xs text-slate-500">Bulk upload candidates (1 credit/row)</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => excelInputRef.current?.click()}
                    disabled={isImporting}
                    className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    {isImporting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
                    {isImporting ? "Importing..." : "Upload"}
                  </Button>
                  <input
                    ref={excelInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleExcelImport(e.target.files[0]);
                      e.target.value = "";
                    }}
                  />
                </div>
                <p className="text-xs text-slate-400">
                  Supported columns: Name, Email, Phone, Skills, Location, Experience, Designation, Technologies, etc.
                </p>
              </CardContent>
            </Card>

            {/* Parsed Preview */}
            {parsedPreview && (
              <Card className="border-0 shadow-sm border-l-4 border-l-violet-500">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-violet-500" />
                      Just Parsed
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setParsedPreview(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="font-semibold text-slate-800 text-lg">{parsedPreview.fullName || "Unknown"}</p>
                    <p className="text-sm text-violet-600 font-medium">{parsedPreview.designation || "—"}</p>
                  </div>
                  {parsedPreview.location && (
                    <div className="flex items-center gap-1.5 text-sm text-slate-500">
                      <MapPin className="w-3.5 h-3.5" /> {parsedPreview.location}
                    </div>
                  )}
                  {parsedPreview.totalExperienceYears != null && (
                    <div className="flex items-center gap-1.5 text-sm text-slate-500">
                      <Briefcase className="w-3.5 h-3.5" /> {parsedPreview.totalExperienceYears} years experience
                    </div>
                  )}
                  {parsedPreview.skills && parsedPreview.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {parsedPreview.skills.slice(0, 8).map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs bg-violet-50 text-violet-700 border-violet-200">
                          {s}
                        </Badge>
                      ))}
                      {parsedPreview.skills.length > 8 && (
                        <Badge variant="secondary" className="text-xs">+{parsedPreview.skills.length - 8}</Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column — Candidate List */}
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-slate-600" />
                    Candidates ({candidatesData?.total || 0})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {candidatesLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse bg-slate-100 rounded-xl h-24"></div>
                    ))}
                  </div>
                ) : candidates.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center mb-4">
                      <Users className="w-10 h-10 text-violet-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-700">No candidates yet</h3>
                    <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">
                      Upload a CV to parse with AI, or import candidates from an Excel file to get started.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {candidates.map((candidate) => (
                      <div
                        key={candidate.id}
                        className="border border-slate-100 rounded-xl p-4 hover:border-violet-200 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                {(candidate.fullName || "?")[0]?.toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-semibold text-slate-800 truncate">{candidate.fullName || "Unknown"}</h4>
                                <p className="text-sm text-slate-500 truncate">{candidate.designation || "No title"}</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-500">
                              {candidate.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" /> {candidate.location}
                                </span>
                              )}
                              {candidate.totalExperienceYears != null && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> {candidate.totalExperienceYears}y exp
                                </span>
                              )}
                              {candidate.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3 h-3" /> {candidate.email}
                                </span>
                              )}
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {candidate.source === "cv_upload" ? "CV" : candidate.source === "excel_import" ? "Excel" : "Manual"}
                              </Badge>
                            </div>
                            {candidate.skills && candidate.skills.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2.5">
                                {candidate.skills.slice(0, 5).map((s) => (
                                  <Badge
                                    key={s}
                                    variant="secondary"
                                    className="text-[10px] px-2 py-0 bg-blue-50 text-blue-700 border-0"
                                  >
                                    {s}
                                  </Badge>
                                ))}
                                {candidate.skills.length > 5 && (
                                  <Badge variant="secondary" className="text-[10px] px-2 py-0">
                                    +{candidate.skills.length - 5}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setExpandedCandidate(expandedCandidate === candidate.id ? null : candidate.id)
                              }
                              className="text-slate-400 hover:text-slate-600 h-8 w-8 p-0"
                            >
                              {expandedCandidate === candidate.id ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteMutation.mutate(candidate.id)}
                              disabled={deleteMutation.isPending}
                              className="text-red-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {expandedCandidate === candidate.id && (
                          <div className="mt-4 pt-4 border-t border-slate-100 space-y-4 animate-in slide-in-from-top-2 duration-200">
                            {candidate.summary && (
                              <div>
                                <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Summary</h5>
                                <p className="text-sm text-slate-700 leading-relaxed">{candidate.summary}</p>
                              </div>
                            )}

                            {candidate.technologies && candidate.technologies.length > 0 && (
                              <div>
                                <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Technologies</h5>
                                <div className="flex flex-wrap gap-1.5">
                                  {candidate.technologies.map((t) => (
                                    <Badge key={t} variant="secondary" className="text-xs bg-indigo-50 text-indigo-700">
                                      {t}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {candidate.experience && candidate.experience.length > 0 && (
                              <div>
                                <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                  <Briefcase className="w-3 h-3 inline mr-1" />
                                  Experience
                                </h5>
                                <div className="space-y-2.5">
                                  {candidate.experience.map((exp, i) => (
                                    <div key={i} className="bg-slate-50 rounded-lg p-3">
                                      <p className="font-medium text-sm text-slate-800">{exp.role}</p>
                                      <p className="text-xs text-slate-500">{exp.company} • {exp.duration}</p>
                                      {exp.description && (
                                        <p className="text-xs text-slate-600 mt-1">{exp.description}</p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {candidate.education && candidate.education.length > 0 && (
                              <div>
                                <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                  <GraduationCap className="w-3 h-3 inline mr-1" />
                                  Education
                                </h5>
                                <div className="space-y-2">
                                  {candidate.education.map((edu, i) => (
                                    <div key={i} className="bg-slate-50 rounded-lg p-3">
                                      <p className="font-medium text-sm text-slate-800">{edu.degree}</p>
                                      <p className="text-xs text-slate-500">{edu.institution} • {edu.year}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {candidate.projects && candidate.projects.length > 0 && (
                              <div>
                                <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                  <Code className="w-3 h-3 inline mr-1" />
                                  Projects
                                </h5>
                                <div className="space-y-2">
                                  {candidate.projects.map((proj, i) => (
                                    <div key={i} className="bg-slate-50 rounded-lg p-3">
                                      <p className="font-medium text-sm text-slate-800">{proj.name}</p>
                                      <p className="text-xs text-slate-600">{proj.description}</p>
                                      {proj.technologies?.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                          {proj.technologies.map((t) => (
                                            <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0">
                                              {t}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {candidate.certifications && candidate.certifications.length > 0 && (
                              <div>
                                <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                                  <Award className="w-3 h-3 inline mr-1" />
                                  Certifications
                                </h5>
                                <div className="flex flex-wrap gap-1.5">
                                  {candidate.certifications.map((c) => (
                                    <Badge key={c} variant="secondary" className="text-xs bg-amber-50 text-amber-700">
                                      {c}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="flex items-center gap-3 pt-2">
                              {candidate.phone && (
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                  <Phone className="w-3 h-3" /> {candidate.phone}
                                </span>
                              )}
                              {candidate.cvUrl && (
                                <a
                                  href={candidate.cvUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-violet-600 hover:underline flex items-center gap-1"
                                >
                                  <FileText className="w-3 h-3" /> View CV
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
