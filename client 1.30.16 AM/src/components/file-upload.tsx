import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FileUploadProps {
  accept: string;
  onUpload: (file: File) => void;
  children: React.ReactNode;
  disabled?: boolean;
  maxSize?: number; // in bytes
}

export function FileUpload({ accept, onUpload, children, disabled, maxSize = 5 * 1024 * 1024 }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > maxSize) {
        toast({
          title: "File too large",
          description: `Please select a file smaller than ${Math.round(maxSize / 1024 / 1024)}MB`,
          variant: "destructive"
        });
        return;
      }
      onUpload(file);
    }
    // Reset the input value to allow selecting the same file again
    event.target.value = "";
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
      <div onClick={handleClick} style={{ cursor: disabled ? "not-allowed" : "pointer" }}>
        {children}
      </div>
    </>
  );
}

export function PhotoUpload({ onUpload, currentPhoto, disabled }: {
  onUpload: (file: File) => void;
  currentPhoto?: string;
  disabled?: boolean;
}) {
  return (
    <FileUpload
      accept="image/*"
      onUpload={onUpload}
      disabled={disabled}
      maxSize={5 * 1024 * 1024} // 5MB
    >
      <div className="flex items-center space-x-4">
        <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
          {currentPhoto ? (
            <img 
              src={currentPhoto} 
              alt="Profile" 
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <Upload className="h-6 w-6 text-gray-400" />
          )}
        </div>
        {!disabled && (
          <Button variant="outline" size="sm" type="button">
            <Upload className="h-4 w-4 mr-2" />
            Change Photo
          </Button>
        )}
      </div>
    </FileUpload>
  );
}

export function CVUpload({ onUpload, disabled }: {
  onUpload: (file: File) => void;
  disabled?: boolean;
}) {
  return (
    <FileUpload
      accept=".pdf,.doc,.docx"
      onUpload={onUpload}
      disabled={disabled}
      maxSize={10 * 1024 * 1024} // 10MB
    >
      <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center hover:border-gray-400 transition-colors">
        <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
        <p className="text-sm text-gray-600">
          {disabled ? "CV upload disabled in preview mode" : "Click to upload your CV (PDF, DOC)"}
        </p>
      </div>
    </FileUpload>
  );
}