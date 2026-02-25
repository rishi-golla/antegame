"use client";

import Link from "next/link";

export default function BridgePage() {
  return (
    <div style={s.container}>
      <div style={s.card}>
        <h1 style={s.title}>BRIDGE</h1>
        <p style={s.status}>Under Maintenance</p>
        <p style={s.desc}>
          The bridge is temporarily unavailable while we make improvements.
          Check back soon.
        </p>
        <Link href="/" style={s.homeLink}>
          Back to Home
        </Link>
      </div>
    </div>
  );
}

const s = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    padding: 16,
  } as React.CSSProperties,
  card: {
    background: "#1a1a2e",
    border: "2px solid #d4a843",
    borderRadius: 16,
    padding: 32,
    maxWidth: 460,
    width: "100%",
    textAlign: "center" as const,
  } as React.CSSProperties,
  title: {
    fontFamily: "'Press Start 2P', monospace",
    color: "#d4a843",
    fontSize: 18,
    margin: 0,
    marginBottom: 16,
  } as React.CSSProperties,
  status: {
    fontFamily: "'Press Start 2P', monospace",
    color: "#ff8c00",
    fontSize: 12,
    marginBottom: 16,
  } as React.CSSProperties,
  desc: {
    color: "#888",
    fontSize: 13,
    lineHeight: 1.6,
    marginBottom: 24,
  } as React.CSSProperties,
  homeLink: {
    display: "inline-block",
    padding: "12px 24px",
    background: "linear-gradient(135deg, #d4a843, #b8942e)",
    color: "#000",
    borderRadius: 10,
    textDecoration: "none",
    fontFamily: "'Press Start 2P', monospace",
    fontSize: 11,
    fontWeight: 700,
  } as React.CSSProperties,
};
