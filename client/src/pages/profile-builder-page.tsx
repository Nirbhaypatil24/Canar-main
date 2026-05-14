import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { CreditCounter } from "@/components/credit-counter";
import { AutosaveToast } from "@/components/autosave-toast";
import { CreditTopupModal } from "@/components/modals/credit-topup-modal";
import { ShareProfileModal } from "@/components/modals/share-profile-modal";
import { Plus, Trash2, FileText, Share, Upload, Eye, Edit, GraduationCap, Code, Briefcase, Award, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import debounce from "lodash.debounce";
import { PhotoUpload, CVUpload } from "@/components/file-upload";
import { generateProfilePDF } from "@/lib/pdf-generator";

interface ProfileData {
  id?: string;
  name?: string;
  email?: string;
  bio?: string;
  photoUrl?: string;
  cvUrl?: string;
  shareSlug?: string;
  education: Array<{
    id?: string;
    degree: string;
    university: string;
    duration: string;
  }>;
  projects: Array<{
    id?: string;
    name: string;
    description: string;
    link: string;
    duration: string;
  }>;
  skills: Array<{
    id?: string;
    name: string;
    proficiency: string;
  }>;
  experiences: Array<{
    id?: string;
    role: string;
    company: string;
    duration: string;
    description: string;
  }>;
}

export default function ProfileBuilderPage() {
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAutosaveToast, setShowAutosaveToast] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: profile, isLoading } = useQuery<ProfileData>({
    queryKey: ["/api/profile"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/profile");
      const profileData = await res.json();
      const { profile } = profileData;
      delete profileData.profile;
      return { ...profile, ...profileData };
    }
  });
  const { data: credits } = useQuery<{ creditsRemaining: number, hasSubscription: boolean, planType: string }>({
    queryKey: ["/api/credits"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/credits");
      return res.json();
    }
  });

  // Profile update mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<ProfileData>) => {
      const res = await apiRequest("PUT", "/api/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      setShowAutosaveToast(true);
    },
    onError: (error: Error) => {
      if (error.message.includes("Insufficient credits") || error.message.includes("Insufficient Credits")) {
        toast({
          title: "Insufficient Credits",
          description: "Please top-up your credits to continue editing.",
          variant: "destructive",
        });
        setShowCreditModal(true);
      } else {
        toast({
          title: "Save Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  // Education mutations
  const addEducationMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/education", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      setShowAutosaveToast(true);
    },
    onError: (error: Error) => {
      if (error.message.includes("Insufficient credits") || error.message.includes("Insufficient Credits")) {
        toast({
          title: "Insufficient Credits",
          description: "Please top-up your credits to continue editing.",
          variant: "destructive",
        });
        setShowCreditModal(true);
      } else {
        toast({
          title: "Add Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const updateEducationMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const res = await apiRequest("PUT", `/api/education/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      setShowAutosaveToast(true);
    },
    onError: (error: Error) => {
      if (error.message.includes("Insufficient credits") || error.message.includes("Insufficient Credits")) {
        toast({
          title: "Insufficient Credits",
          description: "Please top-up your credits to continue editing.",
          variant: "destructive",
        });
        setShowCreditModal(true);
      } else {
        toast({
          title: "Update Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const deleteEducationMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/education/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
    },
  });

  // Project mutations
  const addProjectMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/projects", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      setShowAutosaveToast(true);
    },
    onError: (error: Error) => {
      if (error.message.includes("Insufficient credits") || error.message.includes("Insufficient Credits")) {
        toast({
          title: "Insufficient Credits",
          description: "Please top-up your credits to continue editing.",
          variant: "destructive",
        });
        setShowCreditModal(true);
      } else {
        toast({
          title: "Add Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const res = await apiRequest("PUT", `/api/projects/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      setShowAutosaveToast(true);
    },
    onError: (error: Error) => {
      if (error.message.includes("Insufficient credits") || error.message.includes("Insufficient Credits")) {
        toast({
          title: "Insufficient Credits",
          description: "Please top-up your credits to continue editing.",
          variant: "destructive",
        });
        setShowCreditModal(true);
      } else {
        toast({
          title: "Update Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
    },
  });
  //credit mutations
  const addCreditMutation = useMutation({
    mutationFn: async ({ credits, amount }: { credits: number, amount: number }) => {
      const res = await apiRequest("POST", "/api/subscription/credits/topup", { credits, amount });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      setShowAutosaveToast(true);
    },
  });


  // Skill mutations
  const addSkillMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/skills", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      setShowAutosaveToast(true);
    },
    onError: (error: Error) => {
      if (error.message.includes("Insufficient credits") || error.message.includes("Insufficient Credits")) {
        toast({
          title: "Insufficient Credits",
          description: "Please top-up your credits to continue editing.",
          variant: "destructive",
        });
        setShowCreditModal(true);
      } else {
        toast({
          title: "Add Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const updateSkillMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const res = await apiRequest("PUT", `/api/skills/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      setShowAutosaveToast(true);
    },
    onError: (error: Error) => {
      if (error.message.includes("Insufficient credits") || error.message.includes("Insufficient Credits")) {
        toast({
          title: "Insufficient Credits",
          description: "Please top-up your credits to continue editing.",
          variant: "destructive",
        });
        setShowCreditModal(true);
      } else {
        toast({
          title: "Update Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const deleteSkillMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/skills/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
    },
  });

  // Experience mutations
  const addExperienceMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/experiences", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      setShowAutosaveToast(true);
    },
    onError: (error: Error) => {
      if (error.message.includes("Insufficient credits") || error.message.includes("Insufficient Credits")) {
        toast({
          title: "Insufficient Credits",
          description: "Please top-up your credits to continue editing.",
          variant: "destructive",
        });
        setShowCreditModal(true);
      } else {
        toast({
          title: "Add Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const updateExperienceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const res = await apiRequest("PUT", `/api/experiences/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      setShowAutosaveToast(true);
    },
    onError: (error: Error) => {
      if (error.message.includes("Insufficient credits") || error.message.includes("Insufficient Credits")) {
        toast({
          title: "Insufficient Credits",
          description: "Please top-up your credits to continue editing.",
          variant: "destructive",
        });
        setShowCreditModal(true);
      } else {
        toast({
          title: "Update Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const deleteExperienceMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/experiences/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
    },
  });

  // Check if user can edit (has sufficient credits)
  const canEdit = credits?.creditsRemaining && credits.creditsRemaining >= 5;

  // Debounced autosave function
  const debouncedAutosave = useCallback(
    debounce((field: string, value: string) => {
      if (canEdit) {
        updateProfileMutation.mutate({ [field]: value });
      }
    }, 1000),
    [canEdit]
  );

  const handleInputChange = (field: string, value: string) => {
    debouncedAutosave(field, value);
  };

  const handleExportPDF = () => {
    if (!profile) {
      toast({
        title: "No Profile Data",
        description: "Please fill out your profile first before exporting",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: "PDF Export",
        description: "Generating PDF version of your profile...",
      });

      generateProfilePDF(profile);

      setTimeout(() => {
        toast({
          title: "PDF Generated!",
          description: "Your profile has been downloaded as PDF",
        });
      }, 1000);
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({
        title: "Export Failed",
        description: "There was an error generating your PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handlePhotoUpload = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append("photo", file);

      const response = await fetch("/api/upload/photo", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = await response.json();

      if (result.success) {
        updateProfileMutation.mutate({ photoUrl: result.fileUrl });
        toast({
          title: "Photo Uploaded",
          description: "Your profile photo has been updated!",
        });
      } else {
        throw new Error(result.message || "Upload failed");
      }
    } catch (error) {
      console.error("Photo upload error:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload photo. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCVUpload = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append("cv", file);

      const response = await fetch("/api/upload/cv", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = await response.json();

      if (result.success) {
        updateProfileMutation.mutate({ cvUrl: result.fileUrl });
        toast({
          title: "CV Uploaded",
          description: "Your CV has been uploaded successfully!",
        });
      } else {
        throw new Error(result.message || "Upload failed");
      }
    } catch (error) {
      console.error("CV upload error:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload CV. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Professional Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.location.href = '/'}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Canar</h1>
              </div>

              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <Button
                  variant={!isPreviewMode ? "default" : "ghost"}
                  onClick={() => setIsPreviewMode(false)}
                  size="sm"
                  className="rounded-md text-sm"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant={isPreviewMode ? "default" : "ghost"}
                  onClick={() => setIsPreviewMode(true)}
                  size="sm"
                  className="rounded-md text-sm"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Preview
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <CreditCounter
                credits={credits?.creditsRemaining || 0}
              />
              <Button
                onClick={() => setShowCreditModal(true)}
                size="sm"
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
              >
                <Award className="h-4 w-4" />
                Buy Credits
              </Button>
              <Button
                variant="outline"
                onClick={handleExportPDF}
                size="sm"
                className="flex items-center gap-2 hover:bg-gray-50"
              >
                <FileText className="h-4 w-4" />
                Export PDF
              </Button>
              <Button
                onClick={() => setShowShareModal(true)}
                size="sm"
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
              >
                <Share className="h-4 w-4" />
                Share
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Credit Warning Banner */}
        {!canEdit && credits && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <Award className="h-5 w-5 text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">
                  Insufficient Credits
                </h3>
                <p className="text-sm text-red-700 mt-1">
                  You need at least 5 credits to edit your profile. You currently have {credits.creditsRemaining} credits remaining.
                </p>
              </div>
              <Button
                onClick={() => setShowCreditModal(true)}
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Buy Credits
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Sections (Left Column) */}
          <div className="lg:col-span-2 space-y-8">
            {/* Personal Information Section */}
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      placeholder="Your full name"
                      defaultValue={profile?.name || ""}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      disabled={isPreviewMode || !canEdit}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      defaultValue={profile?.email || ""}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      disabled={isPreviewMode || !canEdit}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="bio">Professional Bio</Label>
                  <Textarea
                    id="bio"
                    placeholder="Tell us about yourself..."
                    rows={4}
                    defaultValue={profile?.bio || ""}
                    onChange={(e) => handleInputChange("bio", e.target.value)}
                    disabled={isPreviewMode || !canEdit}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>Profile Photo</Label>
                    <div className="mt-2">
                      <PhotoUpload
                        onUpload={handlePhotoUpload}
                        currentPhoto={profile?.photoUrl}
                        disabled={isPreviewMode || !canEdit}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Resume/CV</Label>
                    <div className="mt-2">
                      {!isPreviewMode ? (
                        <CVUpload onUpload={handleCVUpload} disabled={isPreviewMode || !canEdit} />
                      ) : (
                        <div className="border-2 border-gray-200 rounded-md p-6 text-center">
                          <FileText className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                          <p className="text-sm text-gray-600">
                            {profile?.cvUrl ? "CV uploaded" : "No CV uploaded"}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Education Section */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
                <CardTitle>Education</CardTitle>
                {!isPreviewMode && (
                  <Button
                    onClick={() => addEducationMutation.mutate({
                      degree: "New Degree",
                      university: "University Name",
                      duration: "Year - Year"
                    })}
                    size="sm"
                    className="flex items-center gap-2"
                    disabled={!canEdit}
                  >
                    <Plus className="h-4 w-4" />
                    Add Education
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {profile?.education && profile.education.length > 0 ? (
                  <div className="space-y-6">
                    {profile.education.map((edu, index) => (
                      <div key={edu.id || index} className="border-b border-gray-200 pb-6 last:border-b-0 last:pb-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Degree</Label>
                            <Input
                              defaultValue={edu.degree}
                              onChange={(e) => {
                                if (edu.id) {
                                  updateEducationMutation.mutate({
                                    id: edu.id,
                                    data: { degree: e.target.value }
                                  });
                                }
                              }}
                              disabled={isPreviewMode || !canEdit}
                            />
                          </div>
                          <div>
                            <Label>University</Label>
                            <Input
                              defaultValue={edu.university}
                              onChange={(e) => {
                                if (edu.id) {
                                  updateEducationMutation.mutate({
                                    id: edu.id,
                                    data: { university: e.target.value }
                                  });
                                }
                              }}
                              disabled={isPreviewMode || !canEdit}
                            />
                          </div>
                          <div>
                            <Label>Duration</Label>
                            <Input
                              defaultValue={edu.duration}
                              onChange={(e) => {
                                if (edu.id) {
                                  updateEducationMutation.mutate({
                                    id: edu.id,
                                    data: { duration: e.target.value }
                                  });
                                }
                              }}
                              disabled={isPreviewMode || !canEdit}
                            />
                          </div>
                          {!isPreviewMode && (
                            <div className="flex items-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => edu.id && deleteEducationMutation.mutate(edu.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Remove
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <GraduationCap className="mx-auto h-12 w-12 text-gray-300" />
                    <p className="text-gray-500 mt-4">No education added yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Projects Section */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  Projects
                </CardTitle>
                {!isPreviewMode && (
                  <Button
                    onClick={() => addProjectMutation.mutate({
                      name: "New Project",
                      description: "Project description",
                      link: "",
                      duration: "Month Year - Month Year"
                    })}
                    size="sm"
                    className="flex items-center gap-2"
                    disabled={!canEdit}
                  >
                    <Plus className="h-4 w-4" />
                    Add Project
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {profile?.projects && profile.projects.length > 0 ? (
                  <div className="space-y-6">
                    {profile.projects.map((project, index) => (
                      <div key={project.id || index} className="border border-gray-200 rounded-lg p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Project Name</Label>
                            <Input
                              defaultValue={project.name}
                              onChange={(e) => {
                                if (project.id) {
                                  updateProjectMutation.mutate({
                                    id: project.id,
                                    data: { name: e.target.value }
                                  });
                                }
                              }}
                              disabled={isPreviewMode || !canEdit}
                            />
                          </div>
                          <div>
                            <Label>Duration</Label>
                            <Input
                              defaultValue={project.duration}
                              onChange={(e) => {
                                if (project.id) {
                                  updateProjectMutation.mutate({
                                    id: project.id,
                                    data: { duration: e.target.value }
                                  });
                                }
                              }}
                              disabled={isPreviewMode || !canEdit}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <Label>Description</Label>
                            <Textarea
                              defaultValue={project.description}
                              rows={3}
                              onChange={(e) => {
                                if (project.id) {
                                  updateProjectMutation.mutate({
                                    id: project.id,
                                    data: { description: e.target.value }
                                  });
                                }
                              }}
                              disabled={isPreviewMode || !canEdit}
                            />
                          </div>
                          <div>
                            <Label>Project Link</Label>
                            <Input
                              defaultValue={project.link}
                              placeholder="https://github.com/..."
                              onChange={(e) => {
                                if (project.id) {
                                  updateProjectMutation.mutate({
                                    id: project.id,
                                    data: { link: e.target.value }
                                  });
                                }
                              }}
                              disabled={isPreviewMode || !canEdit}
                            />
                          </div>
                          {!isPreviewMode && (
                            <div className="flex justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => project.id && deleteProjectMutation.mutate(project.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Remove
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Code className="mx-auto h-12 w-12 text-gray-300" />
                    <p className="text-gray-500 mt-4">No projects added yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Skills Section */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Skills
                </CardTitle>
                {!isPreviewMode && (
                  <Button
                    onClick={() => addSkillMutation.mutate({
                      name: "New Skill",
                      proficiency: "Intermediate"
                    })}
                    size="sm"
                    className="flex items-center gap-2"
                    disabled={!canEdit}
                  >
                    <Plus className="h-4 w-4" />
                    Add Skill
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {profile?.skills && profile.skills.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {profile.skills.map((skill, index) => (
                      <div key={skill.id || index} className="border border-gray-200 rounded-lg p-4">
                        <div className="space-y-3">
                          <div>
                            <Label>Skill Name</Label>
                            <Input
                              defaultValue={skill.name}
                              onChange={(e) => {
                                if (skill.id) {
                                  updateSkillMutation.mutate({
                                    id: skill.id,
                                    data: { name: e.target.value }
                                  });
                                }
                              }}
                              disabled={isPreviewMode || !canEdit}
                            />
                          </div>
                          <div>
                            <Label>Proficiency</Label>
                            <Select
                              defaultValue={skill.proficiency}
                              disabled={isPreviewMode || !canEdit}
                              onValueChange={(value) => {
                                if (skill.id) {
                                  updateSkillMutation.mutate({
                                    id: skill.id,
                                    data: { proficiency: value }
                                  });
                                }
                              }}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Beginner">Beginner</SelectItem>
                                <SelectItem value="Intermediate">Intermediate</SelectItem>
                                <SelectItem value="Advanced">Advanced</SelectItem>
                                <SelectItem value="Expert">Expert</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {!isPreviewMode && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => skill.id && deleteSkillMutation.mutate(skill.id)}
                              className="text-destructive hover:text-destructive w-full"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Award className="mx-auto h-12 w-12 text-gray-300" />
                    <p className="text-gray-500 mt-4">No skills added yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Work Experience Section */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Work Experience
                </CardTitle>
                {!isPreviewMode && (
                  <Button
                    onClick={() => addExperienceMutation.mutate({
                      company: "Company Name",
                      role: "Job Title",
                      duration: "Month Year - Present",
                      responsibilities: "Key responsibilities and achievements..."
                    })}
                    size="sm"
                    className="flex items-center gap-2"
                    disabled={!canEdit}
                  >
                    <Plus className="h-4 w-4" />
                    Add Experience
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {profile?.experiences && profile.experiences.length > 0 ? (
                  <div className="space-y-6">
                    {profile.experiences.map((exp, index) => (
                      <div key={exp.id || index} className="border border-gray-200 rounded-lg p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Company</Label>
                            <Input
                              defaultValue={exp.company}
                              onChange={(e) => {
                                if (exp.id) {
                                  updateExperienceMutation.mutate({
                                    id: exp.id,
                                    data: { company: e.target.value }
                                  });
                                }
                              }}
                              disabled={isPreviewMode || !canEdit}
                            />
                          </div>
                          <div>
                            <Label>Role</Label>
                            <Input
                              defaultValue={exp.role}
                              onChange={(e) => {
                                if (exp.id) {
                                  updateExperienceMutation.mutate({
                                    id: exp.id,
                                    data: { role: e.target.value }
                                  });
                                }
                              }}
                              disabled={isPreviewMode || !canEdit}
                            />
                          </div>
                          <div>
                            <Label>Duration</Label>
                            <Input
                              defaultValue={exp.duration}
                              onChange={(e) => {
                                if (exp.id) {
                                  updateExperienceMutation.mutate({
                                    id: exp.id,
                                    data: { duration: e.target.value }
                                  });
                                }
                              }}
                              disabled={isPreviewMode || !canEdit}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <Label>Key Responsibilities</Label>
                            <Textarea
                              defaultValue={exp.description}
                              rows={4}
                              onChange={(e) => {
                                if (exp.id) {
                                  updateExperienceMutation.mutate({
                                    id: exp.id,
                                    data: { description: e.target.value }
                                  });
                                }
                              }}
                              disabled={isPreviewMode || !canEdit}
                            />
                          </div>
                          {!isPreviewMode && (
                            <div className="flex justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => exp.id && deleteExperienceMutation.mutate(exp.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Remove
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Briefcase className="mx-auto h-12 w-12 text-gray-300" />
                    <p className="text-gray-500 mt-4">No work experience added yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar - Profile Summary */}
          <div className="space-y-6">
            {/* Profile Summary Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Profile Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    {profile?.photoUrl ? (
                      <img
                        src={profile.photoUrl}
                        alt="Profile"
                        className="w-20 h-20 rounded-full object-cover"
                      />
                    ) : (
                      <Briefcase className="w-10 h-10 text-white" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{profile?.name || "Your Name"}</h3>
                    <p className="text-gray-600 text-sm">{profile?.email || "your@email.com"}</p>
                  </div>
                  <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                    <p className="font-medium">Profile Completion</p>
                    <div className="mt-2 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (
                            (profile?.name ? 20 : 0) +
                            (profile?.email ? 20 : 0) +
                            (profile?.bio ? 20 : 0) +
                            ((profile?.education?.length || 0) > 0 ? 20 : 0) +
                            ((profile?.projects?.length || 0) > 0 ? 20 : 0)
                          ))}%`
                        }}
                      />
                    </div>
                    <p className="text-xs mt-1">
                      {Math.min(100, (
                        (profile?.name ? 20 : 0) +
                        (profile?.email ? 20 : 0) +
                        (profile?.bio ? 20 : 0) +
                        ((profile?.education?.length || 0) > 0 ? 20 : 0) +
                        ((profile?.projects?.length || 0) > 0 ? 20 : 0)
                      ))}% complete
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4" />
                    Education
                  </span>
                  <span className="font-medium">{profile?.education?.length || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    Projects
                  </span>
                  <span className="font-medium">{profile?.projects?.length || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 flex items-center gap-2">
                    <Award className="w-4 h-4" />
                    Skills
                  </span>
                  <span className="font-medium">{profile?.skills?.length || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    Experience
                  </span>
                  <span className="font-medium">{profile?.experiences?.length || 0}</span>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={() => setShowShareModal(true)}
                  className="w-full flex items-center gap-2 bg-green-600 hover:bg-green-700"
                >
                  <Share className="w-4 h-4" />
                  Share Profile
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExportPDF}
                  className="w-full flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Export as PDF
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCreditModal(true)}
                  className="w-full flex items-center gap-2"
                >
                  <Award className="w-4 h-4" />
                  Buy More Credits
                </Button>
              </CardContent>
            </Card>

            {/* Tips Card */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg text-blue-800">💡 Pro Tips</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-700 space-y-2">
                <p>• Fill out all sections for a complete profile</p>
                <p>• Use action-oriented language in descriptions</p>
                <p>• Add links to your projects and portfolio</p>
                <p>• Keep your skills updated regularly</p>
                <p>• Each edit costs 5 credits - make them count!</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreditTopupModal
        open={showCreditModal}
        onClose={() => setShowCreditModal(false)}
        currentCredits={credits?.creditsRemaining || 0}
        onCreditPurchase={(credits: number, amount: number) => addCreditMutation.mutate({
          credits,
          amount
        })}
      />

      <ShareProfileModal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        shareUrl={profile?.shareSlug ? `${window.location.origin}/profile/share/${profile.shareSlug}` : ""}
      />

      {/* Autosave Toast */}
      <AutosaveToast
        show={showAutosaveToast}
        onClose={() => setShowAutosaveToast(false)}
        creditsRemaining={credits?.creditsRemaining || 0}
      />
    </div>
  );
}
