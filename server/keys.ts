/**
 * Secure key loader — reads private keys from ~/.config/ante/keys.json
 * instead of .env to keep secrets out of the codebase.
 *
 * File must have chmod 600 (owner-only read/write).
 * Falls back gracefully if file doesn't exist (e.g. in production where
 * keys are injected via environment variables).
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const KEYS_PATH = path.join(os.homedir(), '.config', 'ante', 'keys.json');

interface SecureKeys {
  DEPLOYER_PRIVATE_KEY?: string;
  GAME_SIGNER_PRIVATE_KEY?: string;
  ALCHEMY_API_KEY?: string;
  BASESCAN_API_KEY?: string;
  /** Solana Ed25519 keypair secret (JSON array or base58). Used by solana-contracts.ts. */
  SOLANA_GAME_SIGNER_SECRET?: string;
  [key: string]: string | undefined;
}

let _cached: SecureKeys | null = null;

export function loadSecureKeys(): SecureKeys {
  if (_cached) return _cached;

  try {
    // Check file permissions (unix only)
    const stat = fs.statSync(KEYS_PATH);
    const mode = stat.mode & 0o777;
    if (mode !== 0o600) {
      console.warn(`[keys] WARNING: ${KEYS_PATH} has permissions ${mode.toString(8)}, expected 600. Run: chmod 600 ${KEYS_PATH}`);
    }

    const raw = fs.readFileSync(KEYS_PATH, 'utf-8');
    _cached = JSON.parse(raw) as SecureKeys;
    console.log('[keys] Loaded secure keys from', KEYS_PATH);
    return _cached;
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      console.log('[keys] No keyfile at', KEYS_PATH, '— using environment variables');
    } else {
      console.warn('[keys] Failed to load keyfile:', err.message);
    }
    _cached = {};
    return _cached;
  }
}
