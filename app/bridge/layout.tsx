"use client";

import { WalletContextProvider } from "@/context/WalletContext";

export default function BridgeLayout({ children }: { children: React.ReactNode }) {
  return <WalletContextProvider>{children}</WalletContextProvider>;
}
