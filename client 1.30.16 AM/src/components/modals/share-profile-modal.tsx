import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Share2, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ShareProfileModalProps {
  open: boolean;
  onClose: () => void;
  shareUrl: string;
}

export function ShareProfileModal({ open, onClose, shareUrl }: ShareProfileModalProps) {
  const { toast } = useToast();
  const [isCopying, setIsCopying] = useState(false);

  const handleCopyUrl = async () => {
    try {
      setIsCopying(true);
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Link Copied!",
        description: "Profile link has been copied to your clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Could not copy link to clipboard",
        variant: "destructive",
      });
    } finally {
      setIsCopying(false);
    }
  };

  const handleOpenProfile = () => {
    if (shareUrl) {
      window.open(shareUrl, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Your Profile
          </DialogTitle>
          <DialogDescription>
            Share your professional profile with others using this public link.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="share-url">Public Profile URL</Label>
            <div className="flex gap-2">
              <Input
                id="share-url"
                value={shareUrl || "Generate your profile to get a shareable link"}
                readOnly
                className="flex-1"
              />
              <Button
                onClick={handleCopyUrl}
                disabled={!shareUrl || isCopying}
                size="sm"
                variant="outline"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleOpenProfile}
              disabled={!shareUrl}
              className="flex-1"
              variant="outline"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Preview Profile
            </Button>
            <Button onClick={onClose} className="flex-1">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}