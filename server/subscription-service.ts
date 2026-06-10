import { storage } from "./storage";
import { Subscription, InsertSubscription } from "@shared/schema";

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number; // in paise
  credits: number;
  features: string[];
  duration: number; // in days
}

export interface SubscriptionStatus {
  hasActiveSubscription: boolean;
  planType: string | null;
  creditsRemaining: number;
  creditsAllocated: number;
  isExpired: boolean;
  daysUntilExpiry: number | null;
  canEdit: boolean;
}

export class SubscriptionService {
  private static readonly PLANS: Record<string, SubscriptionPlan> = {
    basic: {
      id: "basic",
      name: "Basic",
      price: 199900, // ₹1,999
      credits: 500,
      features: [
        "500 editing credits",
        "PDF export unlimited",
        "Public profile sharing",
        "Photo & CV upload",
      ],
      duration: 30, // 30 days
    },
    premium: {
      id: "premium",
      name: "Premium",
      price: 299900, // ₹2,999
      credits: 1000,
      features: [
        "1,000 editing credits",
        "PDF export unlimited",
        "Public profile sharing",
        "Photo & CV upload",
        "Priority support",
      ],
      duration: 30, // 30 days
    },
  };

  /**
   * Get available subscription plans
   */
  static getPlans(): SubscriptionPlan[] {
    return Object.values(this.PLANS);
  }

  /**
   * Get a specific plan by ID
   */
  static getPlan(planId: string): SubscriptionPlan | null {
    return this.PLANS[planId] || null;
  }

  /**
   * Create a new subscription for a user
   */
  static async createSubscription(
    userId: string,
    planType: string
  ): Promise<Subscription> {
    const plan = this.getPlan(planType.toLowerCase());
    if (!plan) {
      throw new Error(`Invalid plan type: ${planType}`);
    }

    // Check if user already has an active subscription
    const existingSubscription = await storage.getUserSubscription(userId);
    if (existingSubscription && existingSubscription.active) {
      throw new Error("User already has an active subscription");
    }

    // Calculate end date
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.duration);

    const subscriptionData: InsertSubscription = {
      userId,
      planType: plan.name,
      creditsAllocated: plan.credits,
      creditsRemaining: plan.credits,
      active: true,
      endDate,
    };

    return await storage.createSubscription(subscriptionData);
  }

  /**
   * Get subscription status for a user
   */
  static async getSubscriptionStatus(
    userId: string
  ): Promise<SubscriptionStatus> {
    const subscription = await storage.getUserSubscription(userId);

    if (!subscription) {
      return {
        hasActiveSubscription: false,
        planType: null,
        creditsRemaining: 0,
        creditsAllocated: 0,
        isExpired: false,
        daysUntilExpiry: null,
        canEdit: false,
      };
    }

    const now = new Date();
    const endDate = subscription.endDate
      ? new Date(subscription.endDate)
      : null;
    const isExpired = endDate ? now > endDate : false;
    const daysUntilExpiry = endDate
      ? Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Check if subscription is actually active
    const hasActiveSubscription = Boolean(subscription.active) && !isExpired;
    const canEdit =
      hasActiveSubscription && (subscription.creditsRemaining ?? 0) >= 5;

    return {
      hasActiveSubscription,
      planType: subscription.planType,
      creditsRemaining: subscription.creditsRemaining ?? 0,
      creditsAllocated: subscription.creditsAllocated ?? 0,
      isExpired,
      daysUntilExpiry,
      canEdit,
    };
  }

  /**
   * Check if user can perform an action that requires credits
   */
  static async canPerformAction(
    userId: string,
    creditsRequired: number = 5
  ): Promise<boolean> {
    const status = await this.getSubscriptionStatus(userId);
    return status.canEdit && status.creditsRemaining >= creditsRequired;
  }

  /**
   * Deduct credits from user's subscription
   */
  static async deductCredits(
    userId: string,
    creditsToDeduct: number = 5
  ): Promise<boolean> {
    const subscription = await storage.getUserSubscription(userId);

    if (!subscription || !subscription.active) {
      throw new Error("No active subscription found");
    }

    if (subscription.creditsRemaining < creditsToDeduct) {
      throw new Error("Insufficient credits");
    }

    const updatedSubscription = await storage.updateSubscriptionCredits(
      userId,
      creditsToDeduct
    );
    return !!updatedSubscription;
  }

  /**
   * Add credits to user's subscription (for top-ups)
   */
  static async addCredits(userId: string, creditsToAdd: number): Promise<void> {
    const subscription = await storage.getUserSubscription(userId);

    if (!subscription || !subscription.active) {
      throw new Error("No active subscription found");
    }

    await storage.addCreditsToSubscription(userId, creditsToAdd);
  }

  /**
   * Renew subscription
   */
  static async renewSubscription(
    userId: string,
    planType: string
  ): Promise<Subscription> {
    const plan = this.getPlan(planType.toLowerCase());
    if (!plan) {
      throw new Error(`Invalid plan type: ${planType}`);
    }

    // Deactivate current subscription
    const currentSubscription = await storage.getUserSubscription(userId);
    if (currentSubscription) {
      // In a real implementation, you'd update the existing subscription
      // For now, we'll create a new one
    }

    return await this.createSubscription(userId, planType);
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(userId: string): Promise<void> {
    const subscription = await storage.getUserSubscription(userId);

    if (!subscription) {
      throw new Error("No subscription found");
    }

    // In a real implementation, you'd update the subscription to inactive
    // For now, we'll just return success
    console.log(`Subscription cancelled for user: ${userId}`);
  }

  /**
   * Get subscription analytics for admin purposes
   */
  static async getSubscriptionAnalytics(): Promise<{
    totalSubscriptions: number;
    activeSubscriptions: number;
    expiredSubscriptions: number;
    totalCreditsAllocated: number;
    totalCreditsRemaining: number;
  }> {
    // This would require additional database queries
    // For now, return mock data
    return {
      totalSubscriptions: 0,
      activeSubscriptions: 0,
      expiredSubscriptions: 0,
      totalCreditsAllocated: 0,
      totalCreditsRemaining: 0,
    };
  }

  /**
   * Validate subscription before allowing access to protected features
   */
  static async validateAccess(
    userId: string,
    feature: string
  ): Promise<{
    allowed: boolean;
    reason?: string;
    creditsRemaining?: number;
  }> {
    const status = await this.getSubscriptionStatus(userId);

    if (!status.hasActiveSubscription) {
      return {
        allowed: false,
        reason: "No active subscription",
      };
    }

    if (status.isExpired) {
      return {
        allowed: false,
        reason: "Subscription expired",
      };
    }

    if (status.creditsRemaining < 5) {
      return {
        allowed: false,
        reason: "Insufficient credits",
        creditsRemaining: status.creditsRemaining,
      };
    }

    return {
      allowed: true,
      creditsRemaining: status.creditsRemaining,
    };
  }
}
