"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { ModalProvider } from "./components/ModalProvider";
import { UserProvider } from "./components/UserProvider";
import { ToastProvider } from "./components/ToastProvider";

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
          <ToastProvider>
            <ModalProvider>{children}</ModalProvider>
          </ToastProvider>
        </UserProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
