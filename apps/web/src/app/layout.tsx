import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'War Konsumsi',
  description: 'Consumption War Selection System',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="antialiased selection:bg-amber-500 selection:text-black">
        <main className="min-h-screen flex flex-col justify-between max-w-md mx-auto p-4 sm:p-6">
          {children}
        </main>
      </body>
    </html>
  );
}
