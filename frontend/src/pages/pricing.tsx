import React, { useState, useMemo } from 'react'
import Link from 'next/link'

interface TruckTierInfo {
  type: 'SMALL' | 'MEDIUM' | 'LARGE'
  name: string
  model: string
  coeff: number
  stable: number
  capacityKg: number
  speedKmh: number
  description: string
  icon: string
}

const TRUCK_TIERS: TruckTierInfo[] = [
  {
    type: 'SMALL',
    name: 'Small Truck',
    model: 'Tata 407',
    coeff: 1.0,
    stable: 55,
    capacityKg: 1500,
    speedKmh: 70,
    description: 'Ideal for medium intercity shipments and standard cargo consignments.',
    icon: 'rv_hookup',
  },
  {
    type: 'MEDIUM',
    name: 'Medium Truck',
    model: 'Eicher 10.90',
    coeff: 1.5,
    stable: 15,
    capacityKg: 5000,
    speedKmh: 65,
    description: 'High capacity transport for heavy equipment and multi-ton wholesale cargo.',
    icon: 'directions_boat',
  },
  {
    type: 'LARGE',
    name: 'Large Truck',
    model: 'Ashok Leyland 2518',
    coeff: 2.0,
    stable: 4,
    capacityKg: 25000,
    speedKmh: 55,
    description: 'Heavy long-haul freight across national interstate corridors.',
    icon: 'airport_shuttle',
  },
]

const POPULAR_ROUTES = [
  { from: 'Mumbai', to: 'Delhi', dist: 1420 },
  { from: 'Delhi', to: 'Bangalore', dist: 2150 },
  { from: 'Mumbai', to: 'Bangalore', dist: 980 },
  { from: 'Kolkata', to: 'Mumbai', dist: 1960 },
  { from: 'Chennai', to: 'Hyderabad', dist: 630 },
  { from: 'Cross-Country (Sample)', to: 'Max Range', dist: 3000 },
]

