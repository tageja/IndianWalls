import './styles/globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'IndianWalls - Property Due Diligence Reports',
  description: 'AI-powered property due diligence reports for Indian real estate',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
