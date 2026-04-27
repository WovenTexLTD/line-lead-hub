// Shared Worldpay API utilities for edge functions

const WORLDPAY_API_BASE = Deno.env.get('WORLDPAY_API_BASE') || 'https://access.worldpay.com';
const WORLDPAY_ENTITY = Deno.env.get('WORLDPAY_ENTITY_ID') || '';
const WORLDPAY_USERNAME = Deno.env.get('WORLDPAY_API_USERNAME') || '';
const WORLDPAY_PASSWORD = Deno.env.get('WORLDPAY_API_PASSWORD') || '';
const WORLDPAY_CHECKOUT_ID = Deno.env.get('WORLDPAY_CHECKOUT_ID') || '';

// Base64-encoded Basic Auth header
function getAuthHeader(): string {
  const encoded = btoa(`${WORLDPAY_USERNAME}:${WORLDPAY_PASSWORD}`);
  return `Basic ${encoded}`;
}

// Common headers for Worldpay API calls
function getHeaders(): Record<string, string> {
  return {
    'Authorization': getAuthHeader(),
    'Content-Type': 'application/vnd.worldpay.payments-v7+json',
    'Accept': 'application/vnd.worldpay.payments-v7+json',
  };
}

export function getCheckoutId(): string {
  return WORLDPAY_CHECKOUT_ID;
}

export function getEntityId(): string {
  return WORLDPAY_ENTITY;
}

// Plan tier pricing in cents (USD) — matches frontend plan-tiers.ts
export const WORLDPAY_PLAN_TIERS: Record<string, { priceMonthly: number; priceYearly: number; maxLines: number }> = {
  starter: { priceMonthly: 39999, priceYearly: 407990, maxLines: 30 },
  growth: { priceMonthly: 54999, priceYearly: 560990, maxLines: 60 },
  scale: { priceMonthly: 62999, priceYearly: 642590, maxLines: 100 },
};

export function getPriceForTier(tier: string, interval: string): number {
  const plan = WORLDPAY_PLAN_TIERS[tier];
  if (!plan) throw new Error(`Unknown tier: ${tier}`);
  return interval === 'year' ? plan.priceYearly : plan.priceMonthly;
}

export function getMaxLinesForTier(tier: string): number {
  return WORLDPAY_PLAN_TIERS[tier]?.maxLines ?? 30;
}

// ------- Worldpay API calls -------

export interface WorldpayAuthResponse {
  outcome: string;
  schemeReference?: string;
  riskFactors?: unknown[];
  _links?: Record<string, { href: string }>;
  [key: string]: unknown;
}

export interface WorldpayTokenResponse {
  tokenHref: string;
  tokenId: string;
}

export interface WorldpayTokenDetails {
  paymentInstrument?: {
    type?: string;
    cardNumber?: string; // masked, e.g. "****1111"
    cardExpiryDate?: { month: number; year: number };
    cardBrand?: string;
    bin?: string;
  };
  [key: string]: unknown;
}

