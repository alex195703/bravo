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
  title: "«Браво» — соционический симулятор торговой сети",
  description:
    "Игра-симулятор: вы владелец сети продуктовых магазинов «Браво». На рынке труда нет всех 16 типов соционики — набирайте команду из того, что есть, и проводите её через бизнес-кризисы.",
  keywords: ["соционика", "симулятор", "сеть магазинов", "управление командой", "интертипные отношения", "бизнес-игра"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
