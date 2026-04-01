import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import { ErrorRecoveryReset } from "@/components/error-recovery-reset";
import { studioBrandLogoPath, studioBrandName } from "@/lib/branding";
import "./globals.css";

const headingFont = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
});

const bodyFont = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

const metadataBaseUrl =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  process.env.RENDER_EXTERNAL_URL?.trim() ||
  "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(metadataBaseUrl),
  title: studioBrandName,
  description: "Loja e operacao completa da GV 3D Studio para pecas impressas em 3D, encomendas e atendimento pelo WhatsApp.",
  icons: {
    icon: studioBrandLogoPath,
    apple: studioBrandLogoPath,
  },
  openGraph: {
    title: studioBrandName,
    description: "Loja e operacao completa da GV 3D Studio para pecas impressas em 3D, encomendas e atendimento pelo WhatsApp.",
    images: [studioBrandLogoPath],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${headingFont.variable} ${bodyFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ErrorRecoveryReset />
        {children}
      </body>
    </html>
  );
}
