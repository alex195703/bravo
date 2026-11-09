import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "«Браво» — соціонічний симулятор торгової мережі · проф. Орлова О.В.",
  authors: [{ name: "професор Орлов О.В." }],
  description:
    "Гра-симулятор: ви власник мережі продуктових магазинів «Браво». На ринку праці немає всіх 16 типів соціоніки — набирайте команду з того, що є, і проводьте її крізь бізнес-кризи. Автор — професор Орлов О.В.",
  keywords: ["соціоніка", "симулятор", "мережа магазинів", "управління командою", "інтертипні стосунки", "бізнес-гра", "Орлов", "професор Орлов"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
