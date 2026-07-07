"use client";

import { createContext, useContext } from "react";

interface WmsSession {
  userId: string | null;
  managerBranchId: string | null;
  isGlobal: boolean;
  role: string;
}

const WmsContext = createContext<WmsSession | null>(null);

export function WmsSessionProvider({ children, session }: { children: React.ReactNode; session: WmsSession }) {
  return (
    <WmsContext.Provider value={session}>
      {children}
    </WmsContext.Provider>
  );
}

export const useWms = () => {
  const context = useContext(WmsContext);
  if (!context) {
    throw new Error("SİSTEM HATASI: useWms hook'u sadece WmsSessionProvider içinde kullanılabilir!");
  }
  return context;
};