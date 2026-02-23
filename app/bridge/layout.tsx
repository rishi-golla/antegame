"use client";

import { WalletProviderWrapper } from "@/context/SolanaWalletContext";

export default function BridgeLayout({ children }: { children: React.ReactNode }) {
  return <WalletProviderWrapper>{children}</WalletProviderWrapper>;
}
