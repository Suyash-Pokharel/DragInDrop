"use client";

import { ThemeProvider } from "next-themes";
import { ModalProvider } from "./components/ModalProvider";
import { UserProvider } from "./components/UserProvider";
import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <UserProvider>
          <ModalProvider>{children}</ModalProvider>
        </UserProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}

