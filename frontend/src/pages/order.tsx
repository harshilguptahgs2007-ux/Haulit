import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { api, type HaulitOrder, type TruckType } from '../lib/api'
import AuthModal from '../components/AuthModal'

type CargoType = 'standard' | 'fragile' | 'hazmat' | 'oversized'

interface CargoOption {
  value: CargoType
  label: string
  icon: string
}

const CARGO_OPTIONS: CargoOption[] = [
  { value: 'standard',  label: 'Standard',  icon: 'inventory_2'    },
  { value: 'fragile',   label: 'Fragile',   icon: 'ac_unit'        },
  { value: 'hazmat',    label: 'Hazmat',    icon: 'warning'        },
  { value: 'oversized', label: 'Oversized', icon: 'local_shipping' },
]

const TRUCK_TIERS = [
  { type: 'MINI' as TruckType,   label: 'Mini Truck',   model: 'Tata Ace',         coeff: 1.0, maxKg: 250   },
  { type: 'SMALL' as TruckType,  label: 'Small Truck',  model: 'Tata 407',         coeff: 1.5, maxKg: 1500  },
  { type: 'MEDIUM' as TruckType, label: 'Medium Truck', model: 'Eicher 10.90',     coeff: 2.0, maxKg: 5000  },
  { type: 'LARGE' as TruckType,  label: 'Large Truck',  model: 'Ashok Leyland',    coeff: 2.5, maxKg: 15000 },
]

interface CityCoords {
  lat: number
  lon: number
}

const CITY_COORDS: Record<string, CityCoords> = {
  mumbai:    { lat: 19.0760, lon: 72.8777 },
  delhi:     { lat: 28.7041, lon: 77.1025 },
  bangalore: { lat: 12.9716, lon: 77.5946 },
  hyderabad: { lat: 17.3850, lon: 78.4867 },
  pune:      { lat: 18.5204, lon: 73.8567 },
  chennai:   { lat: 13.0827, lon: 80.2707 },
  kolkata:   { lat: 22.5726, lon: 88.3639 },
  ahmedabad: { lat: 23.0225, lon: 72.5714 },
  jaipur:    { lat: 26.9124, lon: 75.7873 },
  surat:     { lat: 21.1702, lon: 72.8311 },
}

