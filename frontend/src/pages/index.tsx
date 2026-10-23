import React from 'react'
import Link from 'next/link'
import HeroCarousel from '../components/HeroCarousel'

const FEATURES = [
  {
    icon: 'local_shipping',
    title: 'Book a Truck',
    desc: 'Choose from small, medium, or large trucks based on your cargo size and distance.',
  },
  {
    icon: 'route',
    title: 'Real-Time Tracking',
    desc: 'Monitor your shipment live — from pickup to delivery, every step of the way.',
  },
  {
    icon: 'currency_rupee',
    title: 'Affordable Rates',
    desc: 'Transparent pricing with no hidden fees. Pay only for what you need.',
  },
]

export default function Home(): React.ReactElement {
  return (
    <div className="bg-[var(--color-surface-bg)] font-sans text-[var(--color-on-surface)] antialiased">

      <main className="w-full bg-[var(--color-surface-bg)] min-h-[calc(100vh-80px)] flex items-center py-[var(--spacing-section-padding-mobile)] md:py-[var(--spacing-section-padding-desktop)]">
        <div className="max-w-[var(--spacing-container-max-width)] mx-auto px-[var(--spacing-gutter)] w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-24 items-center">

            <div className="order-2 md:order-1 flex justify-center md:justify-end">
              <HeroCarousel />
            </div>

            <div className="order-1 md:order-2 flex flex-col gap-6 max-w-xl">

              <span className="inline-flex items-center gap-1.5 self-start px-3 py-1 rounded-full text-[var(--text-label-md)] tracking-widest uppercase font-bold neo-shadow text-[var(--color-primary)] text-xs">
                <span className="material-symbols-outlined text-sm">local_shipping</span>
                India&apos;s Local Logistics
              </span>

              <div>
                <h1 className="text-5xl md:text-[var(--text-headline-xl)] font-extrabold leading-tight tracking-tight text-[var(--color-on-surface)]">
                  LETS{' '}
                  <span className="text-[var(--color-primary)] font-black drop-shadow-sm">HAULIT</span>
                  {' '}INDIA!
                </h1>
                <p className="mt-4 text-[var(--text-body-lg)] text-[var(--color-on-surface-variant)] leading-relaxed">
                  Connect with local truck owners and ship your goods — fast, affordable, and hassle-free.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {['Book in minutes', 'Live tracking', 'Transparent pricing'].map(tag => (
                  <span
                    key={tag}
                    className="px-3 py-1.5 rounded-full neo-shadow-inner text-[var(--text-label-md)] tracking-widest uppercase font-semibold text-[var(--color-on-surface-variant)] text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-4 pt-2">
                <Link
                  href="/order"
                  className="neo-shadow bg-[var(--color-surface-bg)] text-[var(--color-primary)] px-8 py-4 rounded-full hover:neo-shadow-sm active:neo-shadow-inner active:scale-95 transition-all duration-300 flex items-center gap-2 text-[var(--text-label-md)] tracking-widest uppercase border border-[var(--color-surface-container-highest)] font-bold"
                >
                  Get Started
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </Link>
                <Link
                  href="/track"
                  className="neo-shadow-inner bg-[var(--color-surface-bg)] text-[var(--color-secondary)] px-8 py-4 rounded-full hover:neo-shadow active:scale-95 transition-all duration-300 flex items-center gap-2 text-[var(--text-label-md)] tracking-widest uppercase font-semibold"
                >
                  <span className="material-symbols-outlined text-sm">search</span>
                  Track Order
                </Link>
              </div>
            </div>

          </div>
        </div>
      </main>

      <section className="py-16 bg-[var(--color-surface-bg)]">
        <div className="max-w-[var(--spacing-container-max-width)] mx-auto px-[var(--spacing-gutter)]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <div
                key={f.title}
                className="neo-shadow rounded-3xl p-6 flex flex-col gap-3 bg-[var(--color-surface-bg)] border border-[var(--color-surface-container-highest)]"
              >
                <div className="w-12 h-12 rounded-2xl neo-shadow-inner flex items-center justify-center">
                  <span className="material-symbols-outlined text-[var(--color-primary)]">{f.icon}</span>
                </div>
                <p className="text-[var(--text-label-md)] tracking-widest uppercase font-extrabold text-[var(--color-on-surface)]">
                  {f.title}
                </p>
                <p className="text-[var(--text-body-md)] text-[var(--color-on-surface-variant)] leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  )
}
