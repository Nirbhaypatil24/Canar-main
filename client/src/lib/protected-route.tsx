import { useAuth, useSubscription } from "@/hooks/use-auth";
import { Loader2, Lock } from "lucide-react";
import { Route, Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";

interface ProtectedRouteProps {
  path: string;
  component: () => React.JSX.Element | null;
  requireSubscription?: boolean;
  requireCredits?: number;
}

export function ProtectedRoute({
  path,
  component: Component,
  requireSubscription = false,
  requireCredits = 0,
}: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { hasActiveSubscription, creditsRemaining, canEdit } = useSubscription();
  const [location, setLocation] = useLocation();

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Check authentication
  if (!isAuthenticated) {
    return (
      <Route path={path}>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <CardTitle>Authentication Required</CardTitle>
              <CardDescription>
                Please log in to access this page
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={() => setLocation("/auth")}
                className="w-full"
              >
                Go to Login
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation("/")}
                className="w-full"
              >
                Back to Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </Route>
    );
  }

  // Check subscription if required
  if (requireSubscription && !hasActiveSubscription) {
    return (
      <Route path={path}>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <CardTitle>Subscription Required</CardTitle>
              <CardDescription>
                You need an active subscription to access this feature
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={() => setLocation("/subscription")}
                className="w-full"
              >
                View Plans
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation("/")}
                className="w-full"
              >
                Back to Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </Route>
    );
  }

  // Check credits if required
  if (requireCredits > 0 && creditsRemaining < requireCredits) {
    return (
      <Route path={path}>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <CardTitle>Insufficient Credits</CardTitle>
              <CardDescription>
                You need {requireCredits} credits to perform this action.
                You have {creditsRemaining} credits remaining.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={() => setLocation("/subscription")}
                className="w-full"
              >
                Get More Credits
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation("/profile")}
                className="w-full"
              >
                Back to Profile
              </Button>
            </CardContent>
          </Card>
        </div>
      </Route>
    );
  }

  // All checks passed, render the component
  return (
    <Route path={path}>
      <Component />
    </Route>
  );
}

// Special route for subscription page that requires authentication but not subscription
export function AuthRequiredRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element | null;
}) {
  return (
    <ProtectedRoute
      path={path}
      component={Component}
      requireSubscription={false}
    />
  );
}

// Route that requires both authentication and subscription
export function SubscriptionRequiredRoute({
  path,
  component: Component,
  requireCredits = 0,
}: {
  path: string;
  component: () => React.JSX.Element | null;
  requireCredits?: number;
}) {
  return (
    <ProtectedRoute
      path={path}
      component={Component}
      requireSubscription={true}
      requireCredits={requireCredits}
    />
  );
}
