"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { ModalProvider } from "./components/ModalProvider";
import { UserProvider } from "./components/UserProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <UserProvider>
          <ModalProvider>{children}</ModalProvider>
        </UserProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
