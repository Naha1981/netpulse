import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NetPulse AI — From spreadsheets to AI-powered ISP operations",
  description:
    "Upload your ISP's spreadsheets and get an AI-generated operations health report in minutes. No consultants, no migration project.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <aside className="px-6 py-3 text-center text-sm border-b" style={{borderColor:"var(--border)",color:"var(--text-dim)"}}>
          Sample data. Fictional records.
        </aside>
        {children}
      </body>
    </html>
  );
}
