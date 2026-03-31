"use client";

import { ThemeProvider } from "next-themes";
import { ModalProvider } from "./components/ModalProvider";
import { UserProvider } from "./components/UserProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <UserProvider>
        <ModalProvider>{children}</ModalProvider>
      </UserProvider>
    </ThemeProvider>
  );
}
