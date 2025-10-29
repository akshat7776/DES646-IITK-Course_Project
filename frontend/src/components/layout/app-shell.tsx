
"use client";

import { Header } from "@/components/layout/header";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
    </>
  );
}
