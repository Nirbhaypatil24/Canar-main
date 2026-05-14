import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Check, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/use-auth";

interface Plan {
  id: string;
  name: string;
  price: number;
  credits: number;
  features: string[];
}

export default function SubscriptionPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { hasActiveSubscription } = useSubscription();

  // Redirect to profile page if user already has an active subscription
  useEffect(() => {
    if (hasActiveSubscription) {
      setLocation("/profile");
    }
  }, [hasActiveSubscription, setLocation]);

  const { data: plans, isLoading } = useQuery<Plan[]>({
    queryKey: ["getPlans"],
    queryFn: async () => {
      const planResponse = await apiRequest("GET", "/api/subscription/plans");
      const planData = await planResponse.json();
      return planData.plans;
    }
  });

  const subscribeMutation = useMutation({
    mutationFn: async (planType: string) => {
      const res = await apiRequest("POST", "/api/subscription/subscribe", { planType });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      toast({
        title: "Subscription Successful!",
        description: "Your subscription has been activated. Credits have been added to your account.",
      });
      setLocation("/profile");
    },
    onError: (error: Error) => {
      toast({
        title: "Subscription Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Show loading while checking subscription status or loading plans
  if (isLoading || hasActiveSubscription === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Don't render anything if redirecting
  if (hasActiveSubscription) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Choose Your Plan</h2>
          <p className="mt-4 text-lg text-gray-600">Select a subscription to start building your professional profile</p>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-2 max-w-4xl mx-auto">
          {plans?.map((plan) => (
            <Card
              key={plan.id}
              className={`relative overflow-hidden ${plan.id === 'premium' ? 'border-2 border-primary shadow-lg' : ''}`}
            >
              {plan.id === 'premium' && (
                <div className="absolute top-0 right-0">
                  <Badge className="bg-primary text-white rounded-none rounded-bl-lg px-3 py-1">
                    POPULAR
                  </Badge>
                </div>
              )}

              <CardContent className="p-8">
                <div className="text-center">
                  <h3 className="text-2xl font-semibold text-gray-900 mb-4">{plan.name}</h3>
                  <p className="text-gray-600 mb-8">
                    {plan.id === 'basic'
                      ? 'Perfect for getting started with professional profiles'
                      : 'Best value for power users who edit frequently'
                    }
                  </p>

                  <div className="mb-8">
                    <div className="flex items-baseline justify-center">
                      <span className="text-5xl font-bold text-gray-900">
                        ₹{(plan.price / 100).toLocaleString()}
                      </span>
                      <span className="ml-1 text-xl text-gray-500">/month</span>
                    </div>
                    <p className="mt-2 text-sm text-gray-500">{plan.credits} credits included</p>
                  </div>

                  <ul className="text-left space-y-4 mb-8">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <Check className="h-5 w-5 text-accent mt-0.5 mr-3 flex-shrink-0" />
                        <span className="text-gray-600">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => subscribeMutation.mutate(plan.name)}
                    disabled={subscribeMutation.isPending}
                    className="w-full"
                    variant={plan.id === 'premium' ? 'default' : 'outline'}
                  >
                    {subscribeMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Select {plan.name}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-sm text-gray-500">
            All plans include unlimited PDF exports and profile sharing. Credits are used only for profile edits (5 credits per autosave).
          </p>
        </div>
      </div>
    </div>
  );
}
