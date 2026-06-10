import jsPDF from 'jspdf';

interface ProfileData {
  name?: string;
  email?: string;
  bio?: string;
  education?: Array<{
    degree: string;
    university: string;
    duration: string;
  }>;
  projects?: Array<{
    name: string;
    description: string;
    link: string;
    duration: string;
  }>;
  skills?: Array<{
    name: string;
    proficiency: string;
  }>;
  experiences?: Array<{
    role: string;
    company: string;
    duration: string;
    description: string;
  }>;
}

export function generateProfilePDF(profile: ProfileData): void {
  const doc = new jsPDF();
  let yPosition = 20;
  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const lineHeight = 7;

  // Header
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(profile.name || 'Professional Profile', margin, yPosition);
  yPosition += 15;

  // Contact Info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  if (profile.email) {
    doc.text(`Email: ${profile.email}`, margin, yPosition);
    yPosition += lineHeight;
  }
  yPosition += 5;

  // Bio Section
  if (profile.bio) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Professional Summary', margin, yPosition);
    yPosition += 8;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const bioLines = doc.splitTextToSize(profile.bio, pageWidth - 2 * margin);
    doc.text(bioLines, margin, yPosition);
    yPosition += bioLines.length * 5 + 10;
  }

  // Education Section
  if (profile.education && profile.education.length > 0) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Education', margin, yPosition);
    yPosition += 8;

    profile.education.forEach((edu) => {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(edu.degree, margin, yPosition);
      yPosition += 5;
      
      doc.setFont('helvetica', 'normal');
      doc.text(`${edu.university} | ${edu.duration}`, margin, yPosition);
      yPosition += 8;
    });
    yPosition += 5;
  }

  // Work Experience Section
  if (profile.experiences && profile.experiences.length > 0) {
    // Check if we need a new page
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Work Experience', margin, yPosition);
    yPosition += 8;

    profile.experiences.forEach((exp) => {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(exp.role, margin, yPosition);
      yPosition += 5;
      
      doc.setFont('helvetica', 'normal');
      doc.text(`${exp.company} | ${exp.duration}`, margin, yPosition);
      yPosition += 5;
      
      if (exp.description) {
        const respLines = doc.splitTextToSize(exp.description, pageWidth - 2 * margin);
        doc.text(respLines, margin, yPosition);
        yPosition += respLines.length * 4 + 8;
      }
    });
    yPosition += 5;
  }

  // Projects Section
  if (profile.projects && profile.projects.length > 0) {
    // Check if we need a new page
    if (yPosition > 220) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Projects', margin, yPosition);
    yPosition += 8;

    profile.projects.forEach((project) => {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(project.name, margin, yPosition);
      yPosition += 5;
      
      doc.setFont('helvetica', 'normal');
      doc.text(project.duration, margin, yPosition);
      yPosition += 5;
      
      if (project.description) {
        const descLines = doc.splitTextToSize(project.description, pageWidth - 2 * margin);
        doc.text(descLines, margin, yPosition);
        yPosition += descLines.length * 4;
      }
      
      if (project.link) {
        doc.setTextColor(0, 0, 255);
        doc.text(`Link: ${project.link}`, margin, yPosition);
        doc.setTextColor(0, 0, 0);
      }
      yPosition += 8;
    });
    yPosition += 5;
  }

  // Skills Section
  if (profile.skills && profile.skills.length > 0) {
    // Check if we need a new page
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Skills', margin, yPosition);
    yPosition += 8;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    
    const skillsText = profile.skills
      .map(skill => `${skill.name} (${skill.proficiency})`)
      .join(', ');
    
    const skillsLines = doc.splitTextToSize(skillsText, pageWidth - 2 * margin);
    doc.text(skillsLines, margin, yPosition);
  }

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const filename = `${(profile.name || 'profile').replace(/\s+/g, '_')}_${timestamp}.pdf`;
  
  // Download the PDF
  doc.save(filename);
}