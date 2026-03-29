import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import { ErrorRecoveryReset } from "@/components/error-recovery-reset";
import "./globals.css";

const headingFont = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
});

const bodyFont = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PrintFlow 3D",
  description: "Sistema completo para operação de impressão 3D, do orçamento ao financeiro.",
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