// Create a session for the Checkout SDK
// The frontend uses this session with the SDK to securely collect card details
export async function createCheckoutSession(): Promise<string> {
  const res = await fetch(`${WORLDPAY_API_BASE}/sessions`, {
    method: 'POST',
    headers: {
      'Authorization': getAuthHeader(),
      'Content-Type': 'application/vnd.worldpay.sessions-v1+json',
      'Accept': 'application/vnd.worldpay.sessions-v1+json',
    },
    body: JSON.stringify({
      merchant: { entity: WORLDPAY_ENTITY },
      checkoutId: WORLDPAY_CHECKOUT_ID,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Worldpay session creation failed: ${res.status} - ${error}`);
  }

  const data = await res.json();
  // The session href is in the _links.self.href or returned directly
  const sessionHref = data._links?.['sessions:session']?.href
    || data._links?.self?.href
    || data.href;

  if (!sessionHref) {
    throw new Error('No session href returned from Worldpay');
  }

  return sessionHref;
}

// Authorize a payment (initial or recurring)
export async function authorizePayment(params: {
  transactionReference: string;
  amount: number;
  currency: string;
  paymentInstrument: { type: string; sessionHref?: string; href?: string };
  customerAgreement: {
    type: string;
    storedCardUsage: string;
    schemeReference?: string;
  };
  narrative?: string;
}): Promise<WorldpayAuthResponse> {
  const paymentInstrumentBody: Record<string, unknown> = {
    type: params.paymentInstrument.type,
  };
  if (params.paymentInstrument.sessionHref) {
    paymentInstrumentBody.sessionHref = params.paymentInstrument.sessionHref;
  }
  if (params.paymentInstrument.href) {
    paymentInstrumentBody.href = params.paymentInstrument.href;
  }

  const customerAgreement: Record<string, unknown> = {
    type: params.customerAgreement.type,
    storedCardUsage: params.customerAgreement.storedCardUsage,
  };
  if (params.customerAgreement.schemeReference) {
    customerAgreement.schemeReference = params.customerAgreement.schemeReference;
  }

  const body = {
    transactionReference: params.transactionReference,
    merchant: { entity: WORLDPAY_ENTITY },
    instruction: {
      narrative: { line1: params.narrative || 'Production Portal' },
      value: {
        currency: params.currency,
        amount: params.amount,
      },
      paymentInstrument: paymentInstrumentBody,
    },
    customerAgreement,
  };

  const res = await fetch(`${WORLDPAY_API_BASE}/payments/authorizations`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Worldpay authorization failed: ${res.status} - ${error}`);
  }

  return await res.json();
}

// Create a stored token from a checkout session
export async function createToken(sessionHref: string): Promise<WorldpayTokenResponse> {
  const res = await fetch(`${WORLDPAY_API_BASE}/tokens`, {
    method: 'POST',
    headers: {
      'Authorization': getAuthHeader(),
      'Content-Type': 'application/vnd.worldpay.tokens-v3+json',
      'Accept': 'application/vnd.worldpay.tokens-v3+json',
    },
    body: JSON.stringify({
      paymentInstrument: {
        type: 'card/checkout+session',
        sessionHref,
      },
      merchant: { entity: WORLDPAY_ENTITY },
      namespace: 'production-portal',
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Worldpay token creation failed: ${res.status} - ${error}`);
  }

  const data = await res.json();
  const tokenHref = data._links?.['tokens:token']?.href
    || data._links?.self?.href
    || data.href;

  if (!tokenHref) {
    throw new Error('No token href returned from Worldpay');
  }

  // Extract token ID from href (last segment)
  const tokenId = tokenHref.split('/').pop() || '';

  return { tokenHref, tokenId };
}

// Get stored token details (card info)
export async function getToken(tokenHref: string): Promise<WorldpayTokenDetails> {
  const res = await fetch(tokenHref, {
    method: 'GET',
    headers: {
      'Authorization': getAuthHeader(),
      'Accept': 'application/vnd.worldpay.tokens-v3+json',
    },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Worldpay token lookup failed: ${res.status} - ${error}`);
  }

  return await res.json();
}

// Delete a stored token
export async function deleteToken(tokenHref: string): Promise<void> {
  const res = await fetch(tokenHref, {
    method: 'DELETE',
    headers: {
      'Authorization': getAuthHeader(),
    },
  });

  if (!res.ok && res.status !== 404) {
    const error = await res.text();
    throw new Error(`Worldpay token deletion failed: ${res.status} - ${error}`);
  }
}

// Verify webhook signature (HMAC-SHA256)
export async function verifyWebhookSignature(
  body: string,
  signatureHeader: string,
): Promise<boolean> {
  const webhookSecret = Deno.env.get('WORLDPAY_WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.warn('[WORLDPAY] No webhook secret configured, skipping signature verification');
    return true; // Allow during development
  }

  // Worldpay signature format: {keyId}/{hashFunction}/{signature}
  const parts = signatureHeader.split('/');
  if (parts.length !== 3) return false;

  const [, , signature] = parts;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(mac)));

  return signature === expectedSignature;
}
