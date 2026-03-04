/**
 * One-time script to initialize the GlobalConfig PDA on-chain.
 *
 * Usage:
 *   npx ts-node scripts/initialize.ts
 */
import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PublicKey, Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

if (!process.env.SOLANA_PROGRAM_ID) throw new Error('Missing SOLANA_PROGRAM_ID');
if (!process.env.SOLANA_GAME_SIGNER_PUBKEY) throw new Error('Missing SOLANA_GAME_SIGNER_PUBKEY');
if (!process.env.SOLANA_FEE_VAULT_PUBKEY) throw new Error('Missing SOLANA_FEE_VAULT_PUBKEY');
if (!process.env.SOLANA_RPC_URL) throw new Error('Missing SOLANA_RPC_URL');

const PROGRAM_ID = new PublicKey(process.env.SOLANA_PROGRAM_ID);
const GAME_SIGNER = new PublicKey(process.env.SOLANA_GAME_SIGNER_PUBKEY);
const FEE_VAULT = new PublicKey(process.env.SOLANA_FEE_VAULT_PUBKEY);
const FEE_BPS = parseInt(process.env.SOLANA_FEE_BPS ?? '500', 10);
const CLUSTER = process.env.SOLANA_CLUSTER ?? 'devnet';

async function main() {
  // Load deploy wallet
  const walletPath = path.resolve(process.env.HOME!, '.config/solana/id.json');
  const rawKey = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const payer = Keypair.fromSecretKey(Uint8Array.from(rawKey));

  const connection = new anchor.web3.Connection(
    process.env.SOLANA_RPC_URL!,
    'confirmed'
  );

  const wallet = new anchor.Wallet(payer);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });
  anchor.setProvider(provider);

  // Load IDL from build output
  const idlPath = path.resolve(__dirname, '../target/idl/monopoly_game.json');
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));

  // Fix the IDL address to match our program
  idl.address = PROGRAM_ID.toBase58();

  const program = new Program(idl, provider);

  // Derive config PDA
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    PROGRAM_ID
  );

  console.log('Program ID:', PROGRAM_ID.toBase58());
  console.log('Config PDA:', configPda.toBase58());
  console.log('Game Signer:', GAME_SIGNER.toBase58());
  console.log('Fee Vault:', FEE_VAULT.toBase58());
  console.log('Fee BPS:', FEE_BPS);
  console.log('Authority (payer):', payer.publicKey.toBase58());
  console.log('');

  // Check if already initialized
  const existing = await connection.getAccountInfo(configPda);
  if (existing) {
    console.log('GlobalConfig PDA already exists! Skipping initialization.');
    return;
  }

  console.log('Initializing GlobalConfig...');

  const tx = await (program.methods as any)
    .initialize(GAME_SIGNER, FEE_VAULT, FEE_BPS)
    .accounts({
      config: configPda,
      authority: payer.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([payer])
    .rpc();

  console.log('Initialized! Tx:', tx);
  const clusterParam = CLUSTER === 'mainnet-beta' ? '' : `?cluster=${CLUSTER}`;
  console.log(
    `View: https://explorer.solana.com/tx/${tx}${clusterParam}`
  );
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
