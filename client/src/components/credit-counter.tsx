import { Button } from "@/components/ui/button";
import { Coins, Plus } from "lucide-react";

interface CreditCounterProps {
  credits: number;
}

export function CreditCounter({ credits }: CreditCounterProps) {
  const isLowCredits = credits < 10;
  const isCriticalCredits = credits < 5;

  return (
    <div className="flex items-center space-x-3">
      <div className={`flex items-center rounded-full px-4 py-2 ${isCriticalCredits
          ? 'bg-red-100 border border-red-200'
          : isLowCredits
            ? 'bg-yellow-100 border border-yellow-200'
            : 'bg-gray-100'
        }`}>
        <Coins className={`h-4 w-4 mr-2 ${isCriticalCredits
            ? 'text-red-500'
            : isLowCredits
              ? 'text-yellow-500'
              : 'text-warning'
          }`} />
        <span className={`font-medium ${isCriticalCredits
            ? 'text-red-900'
            : isLowCredits
              ? 'text-yellow-900'
              : 'text-gray-900'
          }`}>{credits}</span>
        <span className={`text-sm ml-1 ${isCriticalCredits
            ? 'text-red-700'
            : isLowCredits
              ? 'text-yellow-700'
              : 'text-gray-600'
          }`}>credits</span>
      </div>
    </div>
  );
}