function resolveCityCoords(city: string): CityCoords {
  const key = city.trim().toLowerCase()
  return CITY_COORDS[key] ?? { lat: 20.5937 + (city.length % 5) * 1.5, lon: 78.9629 + (city.length % 7) * 1.5 }
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371.0
  const dlat = ((lat2 - lat1) * Math.PI) / 180
  const dlon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dlon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function TrackIDModal({ trackId, price, onClose }: { trackId: string; price?: number | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(trackId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(11,28,48,0.45)', backdropFilter: 'blur(8px)' }}
    >
      <div className="bg-[var(--color-surface-bg)] rounded-3xl p-8 sm:p-10 w-full max-w-md mx-4 neo-shadow flex flex-col items-center text-center gap-6 border border-[var(--color-surface-container-highest)]">
        <div className="w-20 h-20 rounded-full bg-[var(--color-surface-bg)] neo-shadow flex items-center justify-center">
          <span className="material-symbols-outlined fill-icon text-4xl text-emerald-500">check_circle</span>
        </div>
        <div>
          <h2 className="text-[var(--text-headline-md)] font-extrabold text-[var(--color-on-surface)] mb-1">
            Order Booked & Paid!
          </h2>
          <p className="text-[var(--text-body-md)] text-[var(--color-on-surface-variant)]">
            Payment successful{price ? ` (₹${price.toFixed(2)}/-)` : ''}. Tracking is live.
          </p>
        </div>
        <div className="w-full bg-[var(--color-surface-bg)] neo-shadow-inner rounded-xl px-6 py-4 flex items-center justify-between gap-4">
          <span className="text-[var(--text-headline-md)] font-black tracking-widest text-[var(--color-primary)] font-mono">
            {trackId}
          </span>
          <button
            onClick={copy}
            className="neo-shadow text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors p-2 rounded-lg"
            title="Copy Track ID"
          >
            <span className="material-symbols-outlined">{copied ? 'check' : 'content_copy'}</span>
          </button>
        </div>
        <p className="text-[var(--text-label-md)] text-[var(--color-on-surface-variant)]">
          Use this ID on the <strong>Track</strong> or <strong>Dashboard</strong> page to monitor your shipment or manage returns.
        </p>
        <div className="w-full flex gap-3">
          <Link
            href={`/track?id=${trackId}`}
            className="flex-1 bg-[var(--color-surface-bg)] text-[var(--color-primary)] text-[var(--text-label-md)] tracking-widest uppercase py-4 rounded-xl neo-shadow hover:neo-shadow-sm active:neo-shadow-inner transition-all duration-200 font-bold flex items-center justify-center gap-2"
          >
            <span>Track Now</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
          <button
            onClick={onClose}
            className="bg-[var(--color-surface-bg)] text-[var(--color-secondary)] text-[var(--text-label-md)] tracking-widest uppercase px-6 py-4 rounded-xl neo-shadow hover:neo-shadow-sm active:neo-shadow-inner transition-all duration-200 font-bold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Order(): React.ReactElement {
  const router = useRouter()
  const [pickup, setPickup]     = useState('Mumbai')
  const [delivery, setDelivery] = useState('Delhi')
  const [weight, setWeight]     = useState('500')
  const [truckType, setTruck]   = useState<TruckType>('SMALL')
  const [cargo, setCargo]       = useState<CargoType>('standard')
  const [policyAgreed, setPolicyAgreed] = useState(true)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [createdOrder, setCreatedOrder] = useState<HaulitOrder | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [userName, setUserName] = useState<string | null>(null)

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('haulit_user_name') : null
    if (stored) setUserName(stored)
  }, [])

  // Initialize from query parameters if available
  useEffect(() => {
    if (router.isReady) {
      if (router.query.weight) setWeight(String(router.query.weight))
      if (router.query.truck) {
        const t = String(router.query.truck).toUpperCase() as TruckType
        if (['MINI', 'SMALL', 'MEDIUM', 'LARGE'].includes(t)) {
          setTruck(t)
        }
      }
    }
  }, [router.isReady, router.query])

  // Compute distance from coordinates
  const distanceKm = useMemo(() => {
    if (router.isReady && router.query.dist) {
      const qDist = parseFloat(String(router.query.dist))
      if (!isNaN(qDist) && qDist > 0) return Math.min(4000, Math.max(25, qDist))
    }
    const c1 = resolveCityCoords(pickup)
    const c2 = resolveCityCoords(delivery)
    const d = haversineKm(c1.lat, c1.lon, c2.lat, c2.lon)
    return Math.min(4000, Math.max(25, Math.round(d)))
  }, [pickup, delivery, router.isReady, router.query.dist])

  // Live Pricing Calculation
  // norm = (dist - 25) / (4000 - 25)
  // stable = 130
  // price = round(coeff * w * norm * stable, 2)
  const priceDetails = useMemo(() => {
    const w = parseFloat(weight) || 0
    const coeff = TRUCK_TIERS.find(t => t.type === truckType)?.coeff ?? 1.5
    const clampedDist = Math.max(25, Math.min(4000, distanceKm))
    const norm = (clampedDist - 25) / (4000 - 25)
    const stable = 130
    const rawPrice = coeff * w * norm * stable
    const price = Math.round(rawPrice * 100) / 100

    return {
      weight: w,
      distance: clampedDist,
      norm,
      stable,
      coeff,
      price,
      formattedPrice: `${price.toFixed(2)}/-`,
    }
  }, [weight, truckType, distanceKm])

  // Auto-suggest truck based on weight if user hasn't explicitly selected
  function handleWeightChange(newWeight: string) {
    setWeight(newWeight)
    const w = parseFloat(newWeight)
    if (!isNaN(w) && w > 0) {
      if (w <= 250) setTruck('MINI')
      else if (w <= 1500) setTruck('SMALL')
      else if (w <= 5000) setTruck('MEDIUM')
      else setTruck('LARGE')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!pickup.trim() || !delivery.trim() || !weight) {
      setError('Please fill in all required fields.')
      return
    }
    if (!policyAgreed) {
      setError('Please agree to the Haulit Return Policy terms before payment.')
      return
    }

    const pickupCoords   = resolveCityCoords(pickup)
    const deliveryCoords = resolveCityCoords(delivery)

    setLoading(true)
    try {
      const res = await api.orders.create({
        pickup,
        pickup_lat:   pickupCoords.lat,
        pickup_lon:   pickupCoords.lon,
        delivery,
        delivery_lat: deliveryCoords.lat,
        delivery_lon: deliveryCoords.lon,
        weight_kg:    parseFloat(weight),
        cargo_type:   cargo,
        truck_type:   truckType,
        distance_km:  distanceKm,
        payment_status: 'paid',
      })
      setCreatedOrder(res.order)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to place order'
      setError(msg)
      if (msg.includes('401') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('token')) {
        setShowAuthModal(true)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {createdOrder && (
        <TrackIDModal
          trackId={createdOrder.track_id}
          price={createdOrder.price}
          onClose={() => setCreatedOrder(null)}
        />
      )}

      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={(_token, name) => {
            setUserName(name)
            setShowAuthModal(false)
            setError('')
          }}
        />
      )}

      <div className="bg-[var(--color-surface-bg)] text-[var(--color-on-background)] antialiased min-h-screen flex flex-col font-sans">
        <main className="flex-grow max-w-[var(--spacing-container-max-width)] mx-auto px-[var(--spacing-gutter)] py-10 w-full flex flex-col lg:flex-row gap-10">

          {/* Form Column */}
          <div className="flex-1 w-full max-w-2xl mx-auto lg:mx-0 space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-surface-bg)] neo-shadow text-[var(--color-primary)] text-xs font-bold tracking-widest uppercase mb-2">
                  <span className="material-symbols-outlined text-sm">local_shipping</span>
                  Instant Booking & Payment
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--color-on-surface)] leading-tight">
                  Create & Pay for Order
                </h1>
              </div>
              {userName ? (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full neo-shadow bg-[var(--color-surface-bg)] text-xs">
                  <span className="material-symbols-outlined text-sm text-[var(--color-primary)]">account_circle</span>
                  <span className="font-semibold text-[var(--color-on-surface)]">{userName}</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAuthModal(true)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full neo-shadow text-xs font-bold text-[var(--color-primary)] hover:neo-shadow-sm transition-all"
                >
                  <span className="material-symbols-outlined text-sm">login</span>
                  <span>Login</span>
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 bg-[var(--color-surface-bg)] p-6 sm:p-8 rounded-3xl neo-shadow border border-[var(--color-surface-container-highest)]">

              {/* Locations */}
              <div className="space-y-4 relative">
                <div className="relative z-10 flex gap-4 items-start">
                  <div className="w-11 h-11 rounded-full bg-[var(--color-surface-bg)] flex items-center justify-center shrink-0 neo-shadow text-[var(--color-secondary)]">
                    <span className="material-symbols-outlined text-lg">my_location</span>
                  </div>
                  <div className="flex-1">
                    <label className="block text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-1.5 font-bold">
                      Pickup City / Hub
                    </label>
                    <input
                      type="text"
                      value={pickup}
                      onChange={e => setPickup(e.target.value)}
                      placeholder="e.g. Mumbai"
                      required
                      className="w-full bg-[var(--color-surface-bg)] border-none neo-shadow-inner focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 rounded-xl px-4 py-3 text-sm text-[var(--color-on-surface)] transition-all"
                    />
                  </div>
                </div>

                <div className="relative z-10 flex gap-4 items-start">
                  <div className="w-11 h-11 rounded-full bg-[var(--color-surface-bg)] flex items-center justify-center shrink-0 neo-shadow text-[var(--color-primary)]">
                    <span className="material-symbols-outlined fill-icon text-lg">location_on</span>
                  </div>
                  <div className="flex-1">
                    <label className="block text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-1.5 font-bold">
                      Delivery City / Destination
                    </label>
                    <input
                      type="text"
                      value={delivery}
                      onChange={e => setDelivery(e.target.value)}
                      placeholder="e.g. Delhi"
                      required
                      className="w-full bg-[var(--color-surface-bg)] border-none neo-shadow-inner focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 rounded-xl px-4 py-3 text-sm text-[var(--color-on-surface)] transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Vehicle Tier Selection */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <label className="block text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] font-bold">
                    Vehicle Type & Coefficient
                  </label>
                  <Link href="/pricing" className="text-xs text-[var(--color-primary)] font-bold hover:underline">
                    View Pricing Matrix
                  </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {TRUCK_TIERS.map(t => {
                    const isSelected = truckType === t.type
                    return (
                      <button
                        key={t.type}
                        type="button"
                        onClick={() => setTruck(t.type)}
                        className={`p-3 rounded-2xl flex flex-col items-center text-center transition-all ${
                          isSelected
                            ? 'neo-shadow-inner border border-[var(--color-primary)] bg-[var(--color-surface-bg)]'
                            : 'neo-shadow bg-[var(--color-surface-bg)] hover:neo-shadow-sm'
                        }`}
                      >
                        <span className="text-xs font-black text-[var(--color-on-surface)]">{t.type}</span>
                        <span className="text-[10px] text-[var(--color-secondary)]">{t.model}</span>
                        <span className={`mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isSelected ? 'bg-[var(--color-primary)] text-white' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {t.coeff}x
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Weight & Distance */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-1.5 font-bold">
                    Cargo Weight (KG)
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[var(--color-secondary)]">weight</span>
                    <input
                      type="number"
                      value={weight}
                      onChange={e => handleWeightChange(e.target.value)}
                      placeholder="e.g. 500"
                      min="1"
                      step="1"
                      required
                      className="w-full bg-[var(--color-surface-bg)] border-none neo-shadow-inner focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 rounded-xl pl-10 pr-4 py-3 text-sm font-mono text-[var(--color-on-surface)] font-bold transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-1.5 font-bold">
                    Calculated Distance
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[var(--color-secondary)]">route</span>
                    <div className="w-full bg-[var(--color-surface-bg)] neo-shadow-inner rounded-xl pl-10 pr-4 py-3 text-sm font-mono text-[var(--color-primary)] font-bold">
                      {distanceKm} km
                    </div>
                  </div>
                </div>
              </div>

              {/* Cargo Type */}
              <div className="space-y-2">
                <label className="block text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] font-bold">
                  Cargo Sensitivity
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {CARGO_OPTIONS.map(opt => (
                    <label key={opt.value} className="cursor-pointer">
                      <input
                        type="radio"
                        name="cargo_type_neo"
                        value={opt.value}
                        checked={cargo === opt.value}
                        onChange={() => setCargo(opt.value)}
                        className="sr-only"
                      />
                      <div className={`p-3 bg-[var(--color-surface-bg)] rounded-xl text-center transition-all ${
                        cargo === opt.value
                          ? 'neo-shadow-inner text-[var(--color-primary)] font-semibold'
                          : 'neo-shadow text-[var(--color-secondary)]'
                      }`}>
                        <span className="material-symbols-outlined text-lg mb-1 block">{opt.icon}</span>
                        <span className="text-[10px] tracking-widest uppercase font-bold block">{opt.label}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Return Policy Agreement Checkbox */}
              <div className="neo-shadow-inner rounded-2xl p-4 bg-[var(--color-surface-bg)] space-y-2">
                <div className="flex items-start gap-2.5">
                  <input
                    id="order-policy-agree"
                    type="checkbox"
                    checked={policyAgreed}
                    onChange={e => setPolicyAgreed(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded accent-[var(--color-primary)] cursor-pointer"
                  />
                  <label htmlFor="order-policy-agree" className="text-xs text-[var(--color-on-surface)] cursor-pointer leading-relaxed">
                    I agree to the <strong>Haulit Return & Cancellation Policy</strong>:
                    if customer cancels, <strong>50% refund</strong>; if company&apos;s fault, <strong>90% return</strong>;
                    and strictly <strong>no damage payment from Haulit</strong>.
                  </label>
                </div>
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-[var(--color-error)] text-xs font-semibold flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm shrink-0">error</span>
                    <span>{error}</span>
                  </div>
                  {(error.includes('401') || error.toLowerCase().includes('log in') || error.toLowerCase().includes('token') || error.toLowerCase().includes('unauthorized')) && (
                    <button
                      type="button"
                      onClick={() => setShowAuthModal(true)}
                      className="underline font-bold text-xs shrink-0 hover:text-red-800"
                    >
                      Login Now
                    </button>
                  )}
                </div>
              )}

              {/* Submit / Pay Button */}
              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[var(--color-surface-bg)] text-[var(--color-primary)] text-sm tracking-widest uppercase py-4 rounded-xl neo-shadow hover:neo-shadow-sm active:neo-shadow-inner transition-all duration-200 flex justify-center items-center gap-2 font-black disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-base">{loading ? 'sync' : 'payment'}</span>
                  <span>{loading ? 'Processing…' : `Pay ₹${priceDetails.formattedPrice} & Book Now`}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Pricing & Dispatch Summary Sidebar */}
          <div className="flex-1 w-full lg:max-w-md space-y-6">
            {/* Live Pricing Breakdown Card */}
            <div className="bg-[var(--color-surface-bg)] rounded-3xl p-6 sm:p-7 neo-shadow border border-[var(--color-surface-container-highest)] space-y-5">
              <div className="flex items-center justify-between border-b border-[var(--color-surface-container-highest)] pb-3">
                <span className="text-xs font-black tracking-widest uppercase text-[var(--color-on-surface)]">
                  Live Rate Calculation
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Fixed Stable: 130
                </span>
              </div>

              <div className="neo-shadow-inner rounded-2xl p-4 font-mono text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-[var(--color-secondary)]">Weight (w):</span>
                  <span className="font-bold">{priceDetails.weight} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-secondary)]">Distance (dist):</span>
                  <span className="font-bold">{priceDetails.distance} km</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-secondary)]">Truck Tier ({truckType}):</span>
                  <span className="font-bold">coeff = {priceDetails.coeff}</span>
                </div>
                <div className="flex justify-between border-t border-[var(--color-surface-container-highest)] pt-2 text-sm font-sans font-bold">
                  <span>Total Amount:</span>
                  <span className="text-xl font-black text-[var(--color-primary)] font-mono">
                    ₹{priceDetails.formattedPrice}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-[var(--color-on-surface-variant)] leading-normal bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                Formula: <code className="font-bold font-mono">round(coeff * w * norm * 130, 2)</code>
              </div>
            </div>

            {/* Return Policy Quick Summary Card */}
            <div className="bg-[var(--color-surface-bg)] rounded-3xl p-6 neo-shadow border border-[var(--color-surface-container-highest)] space-y-3">
              <div className="flex items-center gap-2 text-[var(--color-primary)]">
                <span className="material-symbols-outlined text-lg">shield</span>
                <span className="text-xs font-black tracking-widest uppercase text-[var(--color-on-surface)]">
                  Return & Cancellation Terms
                </span>
              </div>
              <ul className="text-xs space-y-2 text-[var(--color-on-surface-variant)]">
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[var(--color-primary)]">check</span>
                  <span><strong>Customer Cancels:</strong> 50% payment refunded.</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-emerald-600">check</span>
                  <span><strong>Company Fault:</strong> 90% payment returned.</span>
                </li>
                <li className="flex items-center gap-2 text-[var(--color-error)]">
                  <span className="material-symbols-outlined text-sm">block</span>
                  <span className="font-semibold">No damage payment from Haulit.</span>
                </li>
              </ul>
            </div>
          </div>

        </main>
      </div>
    </>
  )
}
