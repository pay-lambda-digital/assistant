export interface ChainInfo {
  chain: string;
  name: string;
  tokens: string;
  note: string;
}

// Kept in sync by hand with the "Supported Chains & Tokens" section of app/docs —
// see "Content maintenance" in ASSISTANT_PLAN.md.
export const chains: ChainInfo[] = [
  { chain: 'BSC', name: 'BNB Smart Chain', tokens: 'USDT, USDC', note: '~3s block time, 15 confirmations' },
  { chain: 'ETH', name: 'Ethereum', tokens: 'USDT, USDC', note: '~12s block time, 12 confirmations' },
  { chain: 'TRON', name: 'Tron', tokens: 'USDT', note: '~3s block time, 19 confirmations' },
  { chain: 'TON', name: 'TON', tokens: 'USDT Jetton', note: '~5s block time, finality lag 30s' },
  { chain: 'POLYGON', name: 'Polygon', tokens: 'USDT, USDC', note: '~2s block time, 64 confirmations' },
  { chain: 'ARBITRUM', name: 'Arbitrum', tokens: 'USDT, USDC', note: '~0.25s block time, 40 confirmations' },
];
