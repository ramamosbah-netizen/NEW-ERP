import type { Metadata } from "next";
import "./globals.css";
import { PermissionsProvider } from "@/lib/permissions/usePermissions";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "JEET ERP | Enterprise Resource Planning",
  description: "Next-generation ERP platform with role-based workspace management.",
  manifest: "/manifest.json"
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="erp-container">
          <div className="glow-blob blob-1"></div>
          <div className="glow-blob blob-2"></div>
          <div className="glow-blob blob-3"></div>
          <PermissionsProvider>
            <AppShell>
              {children}
            </AppShell>
          </PermissionsProvider>
        </div>
      </body>
    </html>
  );
}
