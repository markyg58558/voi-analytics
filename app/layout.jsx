import { Bebas_Neue, Space_Grotesk } from 'next/font/google';
import './globals.css';

const displayFont = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display'
});

const bodyFont = Space_Grotesk({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-body'
});

export const metadata = {
  title: 'Victims Of Ink Studio App',
  description: 'Custom studio control panel for Victims Of Ink'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
