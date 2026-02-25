import { NextRequest, NextResponse } from 'next/server';

const RPC_URL = process.env.BASE_RPC_URL;

// Whitelist of allowed JSON-RPC methods (read-only + send tx)
const ALLOWED_METHODS = new Set([
  'eth_call',
  'eth_getBalance',
  'eth_getTransactionReceipt',
  'eth_getTransactionByHash',
  'eth_blockNumber',
  'eth_getBlockByNumber',
  'eth_getBlockByHash',
  'eth_chainId',
  'eth_gasPrice',
  'eth_estimateGas',
  'eth_getCode',
  'eth_getLogs',
  'eth_sendRawTransaction',
  'eth_getTransactionCount',
  'eth_maxPriorityFeePerGas',
  'eth_feeHistory',
  'net_version',
  'alchemy_getAssetTransfers',
]);

// Simple in-memory rate limiter per IP
const ipHits = new Map<string, { count: number; resetAt: number }>();
const MAX_REQUESTS_PER_MINUTE = 200;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  let entry = ipHits.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + 60_000 };
    ipHits.set(ip, entry);
  }
  entry.count++;
  return entry.count <= MAX_REQUESTS_PER_MINUTE;
}

// Cleanup every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of ipHits) {
    if (now > v.resetAt) ipHits.delete(k);
  }
}, 120_000);

export async function POST(req: NextRequest) {
  if (!RPC_URL) {
    return NextResponse.json({ error: 'RPC not configured' }, { status: 503 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  try {
    const body = await req.json();

    // Validate method is allowed (handle single and batch requests)
    const requests = Array.isArray(body) ? body : [body];
    for (const r of requests) {
      if (!r.method || !ALLOWED_METHODS.has(r.method)) {
        return NextResponse.json(
          { error: `Method not allowed: ${r.method}` },
          { status: 403 }
        );
      }
    }

    // Limit batch size
    if (requests.length > 50) {
      return NextResponse.json({ error: 'Batch too large (max 50)' }, { status: 400 });
    }

    const resp = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: 'RPC request failed' }, { status: 502 });
  }
}
