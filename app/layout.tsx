import './globals.css';
import '@solana/wallet-adapter-react-ui/styles.css';
import type { Metadata } from 'next';
import Script from 'next/script';
import { AudioProvider } from '@/context/AudioContext';
import AppCrashBoundary from '@/components/AppCrashBoundary';
export const metadata: Metadata = {
  title: 'Ante',
  description: 'Stake crypto. Roll dice. Win the pot.',
  metadataBase: new URL('https://ante.wtf'),
  openGraph: {
    title: 'Ante',
    description: 'Stake crypto. Roll dice. Win the pot.',
    images: [
      {
        url: 'https://ante.wtf/assets/misc/og-image.png',
        width: 1500,
        height: 500,
        alt: 'Ante — Crypto Board Game',
      },
    ],
    type: 'website',
    siteName: 'Ante',
    url: 'https://ante.wtf',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ante',
    description: 'Stake crypto. Roll dice. Win the pot.',
    images: ['https://ante.wtf/assets/misc/og-image.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ background: '#0a0a0a' }}>
      <body style={{ background: '#0a0a0a' }}>
        <Script id="chunk-recovery" strategy="beforeInteractive">{`
          (function () {
            var KEY = '__ante_chunk_reload_once__';
            function shouldReloadFromMessage(msg) {
              if (!msg) return false;
              return (
                msg.indexOf('Loading chunk') !== -1 ||
                msg.indexOf('ChunkLoadError') !== -1 ||
                (msg.indexOf('Unexpected token') !== -1 && msg.indexOf('<') !== -1)
              );
            }
            function triggerReload() {
              try {
                if (sessionStorage.getItem(KEY) === '1') return;
                sessionStorage.setItem(KEY, '1');
                location.reload();
              } catch (_) {}
            }
            window.addEventListener('error', function (e) {
              var t = e && e.target;
              var src = t && t.src ? String(t.src) : '';
              var href = t && t.href ? String(t.href) : '';
              if (src.indexOf('/_next/static/') !== -1 || href.indexOf('/_next/static/') !== -1) {
                triggerReload();
                return;
              }
              var msg = e && e.message ? String(e.message) : '';
              if (shouldReloadFromMessage(msg)) triggerReload();
            }, true);
            window.addEventListener('unhandledrejection', function (e) {
              var reason = e && e.reason;
              var msg = reason && (reason.message || reason.toString) ? String(reason.message || reason.toString()) : '';
              if (shouldReloadFromMessage(msg)) triggerReload();
            });
            window.addEventListener('load', function () {
              try { sessionStorage.removeItem(KEY); } catch (_) {}
            });
          })();
        `}</Script>
        <AppCrashBoundary>
          <AudioProvider>
            {children}
          </AudioProvider>
        </AppCrashBoundary>
      </body>
    </html>
  );
}
