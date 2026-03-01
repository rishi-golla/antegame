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

const PROGRAM_ID = new PublicKey('8HvezzN7yPPPNri1pjPzsM79YtevVFGwV66FWNsaoP1U');

// Game signer pubkey (the Ed25519 key the server uses to sign settlements)
const GAME_SIGNER = new PublicKey('J8TTdGCcTZKhuTu1hKPaiRP17EwRCB3851jwVnpuyLU8');

// Fee vault (deploy wallet receives 5% fees)
const FEE_VAULT = new PublicKey('4yYbxAcrx5CpfUrpWs6Bsk2M99bdewtRf2bTPReLKJuA');

// Fee basis points (500 = 5%)
const FEE_BPS = 500;

async function main() {
  // Load deploy wallet
  const walletPath = path.resolve(process.env.HOME!, '.config/solana/id.json');
  const rawKey = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const payer = Keypair.fromSecretKey(Uint8Array.from(rawKey));

  const connection = new anchor.web3.Connection(
    'https://api.devnet.solana.com',
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
  console.log(
    `View: https://explorer.solana.com/tx/${tx}?cluster=devnet`
  );
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
