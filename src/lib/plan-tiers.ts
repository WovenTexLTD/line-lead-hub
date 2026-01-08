// Plan tier configuration for active-line-based billing
// 
// STRIPE SETUP INSTRUCTIONS:
// You need to create these products and prices in your Stripe Dashboard (Test Mode):
// 1. Go to https://dashboard.stripe.com/test/products
// 2. Create a product for each tier with a monthly recurring price
// 3. Copy the price IDs (price_xxx) and replace the placeholders below

export type PlanTier = 'starter' | 'growth' | 'scale' | 'enterprise';
export type BillingInterval = 'month' | 'year';

export interface PlanTierConfig {
  id: PlanTier;
  name: string;
  description: string;
  priceMonthly: number; // in cents
  priceYearly: number; // in cents (15% discount applied)
  maxActiveLines: number | null; // null = unlimited
  features: string[];
  popular?: boolean;
  // Stripe IDs
  stripePriceIdMonthly: string | null;
  stripePriceIdYearly: string | null;
  stripeProductId: string | null;
}

// 15% discount for yearly billing
const YEARLY_DISCOUNT = 0.15;

export const PLAN_TIERS: Record<PlanTier, PlanTierConfig> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for small factories',
    priceMonthly: 39999, // $399.99
    priceYearly: Math.round(39999 * 12 * (1 - YEARLY_DISCOUNT)), // ~$4,079.90/yr
    maxActiveLines: 30,
    features: [
      'Up to 30 active production lines',
      'All production modules included',
      'Real-time insights & analytics',
      'Work order management',
      'Blocker tracking & alerts',
      'Unlimited users',
      'Email support',
    ],
    stripePriceIdMonthly: 'price_1SnFcPHWgEvVObNzV8DUHzpe',
    stripePriceIdYearly: 'price_1SnGNvHWgEvVObNzzSlIyDmj',
    stripeProductId: 'prod_Tkl8Q1w6HfSqER',
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    description: 'For growing operations',
    priceMonthly: 54999, // $549.99
    priceYearly: Math.round(54999 * 12 * (1 - YEARLY_DISCOUNT)), // ~$5,609.90/yr
    maxActiveLines: 60,
    popular: true,
    features: [
      'Up to 60 active production lines',
      'All Starter features',
      'Priority email support',
      'Monthly insights reports',
    ],
    stripePriceIdMonthly: 'price_1SnFcNHWgEvVObNzag27TfQY',
    stripePriceIdYearly: 'price_1SnGPGHWgEvVObNz1cEK82X6',
    stripeProductId: 'prod_Tkl8hBoNi8dZZL',
  },
  scale: {
    id: 'scale',
    name: 'Scale',
    description: 'For large factories',
    priceMonthly: 62999, // $629.99
    priceYearly: Math.round(62999 * 12 * (1 - YEARLY_DISCOUNT)), // ~$6,425.90/yr
    maxActiveLines: 100,
    features: [
      'Up to 100 active production lines',
      'All Growth features',
      'Phone support',
      'Dedicated success manager',
    ],
    stripePriceIdMonthly: 'price_1SnFcIHWgEvVObNz2u1IfoEw',
    stripePriceIdYearly: 'price_1SnGQQHWgEvVObNz6Gf4ff6Y',
    stripeProductId: 'prod_Tkl8LGqEjZVnRG',
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For enterprise operations',
    priceMonthly: 0, // Custom pricing
    priceYearly: 0, // Custom pricing
    maxActiveLines: null, // Unlimited
    features: [
      'Unlimited active production lines',
      'All Scale features',
      'Custom integrations',
      'SLA guarantee',
      'API access',
      'On-site training',
    ],
    stripePriceIdMonthly: null, // Custom pricing - contact sales
    stripePriceIdYearly: null,
    stripeProductId: null,
  },
};

// Price ID to tier mapping for webhook/check-subscription use
export const STRIPE_PRICE_TO_TIER: Record<string, { tier: PlanTier; interval: BillingInterval }> = {
  // Monthly
  'price_1SnFcPHWgEvVObNzV8DUHzpe': { tier: 'starter', interval: 'month' },
  'price_1SnFcNHWgEvVObNzag27TfQY': { tier: 'growth', interval: 'month' },
  'price_1SnFcIHWgEvVObNz2u1IfoEw': { tier: 'scale', interval: 'month' },
  // Yearly
  'price_1SnGNvHWgEvVObNzzSlIyDmj': { tier: 'starter', interval: 'year' },
  'price_1SnGPGHWgEvVObNz1cEK82X6': { tier: 'growth', interval: 'year' },
  'price_1SnGQQHWgEvVObNz6Gf4ff6Y': { tier: 'scale', interval: 'year' },
};

// Product ID to tier mapping
export const STRIPE_PRODUCT_TO_TIER: Record<string, PlanTier> = {
  'prod_Tkl8Q1w6HfSqER': 'starter',
  'prod_Tkl8hBoNi8dZZL': 'growth',
  'prod_Tkl8LGqEjZVnRG': 'scale',
};

export const getPlanById = (planId: string): PlanTierConfig | undefined => {
  return PLAN_TIERS[planId as PlanTier];
};

export const getPlanByPriceId = (priceId: string): { plan: PlanTierConfig; interval: BillingInterval } | undefined => {
  const mapping = STRIPE_PRICE_TO_TIER[priceId];
  if (!mapping) return undefined;
  return { plan: PLAN_TIERS[mapping.tier], interval: mapping.interval };
};

export const getPlanByProductId = (productId: string): PlanTierConfig | undefined => {
  const tier = STRIPE_PRODUCT_TO_TIER[productId];
  return tier ? PLAN_TIERS[tier] : undefined;
};

export const formatPlanPrice = (priceInCents: number): string => {
  if (priceInCents === 0) return 'Custom';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(priceInCents / 100);
};

export const getMaxLinesDisplay = (maxLines: number | null): string => {
  return maxLines === null ? 'Unlimited' : maxLines.toString();
};

// Map legacy subscription_tier values to new plan tiers
export const mapLegacyTier = (tier: string | null): PlanTier => {
  switch (tier) {
    case 'starter':
      return 'starter';
    case 'professional':
    case 'growth':
      return 'growth';
    case 'scale':
      return 'scale';
    case 'enterprise':
    case 'unlimited':
      return 'enterprise';
    default:
      return 'starter';
  }
};

// Get max lines for a tier
export const getMaxLinesForTier = (tier: PlanTier): number | null => {
  return PLAN_TIERS[tier].maxActiveLines;
};

// Get next upgrade tier
export const getNextTier = (currentTier: PlanTier): PlanTier | null => {
  const tierOrder: PlanTier[] = ['starter', 'growth', 'scale', 'enterprise'];
  const currentIndex = tierOrder.indexOf(currentTier);
  if (currentIndex < tierOrder.length - 1) {
    return tierOrder[currentIndex + 1];
  }
  return null;
};

// Get price ID based on tier and interval
export const getPriceIdForTier = (tier: PlanTier, interval: BillingInterval): string | null => {
  const plan = PLAN_TIERS[tier];
  return interval === 'year' ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly;
};

// Get display price based on interval
export const getDisplayPrice = (plan: PlanTierConfig, interval: BillingInterval): number => {
  return interval === 'year' ? plan.priceYearly : plan.priceMonthly;
};

// Calculate monthly equivalent for yearly price (for display)
export const getMonthlyEquivalent = (yearlyPrice: number): number => {
  return Math.round(yearlyPrice / 12);
};
