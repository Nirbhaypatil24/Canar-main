import { useEffect } from "react";
import { CheckCircle } from "lucide-react";

interface AutosaveToastProps {
  show: boolean;
  onClose: () => void;
  creditsRemaining: number;
}

export function AutosaveToast({ show, onClose, creditsRemaining }: AutosaveToastProps) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-accent text-white px-4 py-2 rounded-md shadow-lg z-50">
      <div className="flex items-center">
        <CheckCircle className="h-5 w-5 mr-2" />
        <span>Saved ✓ (Credits left: {creditsRemaining})</span>
      </div>
    </div>
  );
}
