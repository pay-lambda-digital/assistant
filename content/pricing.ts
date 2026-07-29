export interface PlanTier {
  id: string;
  name: string;
  fee: string;
  description: string;
  features: string[];
  available: boolean;
}

// Kept in sync by hand with the pricing section of app/page.tsx — see
// "Content maintenance" in ASSISTANT_PLAN.md.
export const plans: PlanTier[] = [
  {
    id: 'self-custody',
    name: 'Self-custody',
    fee: '0% fee, always',
    description:
      'You own your addresses. Funds go directly to your wallets — no intermediary, no our layer.',
    features: [
      'Add your own crypto addresses',
      'BSC, Ethereum, Tron, TON, Polygon, Arbitrum',
      'USDT & USDC',
      'Webhook notifications',
      '0% fee, always',
      'Dashboard — full control over your payments',
    ],
    available: true,
  },
  {
    id: 'auto-convert',
    name: 'Auto-convert',
    fee: '0.1% per transaction',
    description:
      'Add only your USDT address. All incoming payments in any crypto are automatically ' +
      'converted to USDT and forwarded to you.',
    features: [
      'Single USDT payout address',
      'Auto-conversion from any crypto',
      'Recurring subscriptions',
      'Webhook notifications',
      '0.1% per transaction',
      'Dashboard — full control over your payments',
    ],
    available: false,
  },
];
