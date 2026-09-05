'use client'

import React, { useEffect, useState } from 'react'

const IMAGES: string[] = [
  '/assets/c1.png',
  '/assets/c2.png',
  '/assets/c3.png',
]

export default function HeroCarousel(): React.ReactElement {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setCurrent((prev) => (prev + 1) % IMAGES.length)
    }, 3000)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      className="relative w-full max-w-md aspect-[3/4] rounded-[32px] overflow-hidden bg-[var(--color-surface-bg)] p-2 border-4 border-[var(--color-surface-bg)] group"
      style={{ boxShadow: 'rgba(255, 255, 255, 0.8) -5px -5px 10px, rgba(0, 0, 0, 0.1) 5px 5px 10px' }}
    >
      {/* Images with smooth crossfade */}
      {IMAGES.map((src, idx) => (
        <img
          key={src}
          className={`w-full h-full object-cover rounded-[24px] absolute inset-0 transition-opacity duration-700 p-2 ${
            idx === current ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          src={src}
          alt={`HAULIT transport slide ${idx + 1}`}
        />
      ))}

      {/* Gradient overlay */}
      <div className="absolute inset-2 rounded-[24px] bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

      {/* Neomorphic Dot Indicators */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-3 z-10">
        {IMAGES.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            aria-label={`Go to slide ${idx + 1}`}
            className={`w-3 h-3 rounded-full transition-all duration-300 ${
              idx === current
                ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] scale-110'
                : 'bg-white/50 backdrop-blur-sm shadow-[0_0_4px_rgba(255,255,255,0.4)]'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
