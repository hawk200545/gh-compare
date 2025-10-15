import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ReactQueryProvider } from "@/components/providers/react-query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GitHub Showdown",
  description:
    "Compare GitHub profiles with data-rich visuals and a dash of meme-worthy humor.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="system">
          <ReactQueryProvider>
            <div className="pointer-events-none fixed -left-32 top-16 hidden h-[420px] w-[420px] animate-[spin_50s_linear_infinite] rounded-full bg-gradient-to-br from-indigo-500/35 via-cyan-400/25 to-emerald-300/30 blur-3xl lg:block dark:from-indigo-900/35 dark:via-blue-900/25 dark:to-emerald-900/30" />
            <div className="pointer-events-none fixed -right-32 bottom-24 hidden h-[360px] w-[360px] animate-[spin_65s_linear_infinite] rounded-full bg-gradient-to-br from-purple-500/25 via-sky-300/25 to-pink-300/30 blur-[110px] md:block dark:from-purple-900/30 dark:via-indigo-900/25 dark:to-rose-900/35" />
            <div className="relative z-10">{children}</div>
          </ReactQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
