import { NextRequest, NextResponse } from "next/server";

const DEBRIDGE_STATUS_API = "https://dln.debridge.finance/v1.0/dln/order";

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("orderId");
  if (!orderId) {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }

  if (!/^0x[0-9a-fA-F]{64}$/.test(orderId)) {
    return NextResponse.json({ error: "orderId must be a 0x-prefixed 64-byte hex" }, { status: 400 });
  }

  try {
    const res = await fetch(`${DEBRIDGE_STATUS_API}/${orderId}/status`);
    if (!res.ok) {
      const text = await res.text();
      // deBridge returns 404 for new orders that haven't propagated yet
      if (res.status === 404 || text.includes("UNKNOWN_ORDER")) {
        return NextResponse.json({ status: "Pending" });
      }
      return NextResponse.json({ error: text }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Status check failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
