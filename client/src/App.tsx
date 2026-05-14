import { Switch, Route } from "wouter"
import { queryClient } from "./lib/queryClient"
import { QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "@/components/ui/toaster"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AuthProvider } from "@/hooks/use-auth"
import { ProtectedRoute } from "@/lib/protected-route"
import NotFound from "@/pages/not-found"
import LandingPage from "@/pages/landing-page"
import AuthPage from "@/pages/auth-minimal"
import DebugAuthPage from "@/pages/debug-auth"
import SubscriptionPage from "@/pages/subscription-page"
import ProfileBuilderPage from "@/pages/profile-builder-page"
import SimpleFormTest from "@/pages/simple-form-test"
import PublicProfilePage from "@/pages/public-profile-page"

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/debug-auth" component={DebugAuthPage} />
      <Route path="/simple-test" component={SimpleFormTest} />
      <Route path="/profile/share/:shareSlug" component={PublicProfilePage} />
      <ProtectedRoute path="/subscription" component={SubscriptionPage} />
      <ProtectedRoute path="/profile" component={ProfileBuilderPage} requireSubscription={true} />
      <Route component={NotFound} />
    </Switch>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
