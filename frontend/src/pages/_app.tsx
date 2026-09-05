import type { AppProps } from 'next/app'
import Head from 'next/head'
import '../styles/globals.css'
import Navbar from '../components/Navbar'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>HAULIT - Logistics</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Simplifying local logistics across India. Reliable trucks, affordable rates." />
      </Head>
      <div className="flex flex-col w-full min-h-screen bg-[var(--color-surface-bg)] text-[var(--color-on-surface)] antialiased font-sans">
        <Navbar />
        <div className="pt-[88px] flex-1">
          <Component {...pageProps} />
        </div>

        {/* Neomorphic Footer */}
        <footer className="w-full bg-[var(--color-surface-bg)] pt-[var(--spacing-section-padding-mobile)] pb-12 border-t-2 border-[var(--color-surface-container-highest)]">
          <div className="max-w-[var(--spacing-container-max-width)] mx-auto px-[var(--spacing-gutter)] flex flex-col md:flex-row justify-between items-start gap-8">
            {/* Brand */}
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-3 bg-[var(--color-surface-bg)] p-4 rounded-2xl neo-shadow-inner w-fit">
                <div className="w-9 h-9 flex flex-col neo-shadow-sm relative justify-center items-center rounded-full overflow-hidden">
                  <img
                    className="absolute w-[3.5rem] mt-0.5 ml-[0.5px] max-w-none"
                    src="/assets/haulit.png"
                    alt="HAULIT Logo"
                  />
                </div>
                <span className="text-[var(--text-headline-md)] font-extrabold text-[var(--color-on-surface)] uppercase tracking-tighter">
                  HAULIT
                </span>
              </div>
              <p className="text-[var(--text-body-md)] text-[var(--color-secondary)] max-w-sm">
                Simplifying local logistics across India. Reliable trucks, affordable rates.
              </p>
            </div>

            {/* Links + Copyright */}
            <div className="flex flex-col md:items-end gap-8">
              <p className="text-[var(--text-body-md)] text-[var(--color-secondary)] opacity-70">
                © 2024 HAULIT Logistics. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