export default function Pricing(): React.ReactElement {
  const [weight, setWeight] = useState<number>(500)
  const [distance, setDistance] = useState<number>(3000)
  const [selectedTruck, setSelectedTruck] = useState<'SMALL' | 'MEDIUM' | 'LARGE'>('SMALL')

  const calculation = useMemo(() => {
    const tier = TRUCK_TIERS.find(t => t.type === selectedTruck) ?? TRUCK_TIERS[0]
    const clampedDist = Math.max(25, Math.min(4000, distance))
    const norm = (clampedDist - 25) / (4000 - 25)
    const rawPrice = tier.coeff * weight * norm * tier.stable
    const price = Math.round(rawPrice * 100) / 100

    return {
      weight,
      distance: clampedDist,
      coeff: tier.coeff,
      stable: tier.stable,
      norm,
      price,
      formattedPrice: `${price.toFixed(2)}/-`,
    }
  }, [weight, distance, selectedTruck])

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-12">

      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--color-surface-bg)] neo-shadow text-[var(--color-primary)] text-xs font-bold tracking-widest uppercase">
          <span className="material-symbols-outlined text-sm">payments</span>
          Transparent Pricing
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-[var(--color-on-surface)] tracking-tight">
          Live Logistics Rate Engine
        </h1>
        <p className="text-[var(--text-body-md)] text-[var(--color-on-surface-variant)] max-w-2xl mx-auto">
          Calculate instant freight charges normalized between 25 km and 4,000 km across our three specialized truck tiers.
        </p>
      </div>

      <div className="bg-[var(--color-surface-bg)] rounded-3xl neo-shadow p-6 sm:p-10 border border-[var(--color-surface-container-highest)]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          <div className="lg:col-span-7 space-y-8">

            <div>
              <label className="text-[var(--text-label-md)] tracking-widest uppercase font-bold text-[var(--color-on-surface)] mb-3 block">
                1. Select Vehicle Tier
              </label>
              <div className="grid grid-cols-3 gap-3">
                {TRUCK_TIERS.map(truck => {
                  const isSelected = selectedTruck === truck.type
                  return (
                    <button
                      key={truck.type}
                      type="button"
                      onClick={() => setSelectedTruck(truck.type)}
                      className={`p-3.5 rounded-2xl flex flex-col items-center text-center transition-all ${
                        isSelected
                          ? 'neo-shadow-inner bg-[var(--color-surface-bg)] border border-[var(--color-primary)]'
                          : 'neo-shadow bg-[var(--color-surface-bg)] hover:neo-shadow-sm'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-2xl mb-1 ${
                        isSelected ? 'text-[var(--color-primary)]' : 'text-[var(--color-secondary)]'
                      }`}>
                        {truck.icon}
                      </span>
                      <span className="text-xs font-black text-[var(--color-on-surface)] uppercase">{truck.type}</span>
                      <span className="text-[10px] text-[var(--color-on-surface-variant)]">{truck.model}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-[var(--text-label-md)] tracking-widest uppercase font-bold text-[var(--color-on-surface)]">
                  2. Cargo Weight (kg)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="50"
                    max="25000"
                    value={weight}
                    onChange={e => setWeight(Math.max(50, parseFloat(e.target.value) || 50))}
                    className="w-24 px-3 py-1.5 text-right font-mono font-bold text-sm bg-[var(--color-surface-bg)] neo-shadow-inner rounded-lg text-[var(--color-primary)] focus:outline-none"
                  />
                  <span className="text-xs text-[var(--color-secondary)] font-bold">kg</span>
                </div>
              </div>
              <input
                type="range"
                min="50"
                max="25000"
                step="50"
                value={weight}
                onChange={e => setWeight(parseFloat(e.target.value))}
                className="w-full accent-[var(--color-primary)] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[var(--color-secondary)] font-semibold">
                <span>50 kg</span>
                <span>500 kg (Standard)</span>
                <span>5,000 kg</span>
                <span>25,000 kg</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-[var(--text-label-md)] tracking-widest uppercase font-bold text-[var(--color-on-surface)]">
                  3. Travel Distance (km)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="25"
                    max="4000"
                    value={distance}
                    onChange={e => setDistance(Math.max(25, Math.min(4000, parseFloat(e.target.value) || 25)))}
                    className="w-24 px-3 py-1.5 text-right font-mono font-bold text-sm bg-[var(--color-surface-bg)] neo-shadow-inner rounded-lg text-[var(--color-primary)] focus:outline-none"
                  />
                  <span className="text-xs text-secondary font-bold">km</span>
                </div>
              </div>
              <input
                type="range"
                min="25"
                max="4000"
                step="25"
                value={distance}
                onChange={e => setDistance(parseFloat(e.target.value))}
                className="w-full accent-[var(--color-primary)] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[var(--color-secondary)] font-semibold">
                <span>Min: 25 km</span>
                <span>1,000 km</span>
                <span>3,000 km</span>
                <span>Max: 4,000 km</span>
              </div>

              <div className="pt-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-on-surface-variant)] block mb-1.5">
                  Popular Sample Routes:
                </span>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_ROUTES.map(r => (
                    <button
                      key={r.from + r.to}
                      type="button"
                      onClick={() => setDistance(r.dist)}
                      className="px-2.5 py-1 text-xs rounded-lg neo-shadow hover:neo-shadow-sm active:neo-shadow-inner text-[var(--color-secondary)] hover:text-[var(--color-primary)] font-medium transition-all"
                    >
                      {r.from} → {r.to} ({r.dist} km)
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-[var(--color-surface-bg)] neo-shadow-inner rounded-3xl p-6 sm:p-7 space-y-6 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center pb-3 border-b border-[var(--color-surface-container-highest)]">
                <span className="text-xs font-black uppercase tracking-wider text-[var(--color-on-surface-variant)]">
                  Estimated Rate
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                  {selectedTruck} Tier
                </span>
              </div>

              <div className="mt-4 space-y-3 font-mono text-xs">
                <div className="bg-[var(--color-surface-bg)] neo-shadow p-3 rounded-xl space-y-2">
                  <div className="flex justify-between text-[var(--color-on-surface)]">
                    <span>Weight:</span>
                    <span className="font-bold">{calculation.weight} kg</span>
                  </div>
                  <div className="flex justify-between text-[var(--color-on-surface)]">
                    <span>Distance:</span>
                    <span className="font-bold">{calculation.distance} km</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--color-surface-container-highest)] text-center space-y-2">
              <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]">
                Estimated Shipment Total
              </span>
              <div className="text-4xl font-black text-[var(--color-primary)] tracking-tight">
                ₹{calculation.formattedPrice}
              </div>
              <p className="text-[10px] text-[var(--color-secondary)]">
                Includes normalized fuel, distance tiering &amp; truck coefficient
              </p>

              <Link
                href={`/order?weight=${weight}&dist=${distance}&truck=${selectedTruck}`}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-[var(--color-surface-bg)] text-[var(--color-primary)] text-sm tracking-widest uppercase py-4 rounded-xl neo-shadow hover:neo-shadow-sm active:neo-shadow-inner font-extrabold transition-all"
              >
                <span>Book This Shipment</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[var(--color-surface-bg)] rounded-3xl neo-shadow p-6 sm:p-10 border border-[var(--color-surface-container-highest)] space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[var(--color-surface-bg)] neo-shadow flex items-center justify-center text-[var(--color-primary)]">
            <span className="material-symbols-outlined text-2xl">verified_user</span>
          </div>
          <div>
            <h2 className="text-2xl font-black text-[var(--color-on-surface)]">
              Official Return &amp; Cancellation Policy
            </h2>
            <p className="text-xs text-[var(--color-secondary)]">Haulit Transparent Shipping Contract</p>
          </div>
        </div>

        <div className="neo-shadow-inner rounded-2xl p-6 bg-[var(--color-surface-bg)]">
          <p className="text-sm leading-relaxed text-[var(--color-on-surface-variant)] text-justify">
            Haulit Return &amp; Cancellation Policy: Orders can be cancelled or returned under the following strict conditions.
            If a return or cancellation is initiated by the customer, a <strong>50% refund</strong> of the total booking
            payment will be issued. If the cancellation or return occurs due to company or logistics fault (such as vehicle
            breakdown, unexpected operational delays, or dispatch errors), a <strong>90% refund</strong> will be returned.
            Please note that <strong className="text-[var(--color-error)]">no damage payment or compensation is provided by Haulit under any circumstances</strong>.
            By accepting, you agree to these binding terms.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[var(--color-surface-bg)] neo-shadow rounded-2xl p-5 border-t-4 border-[var(--color-primary)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-wider text-[var(--color-on-surface)]">
                Customer Cancellation
              </span>
              <span className="text-lg font-black text-[var(--color-primary)]">50%</span>
            </div>
            <p className="text-xs text-[var(--color-secondary)]">
              When the booking is cancelled by the customer prior to completion, exactly 50% of payment is refunded.
            </p>
          </div>

          <div className="bg-[var(--color-surface-bg)] neo-shadow rounded-2xl p-5 border-t-4 border-emerald-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-wider text-[var(--color-on-surface)]">
                Company Fault
              </span>
              <span className="text-lg font-black text-emerald-600">90%</span>
            </div>
            <p className="text-xs text-[var(--color-secondary)]">
              If cancellation arises from vehicle mechanical breakdown or Haulit operational failures, 90% is returned.
            </p>
          </div>

          <div className="bg-[var(--color-surface-bg)] neo-shadow rounded-2xl p-5 border-t-4 border-red-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-wider text-[var(--color-on-surface)]">
                Cargo Damage Policy
              </span>
              <span className="text-xs font-bold text-[var(--color-error)] uppercase">Zero Liability</span>
            </div>
            <p className="text-xs text-[var(--color-secondary)]">
              Haulit provides strictly no damage payment for cargo. Shippers are advised to procure separate transit insurance.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-[var(--color-surface-bg)] rounded-3xl neo-shadow p-6 sm:p-8 space-y-6">
        <h3 className="text-xl font-black text-[var(--color-on-surface)]">
          Vehicle Tier &amp; Rate Matrix
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {TRUCK_TIERS.map(t => {

            const sampleNorm = (3000 - 25) / (4000 - 25)
            const samplePrice = Math.round(t.coeff * 500 * sampleNorm * t.stable * 100) / 100
            return (
              <div key={t.type} className="bg-[var(--color-surface-bg)] neo-shadow rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black uppercase tracking-widest text-[var(--color-primary)]">
                      {t.type}
                    </span>
                  </div>
                  <h4 className="font-extrabold text-base text-[var(--color-on-surface)]">{t.name}</h4>
                  <p className="text-xs text-[var(--color-on-surface-variant)] mb-3">{t.model}</p>
                  <p className="text-xs text-[var(--color-secondary)] mb-4">{t.description}</p>

                  <div className="space-y-1.5 text-xs text-[var(--color-on-surface)] pt-2 border-t border-[var(--color-surface-container-highest)]">
                    <div className="flex justify-between">
                      <span className="text-[var(--color-secondary)]">Capacity:</span>
                      <span className="font-bold">{t.capacityKg.toLocaleString()} kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--color-secondary)]">Avg Speed:</span>
                      <span className="font-bold">{t.speedKmh} km/h</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[var(--color-surface-container-highest)]">
                  <div className="text-[10px] text-[var(--color-secondary)] uppercase">Sample (500kg @ 3000km):</div>
                  <div className="text-lg font-black text-[var(--color-primary)]">₹{samplePrice.toFixed(2)}/-</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
