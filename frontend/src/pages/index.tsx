import React from 'react'
import Link from 'next/link'
import HeroCarousel from '../components/HeroCarousel'

export default function Home(): React.ReactElement {
  return (
    <div className="bg-[var(--color-surface-bg)] font-sans text-[var(--color-on-surface)] antialiased">
      {/* Main Hero Section */}
      <main className="w-full bg-[var(--color-surface-bg)] min-h-[calc(100vh-80px)] flex items-center py-[var(--spacing-section-padding-mobile)] md:py-[var(--spacing-section-padding-desktop)]">
        <div className="max-w-[var(--spacing-container-max-width)] mx-auto px-[var(--spacing-gutter)] w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-24 items-center">

            {/* Left: Neomorphic Image Carousel */}
            <div className="order-2 md:order-1 flex justify-center md:justify-end">
              <HeroCarousel />
            </div>

            {/* Right: Content Card with Neomorphic Styling */}
            <div className="order-1 md:order-2 flex flex-col gap-8 max-w-xl">
              <div
                className="bg-[var(--color-surface-bg)] p-8 rounded-[32px] border-2 border-[var(--color-surface-bg)]"
                style={{ boxShadow: 'rgba(255, 255, 255, 0.8) -5px -5px 10px, rgba(0, 0, 0, 0.1) 5px 5px 10px' }}
              >
                <h1 className="text-5xl md:text-[var(--text-headline-xl)] font-extrabold leading-tight tracking-tight text-[var(--color-on-surface)] mb-6">
                  LETS{' '}
                  <span className="text-[var(--color-primary)] font-black drop-shadow-sm">HAULIT</span>
                  {' '}
                  INDIA!
                </h1>
                <p className="text-[var(--text-body-lg)] text-[var(--color-on-surface-variant)] leading-relaxed text-justify">
                  Samaan bhejna har baar complicated ya expensive nahi hona chahiye. Haulit ek
                  small scale logistics platform hai jo customers ko local truck owners se connect
                  karta hai, taaki goods ko affordable rates par easily transport kiya ja sake.
                  Chahe aap small business owner ho, retailer ho, manufacturer ho, ya simply kuch
                  samaan bhejna chahte ho, Haulit transportation ko simple banata hai. Pickup aur
                  delivery details share karo, suitable truck choose karo, aur shipment easily
                  book karo. Haulit ka focus simple hai. Local truck network ko better utilize
                  karna aur customers ko reliable, affordable transportation dena. Haulit ke saath,
                  logistics simple hai. Aapka samaan, sahi truck, sahi rate.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-6">
                <Link
                  href="/order"
                  className="neo-shadow-sm bg-[var(--color-surface-bg)] text-[var(--color-primary)] px-8 py-4 rounded-full hover:text-[var(--color-primary-container)] active:neo-shadow-inner active:scale-95 transition-all duration-300 flex items-center gap-2 text-[var(--text-label-md)] tracking-widest uppercase border border-[var(--color-surface-container-highest)] font-semibold"
                >
                  Get Started
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </Link>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}
