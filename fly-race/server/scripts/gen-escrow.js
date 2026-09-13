/**
 * Generates a fresh escrow keypair for devnet testing and prints the values to
 * paste into .env. Run:  node scripts/gen-escrow.js
 *
 * The printed secret key controls real funds on whatever cluster you use it on.
 * Keep it out of git, and never generate a mainnet escrow this way on a shared
 * or disposable machine.
 */
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const kp = Keypair.generate();
console.log('Escrow public key (players send USDC here):');
console.log('  ' + kp.publicKey.toBase58());
console.log('\nAdd to server/.env:');
console.log('  ESCROW_SECRET_KEY=' + bs58.encode(kp.secretKey));
console.log('\nNext, on devnet:');
console.log('  1. Fund it with SOL for fees:  solana airdrop 2 ' + kp.publicKey.toBase58() + ' --url devnet');
console.log('  2. Fund it with test USDC:     https://faucet.circle.com  (select Solana Devnet)');
