import React, { ReactNode } from 'react';
import './globals.css';
import { Navbar } from '../components/layout/Navbar';
import { ThemeProvider } from '../context/ThemeContext';
import { RippleEffect } from '../components/ui/RippleEffect';
import CustomCursor from '../components/CustomCursor';

export const metadata = {
  title: 'TDV MAFIA | Elit Onlayn Mafiya Platforması',
  description: 'Azərbaycanın ən möhtəşəm onlayn sosial deduksiya və mafiya mühərriki. 40–50 nəfərlik All-In rejimi, asimmetrik mini-oyunlar və 75s Gemini AI mühafizəsi.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <html lang="az" className="dark max-w-[100vw] overflow-x-clip" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <link rel="icon" type="image/png" href="/assets/tdv-logo.png" />
        <link rel="apple-touch-icon" href="/assets/tdv-logo.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('tdv_theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (saved === 'light' || (!saved && !prefersDark)) {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.classList.add('light');
                  } else {
                    document.documentElement.classList.add('dark');
                    document.documentElement.classList.remove('light');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-[100dvh] max-w-[100vw] overflow-x-clip bg-zinc-50 dark:bg-zinc-950 dark:bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] dark:from-purple-900/10 dark:via-zinc-950 dark:to-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-200 antialiased font-sans selection:bg-purple-600 selection:text-white">
        <ThemeProvider>
          <CustomCursor />
          <RippleEffect />
          <div className="flex flex-col min-h-[100dvh] max-w-[100vw] overflow-x-clip pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
            <Navbar />
            <main className="flex-1 min-w-0 max-w-[100vw] overflow-x-clip">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
