export const MONOPOLY_GAME_ABI = [
  // --- Core ---
  {
    type: 'function',
    name: 'createGame',
    inputs: [
      { name: 'gameId', type: 'bytes32' },
      { name: 'maxPlayers', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'joinGame',
    inputs: [{ name: 'gameId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'claimWinnings',
    inputs: [
      { name: 'gameId', type: 'bytes32' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // --- Cancel & Refund ---
  {
    type: 'function',
    name: 'cancelGame',
    inputs: [
      { name: 'gameId', type: 'bytes32' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'emergencyCancel',
    inputs: [{ name: 'gameId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimRefund',
    inputs: [{ name: 'gameId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // --- View ---
  {
    type: 'function',
    name: 'getGame',
    inputs: [{ name: 'gameId', type: 'bytes32' }],
    outputs: [
      { name: 'buyIn', type: 'uint256' },
      { name: 'maxPlayers', type: 'uint256' },
      { name: 'pot', type: 'uint256' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'state', type: 'uint8' },
      { name: 'players', type: 'address[]' },
      { name: 'winner', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'deposited',
    inputs: [
      { name: 'gameId', type: 'bytes32' },
      { name: 'player', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'feeBps',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'feeVault',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'gameSigner',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  // --- Events ---
  {
    type: 'event',
    name: 'GameCreated',
    inputs: [
      { name: 'gameId', type: 'bytes32', indexed: true },
      { name: 'buyIn', type: 'uint256', indexed: false },
      { name: 'maxPlayers', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'PlayerJoined',
    inputs: [
      { name: 'gameId', type: 'bytes32', indexed: true },
      { name: 'player', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'GameStarted',
    inputs: [{ name: 'gameId', type: 'bytes32', indexed: true }],
  },
  {
    type: 'event',
    name: 'GameSettled',
    inputs: [
      { name: 'gameId', type: 'bytes32', indexed: true },
      { name: 'winner', type: 'address', indexed: true },
      { name: 'payout', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'GameCancelled',
    inputs: [{ name: 'gameId', type: 'bytes32', indexed: true }],
  },
  {
    type: 'event',
    name: 'RefundClaimed',
    inputs: [
      { name: 'gameId', type: 'bytes32', indexed: true },
      { name: 'player', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;
