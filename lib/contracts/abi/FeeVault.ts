export const FEE_VAULT_ABI = [
  {
    type: 'function',
    name: 'admin',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'hotWallet',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'sweepCooldown',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'lastSweepTime',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'sweep',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setHotWallet',
    inputs: [{ name: '_wallet', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setSweepCooldown',
    inputs: [{ name: '_seconds', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'FeeReceived',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'FeesSwept',
    inputs: [
      { name: 'to', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;
