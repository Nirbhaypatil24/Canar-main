
import { useQuery } from "@tanstack/react-query"
import { useRoute } from "wouter"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    ArrowLeft,
    Mail,
    Calendar,
    ExternalLink,
    GraduationCap,
    Code,
    Briefcase,
    Award,
    FileText,
    Globe,
} from "lucide-react"
import { apiRequest } from "@/lib/queryClient"

interface PublicProfileData {
    profile: {
        id: string
        name: string
        email: string
        bio: string
        photoUrl?: string
        cvUrl?: string
        shareSlug: string
    }
    education: Array<{
        id: string
        degree: string
        university: string
        duration: string
    }>
    projects: Array<{
        id: string
        name: string
        description: string
        link: string
        duration: string
    }>
    skills: Array<{
        id: string
        name: string
        proficiency: string
    }>
    experiences: Array<{
        id: string
        role: string
        company: string
        duration: string
        description: string
    }>
}

export default function PublicProfilePage() {
    const [match, params] = useRoute("/profile/share/:shareSlug")
    const shareSlug = params?.shareSlug

    const {
        data: profileData,
        isLoading,
        error,
    } = useQuery<PublicProfileData>({
        queryKey: ["/api/profile/share", shareSlug],
        queryFn: async () => {
            if (!shareSlug) throw new Error("No share slug provided")
            const res = await apiRequest("GET", `/api/profile/share/${shareSlug}`)
            if (!res.ok) {
                throw new Error("Profile not found")
            }
            return res.json()
        },
        enabled: !!shareSlug,
    })

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        )
    }

    if (error || !profileData) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Card className="w-full max-w-md mx-4">
                    <CardContent className="pt-6 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                            <FileText className="w-8 h-8 text-red-600" />
                        </div>
                        <h1 className="text-xl font-semibold text-gray-900 mb-2">Profile Not Found</h1>
                        <p className="text-gray-600 mb-4">The profile you're looking for doesn't exist or has been removed.</p>
                        <Button onClick={() => (window.location.href = "/")} className="w-full">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Go to Homepage
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const { profile, education, projects, skills, experiences } = profileData

    const getProficiencyColor = (proficiency: string) => {
        switch (proficiency.toLowerCase()) {
            case "expert":
                return "bg-green-100 text-green-800 border-green-200"
            case "advanced":
                return "bg-blue-100 text-blue-800 border-blue-200"
            case "intermediate":
                return "bg-yellow-100 text-yellow-800 border-yellow-200"
            case "beginner":
                return "bg-gray-100 text-gray-800 border-gray-200"
            default:
                return "bg-gray-100 text-gray-800 border-gray-200"
        }
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-3">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => (window.location.href = "/")}
                                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back to Canar
                            </Button>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Globe className="w-4 h-4" />
                            Public Profile
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Profile Header */}
                <Card className="mb-8">
                    <CardContent className="pt-6">
                        <div className="flex flex-col md:flex-row gap-6">
                            <div className="flex-shrink-0">
                                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                    {profile.photoUrl ? (
                                        <img
                                            src={profile.photoUrl || "/placeholder.svg"}
                                            alt={profile.name}
                                            className="w-32 h-32 rounded-full object-cover"
                                        />
                                    ) : (
                                        <Briefcase className="w-16 h-16 text-white" />
                                    )}
                                </div>
                            </div>
                            <div className="flex-1">
                                <h1 className="text-3xl font-bold text-gray-900 mb-2">{profile.name || "Professional Profile"}</h1>
                                {profile.email && (
                                    <div className="flex items-center gap-2 text-gray-600 mb-4">
                                        <Mail className="w-4 h-4" />
                                        <span>{profile.email}</span>
                                    </div>
                                )}
                                {profile.bio && <p className="text-gray-700 leading-relaxed">{profile.bio}</p>}
                                {profile.cvUrl && (
                                    <div className="mt-4">
                                        <Button onClick={() => window.open(profile.cvUrl, "_blank")} className="flex items-center gap-2">
                                            <FileText className="w-4 h-4" />
                                            Download CV
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Work Experience */}
                        {experiences && experiences.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Briefcase className="h-5 w-5" />
                                        Work Experience
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-6">
                                        {experiences.map((exp, index) => (
                                            <div
                                                key={exp.id}
                                                className={`${index !== experiences.length - 1 ? "border-b border-gray-200 pb-6" : ""}`}
                                            >
                                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2">
                                                    <div>
                                                        <h3 className="font-semibold text-lg text-gray-900">{exp.role}</h3>
                                                        <p className="text-blue-600 font-medium">{exp.company}</p>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-sm text-gray-500 mt-1 sm:mt-0">
                                                        <Calendar className="w-4 h-4" />
                                                        <span>{exp.duration}</span>
                                                    </div>
                                                </div>
                                                {exp.description && <p className="text-gray-700 leading-relaxed">{exp.description}</p>}
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Projects */}
                        {projects && projects.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Code className="h-5 w-5" />
                                        Projects
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-6">
                                        {projects.map((project, index) => (
                                            <div
                                                key={project.id}
                                                className={`${index !== projects.length - 1 ? "border-b border-gray-200 pb-6" : ""}`}
                                            >
                                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h3 className="font-semibold text-lg text-gray-900">{project.name}</h3>
                                                            {project.link && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => window.open(project.link, "_blank")}
                                                                    className="p-1 h-auto"
                                                                >
                                                                    <ExternalLink className="w-4 h-4" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                        {project.description && (
                                                            <p className="text-gray-700 leading-relaxed">{project.description}</p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1 text-sm text-gray-500 mt-2 sm:mt-0 sm:ml-4">
                                                        <Calendar className="w-4 h-4" />
                                                        <span>{project.duration}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Education */}
                        {education && education.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <GraduationCap className="h-5 w-5" />
                                        Education
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {education.map((edu, index) => (
                                            <div
                                                key={edu.id}
                                                className={`${index !== education.length - 1 ? "border-b border-gray-200 pb-4" : ""}`}
                                            >
                                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
                                                    <div>
                                                        <h3 className="font-semibold text-gray-900">{edu.degree}</h3>
                                                        <p className="text-blue-600">{edu.university}</p>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-sm text-gray-500 mt-1 sm:mt-0">
                                                        <Calendar className="w-4 h-4" />
                                                        <span>{edu.duration}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Skills */}
                        {skills && skills.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Award className="h-5 w-5" />
                                        Skills
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {skills.map((skill) => (
                                            <div key={skill.id} className="flex justify-between items-center">
                                                <span className="font-medium text-gray-900">{skill.name}</span>
                                                <Badge variant="outline" className={getProficiencyColor(skill.proficiency)}>
                                                    {skill.proficiency}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Profile Stats */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Profile Overview</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600 flex items-center gap-2">
                                        <Briefcase className="w-4 h-4" />
                                        Experience
                                    </span>
                                    <span className="font-medium">{experiences?.length || 0}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600 flex items-center gap-2">
                                        <Code className="w-4 h-4" />
                                        Projects
                                    </span>
                                    <span className="font-medium">{projects?.length || 0}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600 flex items-center gap-2">
                                        <GraduationCap className="w-4 h-4" />
                                        Education
                                    </span>
                                    <span className="font-medium">{education?.length || 0}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600 flex items-center gap-2">
                                        <Award className="w-4 h-4" />
                                        Skills
                                    </span>
                                    <span className="font-medium">{skills?.length || 0}</span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Call to Action */}
                        <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
                            <CardContent className="pt-6 text-center">
                                <div className="w-12 h-12 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                                    <Briefcase className="w-6 h-6 text-white" />
                                </div>
                                <h3 className="font-semibold text-gray-900 mb-2">Create Your Profile</h3>
                                <p className="text-sm text-gray-600 mb-4">
                                    Build your own professional profile like this one with Canar
                                </p>
                                <Button
                                    onClick={() => (window.location.href = "/")}
                                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                                >
                                    Get Started
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="bg-white border-t mt-16">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center">
                                <Briefcase className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-semibold text-gray-900">Canar</span>
                        </div>
                        <p className="text-sm text-gray-600">Professional profile builder with subscription-based credits</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
