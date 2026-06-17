import type { Metadata } from "next";
import "./globals.css";
import { PermissionsProvider } from "@/lib/permissions/usePermissions";
import QueryProvider from "@/lib/query/QueryProvider";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Aura ERP | Enterprise Resource Planning",
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
      <body suppressHydrationWarning>
        {/* No-flash theme boot: apply persisted theme/density before paint */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('erp-theme');if(t==='light')document.body.classList.add('theme-light');else if(t==='dark')document.body.classList.add('theme-dark');if(localStorage.getItem('erp-density-compact')==='true')document.body.classList.add('theme-compact');}catch(e){}})();",
          }}
        />
        <div className="erp-container">
          <div className="glow-blob blob-1"></div>
          <div className="glow-blob blob-2"></div>
          <div className="glow-blob blob-3"></div>
          <QueryProvider>
            <PermissionsProvider>
              <AppShell>
                {children}
              </AppShell>
            </PermissionsProvider>
          </QueryProvider>
        </div>
      </body>
    </html>
  );
}
