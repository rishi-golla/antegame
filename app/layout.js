import './globals.css';

export const metadata = {
  title: 'Monopoly Game',
  description: 'Toony monopoly-like game UI'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
