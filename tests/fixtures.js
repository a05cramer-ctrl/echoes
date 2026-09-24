// Realistic Helius enhanced-transaction payloads for tests.
export const SOL = 'So11111111111111111111111111111111111111112';
export const W1 = '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1'; // test original #1
export const W2 = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'; // test original #2
export const MINT_A = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'; // BONK-like
export const MINT_B = 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm'; // WIF-like
export const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
let n = 0;
export const sig = () => 'sig' + (++n).toString().padStart(6, '0') + 'x'.repeat(40);

// wallet swaps `sol` SOL for `tokens` of `mint` (side buy) or the reverse (side sell)
export function swapTx({ wallet, side, mint, sol, tokens, decimals = 6, ts = 1_760_000_000, fee = 5000, wsol = false, signature = sig() }) {
  const lam = Math.round(sol * 1e9);
  const raw = String(Math.round(tokens * 10 ** decimals));
  const tokenChange = { userAccount: wallet, tokenAccount: 'ATA' + wallet.slice(0, 8), mint, rawTokenAmount: { tokenAmount: side === 'buy' ? raw : '-' + raw, decimals } };
  const accountData = [
    { account: wallet, nativeBalanceChange: wsol ? -fee : (side === 'buy' ? -lam : lam) - fee, tokenBalanceChanges: [] },
    { account: 'ATA' + wallet.slice(0, 8), nativeBalanceChange: 0, tokenBalanceChanges: [tokenChange] },
    { account: 'POOL1111111111111111111111111111', nativeBalanceChange: side === 'buy' ? lam : -lam, tokenBalanceChanges: [] },
  ];
  if (wsol) {
    accountData.push({ account: 'WSOLATA', nativeBalanceChange: 0, tokenBalanceChanges: [
      { userAccount: wallet, tokenAccount: 'WSOLATA', mint: SOL, rawTokenAmount: { tokenAmount: String(side === 'buy' ? -lam : lam), decimals: 9 } },
    ] });
  }
  return { signature, timestamp: ts, feePayer: wallet, fee, transactionError: null, type: 'SWAP', source: 'PUMP_FUN', accountData };
}

export function transferTx(wallet, sol) {
  return { signature: sig(), timestamp: 1_760_000_000, feePayer: wallet, fee: 5000, transactionError: null, type: 'TRANSFER',
    accountData: [{ account: wallet, nativeBalanceChange: -Math.round(sol * 1e9) - 5000, tokenBalanceChanges: [] }] };
}
