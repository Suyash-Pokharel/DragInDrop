import React from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-text-main">
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
