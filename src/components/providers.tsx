"use client";

import { SessionProvider } from "next-auth/react";

/**
 * Providers — client-side React context providers wrapped in a single
 * client component so they can be used inside the server-rendered
 * RootLayout.
 *
 * Add more providers (theme, query client, etc.) here as the app grows.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
