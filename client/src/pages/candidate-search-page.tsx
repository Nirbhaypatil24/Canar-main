import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn, getAccessToken } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
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
  Users,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
  Loader2,
  Zap,
  Eye,
  X,
  History,
  ArrowRight,
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
  source: string | null;
  createdAt: string;
}

interface SearchIntent {
  skills: string[];
  technologies: string[];
  minExperienceYears: number | null;
  maxExperienceYears: number | null;
  location: string | null;
  designation: string | null;
  keywords: string[];
}

const EXAMPLE_QUERIES = [
  "React developer with 3+ years experience",
  "Java developer with AWS experience",
  "Backend developer with microservices",
  "Full-stack developer from Pune",
  "Python developer with machine learning",
  "Senior frontend engineer",
  "Node.js with MongoDB experience",
  "DevOps engineer with Kubernetes",
];

export default function CandidateSearchPage() {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<CandidateData[] | null>(null);
  const [searchIntent, setSearchIntent] = useState<SearchIntent | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const { logoutMutation } = useAuth();
  const { toast } = useToast();

  // Fetch credits
  const { data: credits } = useQuery<{ creditsRemaining: number }>({
    queryKey: ["/api/credits"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const handleSearch = useCallback(
    async (searchQuery?: string) => {
      const q = (searchQuery || query).trim();
      if (!q) {
        toast({ title: "Enter a query", description: "Type a natural language search query", variant: "destructive" });
        return;
      }

      setIsSearching(true);
      setResults(null);
      setSearchIntent(null);

      try {
        const token = getAccessToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch("/api/candidates/search", {
          method: "POST",
          headers,
          body: JSON.stringify({ query: q }),
          credentials: "include",
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || "Search failed");
        }

        setResults(data.candidates);
        setSearchIntent(data.searchIntent);
        setQuery(q);

        // Add to history
        setSearchHistory((prev) => {
          const filtered = prev.filter((h) => h !== q);
          return [q, ...filtered].slice(0, 10);
        });
      } catch (err: any) {
        toast({ title: "Search Failed", description: err.message, variant: "destructive" });
      } finally {
        setIsSearching(false);
      }
    },
    [query, toast]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/20 to-purple-50/10">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md shadow-sm border-b border-slate-200/60 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
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
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-200">
                <Search className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">AI Candidate Search</h1>
                <p className="text-xs text-slate-500">Natural language powered</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-full px-4 py-1.5">
                <Award className="h-4 w-4 text-indigo-600" />
                <span className="text-sm font-semibold text-indigo-700">{credits?.creditsRemaining ?? 0} credits</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => (window.location.href = "/candidates")}
                className="border-violet-200 text-violet-700 hover:bg-violet-50"
              >
                <Users className="h-4 w-4 mr-1" />
                CV Parser
              </Button>
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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Area */}
        <div className="max-w-3xl mx-auto mb-10">
          {/* Search Input */}
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl opacity-20 group-hover:opacity-30 group-focus-within:opacity-40 blur transition-all duration-300"></div>
            <div className="relative bg-white rounded-2xl shadow-lg border border-slate-200/60 flex items-center gap-3 px-5 py-3">
              <div className="flex-shrink-0">
                {isSearching ? (
                  <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                ) : (
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                )}
              </div>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
                placeholder="Search candidates with natural language..."
                className="flex-1 bg-transparent border-0 outline-none text-slate-800 placeholder:text-slate-400 text-base"
                disabled={isSearching}
              />
              {query && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setQuery("");
                    setResults(null);
                    setSearchIntent(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
              <Button
                onClick={() => handleSearch()}
                disabled={isSearching || !query.trim()}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl px-5 shadow-md shadow-indigo-200"
              >
                {isSearching ? "Searching..." : "Search"}
                <Zap className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
          <p className="text-center text-xs text-slate-400 mt-2.5">Each search costs 2 credits • AI extracts skills, experience, location & more from your query</p>

          {/* Example Queries */}
          {!results && (
            <div className="mt-6">
              <p className="text-xs text-slate-500 mb-3 text-center">Try these example searches:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {EXAMPLE_QUERIES.map((eq) => (
                  <button
                    key={eq}
                    onClick={() => {
                      setQuery(eq);
                      handleSearch(eq);
                    }}
                    className="text-xs px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50 transition-all duration-200 shadow-sm"
                  >
                    {eq}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search History */}
          {!results && searchHistory.length > 0 && (
            <div className="mt-6">
              <p className="text-xs text-slate-500 mb-2 flex items-center gap-1 justify-center">
                <History className="w-3 h-3" /> Recent searches
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {searchHistory.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setQuery(h);
                      handleSearch(h);
                    }}
                    className="text-xs px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100 text-slate-500 hover:border-indigo-200 hover:text-indigo-600 transition-all"
                  >
                    <Clock className="w-3 h-3 inline mr-1" />
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Search Intent Display */}
        {searchIntent && (
          <div className="max-w-3xl mx-auto mb-6">
            <Card className="border-0 shadow-sm bg-gradient-to-r from-indigo-50/50 to-purple-50/50 border-l-4 border-l-indigo-400">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> AI understood your query as
                </p>
                <div className="flex flex-wrap gap-2">
                  {searchIntent.technologies?.map((t) => (
                    <Badge key={t} className="bg-indigo-100 text-indigo-700 border-0 text-xs">{t}</Badge>
                  ))}
                  {searchIntent.skills?.map((s) => (
                    <Badge key={s} className="bg-purple-100 text-purple-700 border-0 text-xs">{s}</Badge>
                  ))}
                  {searchIntent.minExperienceYears != null && (
                    <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">
                      {searchIntent.minExperienceYears}+ years
                      {searchIntent.maxExperienceYears != null && ` to ${searchIntent.maxExperienceYears}`}
                    </Badge>
                  )}
                  {searchIntent.location && (
                    <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">
                      <MapPin className="w-3 h-3 mr-0.5" /> {searchIntent.location}
                    </Badge>
                  )}
                  {searchIntent.designation && (
                    <Badge className="bg-sky-100 text-sky-700 border-0 text-xs">
                      <Briefcase className="w-3 h-3 mr-0.5" /> {searchIntent.designation}
                    </Badge>
                  )}
                  {searchIntent.keywords?.map((k) => (
                    <Badge key={k} variant="outline" className="text-xs text-slate-600">{k}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Results */}
        {results !== null && (
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" />
                {results.length === 0 ? "No matches found" : `${results.length} candidate${results.length !== 1 ? "s" : ""} found`}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setResults(null);
                  setSearchIntent(null);
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="text-slate-500"
              >
                Clear results
              </Button>
            </div>

            {results.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-12 text-center">
                  <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                    <Search className="w-8 h-8 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-700">No matching candidates</h3>
                  <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">
                    Try a different query, or upload more candidates through the CV Parser or Excel import.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => (window.location.href = "/candidates")}
                    className="mt-4"
                  >
                    <ArrowRight className="w-4 h-4 mr-1" />
                    Go to CV Parser
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {results.map((candidate) => (
                  <Card
                    key={candidate.id}
                    className="border-0 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-sm">
                              {(candidate.fullName || "?")[0]?.toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-bold text-slate-900 text-base truncate">{candidate.fullName || "Unknown"}</h3>
                              <p className="text-sm text-indigo-600 font-medium truncate">{candidate.designation || "—"}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-500">
                            {candidate.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-amber-500" /> {candidate.location}
                              </span>
                            )}
                            {candidate.totalExperienceYears != null && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-emerald-500" /> {candidate.totalExperienceYears} years
                              </span>
                            )}
                            {candidate.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3.5 h-3.5 text-blue-500" /> {candidate.email}
                              </span>
                            )}
                            {candidate.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3.5 h-3.5 text-green-500" /> {candidate.phone}
                              </span>
                            )}
                          </div>

                          {/* Skills & Technologies */}
                          <div className="mt-3 space-y-2">
                            {candidate.skills && candidate.skills.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {candidate.skills.slice(0, 6).map((s) => (
                                  <Badge
                                    key={s}
                                    variant="secondary"
                                    className="text-xs bg-purple-50 text-purple-700 border-0"
                                  >
                                    {s}
                                  </Badge>
                                ))}
                                {candidate.skills.length > 6 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{candidate.skills.length - 6}
                                  </Badge>
                                )}
                              </div>
                            )}
                            {candidate.technologies && candidate.technologies.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {candidate.technologies.slice(0, 6).map((t) => (
                                  <Badge
                                    key={t}
                                    variant="secondary"
                                    className="text-xs bg-indigo-50 text-indigo-700 border-0"
                                  >
                                    {t}
                                  </Badge>
                                ))}
                                {candidate.technologies.length > 6 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{candidate.technologies.length - 6}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedId(expandedId === candidate.id ? null : candidate.id)}
                          className="text-slate-400 hover:text-slate-600 ml-2 flex-shrink-0"
                        >
                          {expandedId === candidate.id ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <Eye className="w-5 h-5" />
                          )}
                        </Button>
                      </div>

                      {/* Expanded */}
                      {expandedId === candidate.id && (
                        <div className="mt-5 pt-5 border-t border-slate-100 space-y-4 animate-in slide-in-from-top-2 duration-200">
                          {candidate.summary && (
                            <div>
                              <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Summary</h5>
                              <p className="text-sm text-slate-700 leading-relaxed">{candidate.summary}</p>
                            </div>
                          )}

                          {candidate.experience && candidate.experience.length > 0 && (
                            <div>
                              <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                <Briefcase className="w-3 h-3" /> Experience
                              </h5>
                              <div className="space-y-2">
                                {candidate.experience.map((exp, i) => (
                                  <div key={i} className="bg-slate-50 rounded-lg p-3">
                                    <p className="font-medium text-sm text-slate-800">{exp.role}</p>
                                    <p className="text-xs text-slate-500">{exp.company} • {exp.duration}</p>
                                    {exp.description && <p className="text-xs text-slate-600 mt-1">{exp.description}</p>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {candidate.education && candidate.education.length > 0 && (
                            <div>
                              <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                <GraduationCap className="w-3 h-3" /> Education
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
                              <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                <Code className="w-3 h-3" /> Projects
                              </h5>
                              <div className="space-y-2">
                                {candidate.projects.map((proj, i) => (
                                  <div key={i} className="bg-slate-50 rounded-lg p-3">
                                    <p className="font-medium text-sm text-slate-800">{proj.name}</p>
                                    <p className="text-xs text-slate-600">{proj.description}</p>
                                    {proj.technologies?.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1.5">
                                        {proj.technologies.map((t) => (
                                          <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0">{t}</Badge>
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
                              <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                <Award className="w-3 h-3" /> Certifications
                              </h5>
                              <div className="flex flex-wrap gap-1.5">
                                {candidate.certifications.map((c) => (
                                  <Badge key={c} className="bg-amber-50 text-amber-700 border-0 text-xs">{c}</Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {candidate.cvUrl && (
                            <div className="pt-2">
                              <a
                                href={candidate.cvUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                              >
                                <FileText className="w-3 h-3" /> View original CV
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty State when no search done */}
        {results === null && !isSearching && (
          <div className="max-w-2xl mx-auto text-center mt-8">
            <div className="mx-auto w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mb-6 shadow-inner">
              <Search className="w-12 h-12 text-indigo-300" />
            </div>
            <h2 className="text-2xl font-bold text-slate-700 mb-2">Search your candidate pool</h2>
            <p className="text-slate-500 max-w-lg mx-auto">
              Use natural language to find the perfect candidates. Our AI understands skills, experience levels,
              locations, and technologies from your query.
            </p>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
              {[
                { icon: Sparkles, title: "AI-Powered", desc: "Natural language queries parsed by Gemini AI" },
                { icon: Zap, title: "Instant Results", desc: "Search across skills, experience & location" },
                { icon: Users, title: "Smart Matching", desc: "Finds candidates matching multiple criteria" },
              ].map(({ icon: Icon, title, desc }) => (
                <Card key={title} className="border-0 shadow-sm">
                  <CardContent className="p-5">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center mb-3">
                      <Icon className="w-5 h-5 text-indigo-500" />
                    </div>
                    <h3 className="font-semibold text-sm text-slate-800">{title}</h3>
                    <p className="text-xs text-slate-500 mt-1">{desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Loading State */}
        {isSearching && (
          <div className="max-w-3xl mx-auto">
            <div className="text-center py-16">
              <div className="relative mx-auto w-20 h-20 mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-indigo-100"></div>
                <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
                <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-indigo-500 animate-pulse" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700">AI is searching...</h3>
              <p className="text-sm text-slate-500 mt-1">Analyzing your query and matching candidates</p>
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse bg-white rounded-xl h-28 shadow-sm"></div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
