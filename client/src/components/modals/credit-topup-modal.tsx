import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, CreditCard, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CreditTopupModalProps {
  open: boolean;
  onClose: () => void;
  currentCredits: number;
  onCreditPurchase: (credits: number, amount: number) => void;
}

const topupOptions = [
  {
    id: "small",
    credits: 100,
    price: 500, // ₹5.00
    popular: false,
    description: "Perfect for occasional edits"
  },
  {
    id: "medium",
    credits: 250,
    price: 1000, // ₹10.00
    popular: true,
    description: "Great value for regular updates"
  },
  {
    id: "large",
    credits: 500,
    price: 1800, // ₹18.00
    popular: false,
    description: "Best for extensive profile work"
  }
];

export function CreditTopupModal({ open, onClose, currentCredits, onCreditPurchase }: CreditTopupModalProps) {
  const { toast } = useToast();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleTopup = async (option: typeof topupOptions[0]) => {
    setIsProcessing(true);
    setSelectedOption(option.id);

    try {
      // Simulate payment processing
      // await new Promise(resolve => setTimeout(resolve, 2000));
      onCreditPurchase(option.credits, option.price);

      toast({
        title: "Credits Added Successfully!",
        description: `${option.credits} credits have been added to your account`,
      });

      // In a real implementation, this would trigger a payment flow
      // and then call an API to add credits

      onClose();
    } catch (error) {
      toast({
        title: "Payment Failed",
        description: "There was an issue processing your payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setSelectedOption(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Buy More Credits
          </DialogTitle>
          <DialogDescription>
            You currently have {currentCredits} credits remaining. Each profile edit costs 5 credits.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3">
            {topupOptions.map((option) => (
              <Card
                key={option.id}
                className={`cursor-pointer transition-all hover:shadow-md ${option.popular ? 'border-blue-500 shadow-sm' : ''
                  }`}
                onClick={() => !isProcessing && handleTopup(option)}
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Zap className="h-5 w-5 text-yellow-500" />
                        {option.credits} Credits
                      </CardTitle>
                      <p className="text-sm text-gray-600 mt-1">{option.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">₹{(option.price / 100).toFixed(0)}</div>
                      {option.popular && <Badge variant="secondary">Popular</Badge>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">
                      ≈ {Math.floor(option.credits / 5)} profile edits
                    </span>
                    <Button
                      size="sm"
                      disabled={isProcessing}
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      {isProcessing && selectedOption === option.id ? 'Processing...' : 'Buy Now'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-xs text-gray-500 text-center pt-2">
            Credits never expire and can be used for any profile edits
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}