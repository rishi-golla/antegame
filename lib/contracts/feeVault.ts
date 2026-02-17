/**
 * Client-side read helpers for FeeVault.sol
 *
 * Mostly admin/dashboard use -- players don't interact with this directly.
 *
 * TODO: Uncomment when contract is deployed on Base Sepolia.
 */

import { createPublicClient, http, formatEther, type Address } from 'viem';
import { baseSepolia, base } from 'viem/chains';
import { FEE_VAULT_ABI } from './abi/FeeVault';
import { getAddresses, getChainEnv, getRpcUrl } from './addresses';

function getChain() {
  return getChainEnv() === 'base-mainnet' ? base : baseSepolia;
}

function getPublicClient() {
  return createPublicClient({
    chain: getChain(),
    transport: http(getRpcUrl()),
  });
}

export async function getVaultBalance(): Promise<string> {
  // const client = getPublicClient();
  // const addresses = getAddresses();
  // const balance = await client.getBalance({ address: addresses.feeVault });
  // return formatEther(balance);

  console.warn('[contracts] getVaultBalance stubbed');
  return '0';
}

export async function getVaultAdmin(): Promise<Address | null> {
  // const client = getPublicClient();
  // const addresses = getAddresses();
  // return client.readContract({
  //   address: addresses.feeVault,
  //   abi: FEE_VAULT_ABI,
  //   functionName: 'admin',
  // }) as Promise<Address>;

  console.warn('[contracts] getVaultAdmin stubbed');
  return null;
}

export async function getHotWallet(): Promise<Address | null> {
  // const client = getPublicClient();
  // const addresses = getAddresses();
  // return client.readContract({
  //   address: addresses.feeVault,
  //   abi: FEE_VAULT_ABI,
  //   functionName: 'hotWallet',
  // }) as Promise<Address>;

  console.warn('[contracts] getHotWallet stubbed');
  return null;
}
