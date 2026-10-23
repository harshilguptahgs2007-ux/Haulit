import React, { useState, useEffect, useMemo, useRef } from 'react'
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

// SMALL coeff=1 stable=55 | MEDIUM coeff=1.5 stable=15 | LARGE coeff=2 stable=4
const TRUCK_TIERS = [
  { type: 'SMALL' as TruckType,  label: 'Small',  coeff: 1.0, stable: 55,  maxKg: 1500  },
  { type: 'MEDIUM' as TruckType, label: 'Medium', coeff: 1.5, stable: 15,  maxKg: 5000  },
  { type: 'LARGE' as TruckType,  label: 'Large',  coeff: 2.0, stable: 4,   maxKg: 25000 },
]

const DEFAULT_CITIES = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad', 'Pune']

const KNOWN_COORDINATES: Record<string, { lat: number; lon: number }> = {
  mumbai: { lat: 19.0760, lon: 72.8777 },
  delhi: { lat: 28.7041, lon: 77.1025 },
  bangalore: { lat: 12.9716, lon: 77.5946 },
  bengaluru: { lat: 12.9716, lon: 77.5946 },
  chennai: { lat: 13.0827, lon: 80.2707 },
  kolkata: { lat: 22.5726, lon: 88.3639 },
  hyderabad: { lat: 17.3850, lon: 78.4867 },
  pune: { lat: 18.5204, lon: 73.8567 },
  ahmedabad: { lat: 23.0225, lon: 72.5714 },
  jaipur: { lat: 26.9124, lon: 75.7873 },
  surat: { lat: 21.1702, lon: 72.8311 },
  lucknow: { lat: 26.8467, lon: 80.9462 },
  kanpur: { lat: 26.4499, lon: 80.3319 },
  nagpur: { lat: 21.1458, lon: 79.0882 },
  indore: { lat: 22.7196, lon: 75.8577 },
  patna: { lat: 25.5941, lon: 85.1376 },
  bhopal: { lat: 23.2599, lon: 77.4126 },
  vadodara: { lat: 22.3072, lon: 73.1812 },
  coimbatore: { lat: 11.0168, lon: 76.9558 },
  kochi: { lat: 9.9312, lon: 76.2673 },
  chandigarh: { lat: 30.7333, lon: 76.7794 },
}

function getCityCoords(cityName: string, fallbackLat: number = 20.5937, fallbackLon: number = 78.9629): { lat: number; lon: number } {
  const key = (cityName || '').trim().toLowerCase()
  if (KNOWN_COORDINATES[key]) {
    return KNOWN_COORDINATES[key]
  }
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i)
    hash |= 0
  }
  const latOffset = ((Math.abs(hash) % 1000) / 1000) * 10 - 5
  const lonOffset = (((Math.abs(hash) >> 4) % 1000) / 1000) * 10 - 5
  return {
    lat: Math.round((fallbackLat + latOffset) * 10000) / 10000,
    lon: Math.round((fallbackLon + lonOffset) * 10000) / 10000,
  }
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
            Order Booked &amp; Paid!
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

  // Dropdown options lists
  const [pickupOptions, setPickupOptions] = useState<string[]>(DEFAULT_CITIES)
  const [deliveryOptions, setDeliveryOptions] = useState<string[]>(DEFAULT_CITIES)

  // Current From & To values (editable input where user can type directly or select from dropdown)
  const [pickupCity, setPickupCity]     = useState<string>('Mumbai')
  const [deliveryCity, setDeliveryCity] = useState<string>('Delhi')

  // Dropdown open states
  const [pickupOpen, setPickupOpen]     = useState(false)
  const [deliveryOpen, setDeliveryOpen] = useState(false)

  const [weight, setWeight]             = useState('500')
  // User-editable distance (typed as string, auto-updated when cities change, clamped between 25 and 4000)
  const [distance, setDistance]         = useState<string>('1420')

  const [truckType, setTruck]           = useState<TruckType>('SMALL')
  const [cargo, setCargo]               = useState<CargoType>('standard')
  const [policyAgreed, setPolicyAgreed] = useState(true)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [createdOrder, setCreatedOrder] = useState<HaulitOrder | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authSubtitle, setAuthSubtitle]   = useState('')
  const pendingOrderRef                   = useRef<boolean>(false)
  const [userName, setUserName]         = useState<string | null>(null)
  const [matchedTrucks, setMatchedTrucks] = useState<any[]>([])
  const [matchingLoading, setMatchingLoading] = useState(false)

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('haulit_user_name') : null
    if (stored) setUserName(stored)

    // Load persisted dropdown options if available
    try {
      const savedPickup = localStorage.getItem('haulit_pickup_options')
      if (savedPickup) {
        const parsed = JSON.parse(savedPickup)
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = Array.from(new Set([...DEFAULT_CITIES, ...parsed]))
          setPickupOptions(merged)
        }
      }
      const savedDelivery = localStorage.getItem('haulit_delivery_options')
      if (savedDelivery) {
        const parsed = JSON.parse(savedDelivery)
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = Array.from(new Set([...DEFAULT_CITIES, ...parsed]))
          setDeliveryOptions(merged)
        }
      }
    } catch {}
  }, [])

  // Initialize from query parameters if available
  useEffect(() => {
    if (router.isReady) {
      if (router.query.weight) setWeight(String(router.query.weight))
      if (router.query.truck) {
        const t = String(router.query.truck).toUpperCase() as TruckType
        if (['SMALL', 'MEDIUM', 'LARGE'].includes(t)) {
          setTruck(t)
        }
      }
      if (router.query.dist) {
        const qDist = parseFloat(String(router.query.dist))
        if (!isNaN(qDist) && qDist > 0) {
          setDistance(String(Math.round(Math.min(4000, Math.max(25, qDist)))))
        }
      }
    }
  }, [router.isReady, router.query])

  // Auto-update distance when pickup or delivery city changes
  useEffect(() => {
    if (pickupCity && deliveryCity) {
      const c1 = getCityCoords(pickupCity)
      const c2 = getCityCoords(deliveryCity)
      const d = haversineKm(c1.lat, c1.lon, c2.lat, c2.lon)
      const calculated = Math.round(Math.min(4000, Math.max(25, d)))
      setDistance(String(calculated))
    }
  }, [pickupCity, deliveryCity])

  // Fetch available matching trucks based on pickup location and weight (enforces partner availability)
  useEffect(() => {
    const w = parseFloat(weight)
    if (isNaN(w) || w <= 0 || !pickupCity) {
      setMatchedTrucks([])
      return
    }
    const coords = getCityCoords(pickupCity)
    let active = true
    setMatchingLoading(true)
    api.vehicles
      .recommend({ weight_kg: w, pickup_lat: coords.lat, pickup_lon: coords.lon, limit: 3 })
      .then(res => {
        if (active) setMatchedTrucks(res.recommendations || [])
      })
      .catch(() => {
        if (active) setMatchedTrucks([])
      })
      .finally(() => {
        if (active) setMatchingLoading(false)
      })
    return () => {
      active = false
    }
  }, [weight, pickupCity, truckType])

  // Live Pricing Calculation with Fragile & Hazmat Sensitivity charges:
  // Base formula: rawBasePrice = tier.coeff * w * norm * tier.stable
  // Fragile: Padding & Cushioning Charges = 0.2 * rawBasePrice
  // Hazmat: Special Handling Charges = 0.2 * rawBasePrice
  // Total Amount = Base Calculation + Extra Charge
  const priceDetails = useMemo(() => {
    const w = parseFloat(weight) || 0
    const tier = TRUCK_TIERS.find(t => t.type === truckType) ?? TRUCK_TIERS[0]
    const rawDist = parseFloat(distance) || 25
    const clampedDist = Math.max(25, Math.min(4000, rawDist))
    const norm = (clampedDist - 25) / (4000 - 25)
    const rawBasePrice = tier.coeff * w * norm * tier.stable
    const basePrice = Math.round(rawBasePrice * 100) / 100

    let extraCharge = 0
    if (cargo === 'fragile') {
      extraCharge = Math.round(rawBasePrice * 0.2 * 100) / 100
    } else if (cargo === 'hazmat') {
      extraCharge = Math.round(rawBasePrice * 0.2 * 100) / 100
    }

    const totalPrice = Math.round((basePrice + extraCharge) * 100) / 100

    return {
      weight: w,
      distance: clampedDist,
      norm,
      coeff: tier.coeff,
      stable: tier.stable,
      basePrice,
      extraCharge,
      price: totalPrice,
      formattedPrice: `${totalPrice.toFixed(2)}/-`,
      formattedBasePrice: `${basePrice.toFixed(2)}/-`,
    }
  }, [weight, truckType, distance, cargo])

  // Auto-suggest truck based on weight
  function handleWeightChange(newWeight: string) {
    setWeight(newWeight)
    const w = parseFloat(newWeight)
    if (!isNaN(w) && w > 0) {
      if (w <= 1500) setTruck('SMALL')
      else if (w <= 5000) setTruck('MEDIUM')
      else setTruck('LARGE')
    }
  }

  // Handle distance onBlur to ensure it stays in bounds [25, 4000]
  function handleDistanceBlur() {
    const v = parseFloat(distance)
    if (isNaN(v) || v < 25) {
      setDistance('25')
    } else if (v > 4000) {
      setDistance('4000')
    } else {
      setDistance(String(Math.round(v)))
    }
  }

  // Auto-store newly typed location into options and persistence
  function savePickupOption(city: string) {
    const trimmed = city.trim()
    if (!trimmed) return
    if (!pickupOptions.some(o => o.toLowerCase() === trimmed.toLowerCase())) {
      const next = [...pickupOptions, trimmed]
      setPickupOptions(next)
      try { localStorage.setItem('haulit_pickup_options', JSON.stringify(next)) } catch {}
    }
  }

  function saveDeliveryOption(city: string) {
    const trimmed = city.trim()
    if (!trimmed) return
    if (!deliveryOptions.some(o => o.toLowerCase() === trimmed.toLowerCase())) {
      const next = [...deliveryOptions, trimmed]
      setDeliveryOptions(next)
      try { localStorage.setItem('haulit_delivery_options', JSON.stringify(next)) } catch {}
    }
  }

  async function executeBooking() {
    setError('')
    const finalPickup = pickupCity.trim()
    const finalDelivery = deliveryCity.trim()
    const w = parseFloat(weight)
    const distVal = parseFloat(distance)

    const pickupCoords   = getCityCoords(finalPickup)
    const deliveryCoords = getCityCoords(finalDelivery)

    setLoading(true)
    try {
      const res = await api.orders.create({
        pickup: finalPickup,
        pickup_lat:   pickupCoords.lat,
        pickup_lon:   pickupCoords.lon,
        delivery: finalDelivery,
        delivery_lat: deliveryCoords.lat,
        delivery_lon: deliveryCoords.lon,
        weight_kg:    w,
        cargo_type:   cargo,
        truck_type:   truckType,
        distance_km:  distVal,
        payment_status: 'paid',
      })
      setCreatedOrder(res.order)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to place order'
      setError(msg)
      if (msg.includes('401') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('token')) {
        pendingOrderRef.current = true
        setAuthSubtitle('Session expired. Please log in to complete payment and get your Track ID.')
        setShowAuthModal(true)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const finalPickup = pickupCity.trim()
    const finalDelivery = deliveryCity.trim()

    savePickupOption(finalPickup)
    saveDeliveryOption(finalDelivery)

    const w = parseFloat(weight)
    if (!finalPickup || !finalDelivery || isNaN(w)) {
      setError('Please fill in all required fields.')
      return
    }
    if (w < 50 || w > 25000) {
      setError('Weight must be between 50 kg and 25,000 kg.')
      return
    }

    const distVal = parseFloat(distance)
    if (isNaN(distVal) || distVal < 25 || distVal > 4000) {
      setError('Distance must be between 25 km and 4,000 km.')
      return
    }

    if (!policyAgreed) {
      setError('Please agree to the Haulit Return Policy terms before payment.')
      return
    }

    // Check login state:
    // If logged in -> proceed with booking and display Track ID modal
    // If not logged in -> prompt user to log in first, then automatically complete booking and show Track ID modal
    const token = typeof window !== 'undefined' ? localStorage.getItem('haulit_token') : null
    if (!token) {
      pendingOrderRef.current = true
      setAuthSubtitle('Please log in or register to complete payment and generate your Track ID')
      setShowAuthModal(true)
      return
    }

    await executeBooking()
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
          subtitle={authSubtitle || undefined}
          onClose={() => {
            setShowAuthModal(false)
            pendingOrderRef.current = false
            setAuthSubtitle('')
          }}
          onSuccess={(_token, name) => {
            setUserName(name)
            setShowAuthModal(false)
            setAuthSubtitle('')
            setError('')
            if (pendingOrderRef.current) {
              pendingOrderRef.current = false
              executeBooking()
            }
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
                  Instant Booking &amp; Payment
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--color-on-surface)] leading-tight">
                  Create &amp; Pay for Order
                </h1>
              </div>
              {userName ? (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full neo-shadow bg-[var(--color-surface-bg)] text-xs">
                  <span className="material-symbols-outlined text-sm text-[var(--color-primary)]">account_circle</span>
                  <span className="font-semibold text-[var(--color-on-surface)]">{userName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        localStorage.removeItem('haulit_token')
                        localStorage.removeItem('haulit_user_name')
                      }
                      setUserName(null)
                    }}
                    title="Log out"
                    className="ml-1 text-[var(--color-secondary)] hover:text-red-500 transition-colors flex items-center"
                  >
                    <span className="material-symbols-outlined text-xs">logout</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    pendingOrderRef.current = false
                    setAuthSubtitle('Log in to your Haulit account')
                    setShowAuthModal(true)
                  }}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full neo-shadow text-xs font-bold text-[var(--color-primary)] hover:neo-shadow-sm transition-all"
                >
                  <span className="material-symbols-outlined text-sm">login</span>
                  <span>Login</span>
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 bg-[var(--color-surface-bg)] p-6 sm:p-8 rounded-3xl neo-shadow border border-[var(--color-surface-container-highest)]">

              {/* Single Combobox Input for From & To: user can write directly or select from dropdown */}
              <div className="space-y-4">
                
                {/* Pickup Location (From) */}
                <div className="relative z-30 space-y-1.5">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-surface-bg)] flex items-center justify-center shrink-0 neo-shadow text-[var(--color-secondary)]">
                      <span className="material-symbols-outlined text-base">my_location</span>
                    </div>
                    <label className="block text-xs font-black tracking-widest uppercase text-[var(--color-on-surface)]">
                      From (Pickup Location)
                    </label>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      list="pickup-cities-list"
                      value={pickupCity}
                      onChange={e => setPickupCity(e.target.value)}
                      onFocus={() => setPickupOpen(true)}
                      onBlur={() => {
                        setTimeout(() => {
                          setPickupOpen(false)
                          savePickupOption(pickupCity)
                        }, 250)
                      }}
                      placeholder="Type destination or choose from dropdown..."
                      required
                      className="w-full bg-[var(--color-surface-bg)] border-none neo-shadow-inner focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 rounded-xl pl-4 pr-10 py-3 text-sm text-[var(--color-on-surface)] transition-all font-semibold"
                    />
                    <datalist id="pickup-cities-list">
                      {pickupOptions.map(opt => (
                        <option key={opt} value={opt} />
                      ))}
                    </datalist>

                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setPickupOpen(prev => !prev)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors"
                      title="Choose from dropdown window"
                    >
                      <span className="material-symbols-outlined text-xl">
                        {pickupOpen ? 'arrow_drop_up' : 'arrow_drop_down'}
                      </span>
                    </button>

                    {pickupOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1.5 bg-[var(--color-surface-bg)] rounded-2xl neo-shadow border border-[var(--color-surface-container-highest)] max-h-52 overflow-y-auto z-50 py-1">
                        {pickupOptions.map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onMouseDown={() => {
                              setPickupCity(opt)
                              setPickupOpen(false)
                            }}
                            className={`w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] transition-colors flex items-center justify-between ${
                              pickupCity === opt ? 'text-[var(--color-primary)] font-bold bg-[var(--color-primary)]/5' : 'text-[var(--color-on-surface)]'
                            }`}
                          >
                            <span>{opt}</span>
                            {pickupCity === opt && (
                              <span className="material-symbols-outlined text-xs">check</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Delivery Location (To) */}
                <div className="relative z-20 space-y-1.5">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-surface-bg)] flex items-center justify-center shrink-0 neo-shadow text-[var(--color-primary)]">
                      <span className="material-symbols-outlined fill-icon text-base">location_on</span>
                    </div>
                    <label className="block text-xs font-black tracking-widest uppercase text-[var(--color-on-surface)]">
                      To (Delivery / Drop Place)
                    </label>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      list="delivery-cities-list"
                      value={deliveryCity}
                      onChange={e => setDeliveryCity(e.target.value)}
                      onFocus={() => setDeliveryOpen(true)}
                      onBlur={() => {
                        setTimeout(() => {
                          setDeliveryOpen(false)
                          saveDeliveryOption(deliveryCity)
                        }, 250)
                      }}
                      placeholder="Type drop place or choose from dropdown..."
                      required
                      className="w-full bg-[var(--color-surface-bg)] border-none neo-shadow-inner focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 rounded-xl pl-4 pr-10 py-3 text-sm text-[var(--color-on-surface)] transition-all font-semibold"
                    />
                    <datalist id="delivery-cities-list">
                      {deliveryOptions.map(opt => (
                        <option key={opt} value={opt} />
                      ))}
                    </datalist>

                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setDeliveryOpen(prev => !prev)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors"
                      title="Choose from dropdown window"
                    >
                      <span className="material-symbols-outlined text-xl">
                        {deliveryOpen ? 'arrow_drop_up' : 'arrow_drop_down'}
                      </span>
                    </button>

                    {deliveryOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1.5 bg-[var(--color-surface-bg)] rounded-2xl neo-shadow border border-[var(--color-surface-container-highest)] max-h-52 overflow-y-auto z-50 py-1">
                        {deliveryOptions.map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onMouseDown={() => {
                              setDeliveryCity(opt)
                              setDeliveryOpen(false)
                            }}
                            className={`w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] transition-colors flex items-center justify-between ${
                              deliveryCity === opt ? 'text-[var(--color-primary)] font-bold bg-[var(--color-primary)]/5' : 'text-[var(--color-on-surface)]'
                            }`}
                          >
                            <span>{opt}</span>
                            {deliveryCity === opt && (
                              <span className="material-symbols-outlined text-xs">check</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Vehicle Tier Selection - ONLY shows SMALL, MEDIUM, LARGE (no coeff, no models) */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <label className="block text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] font-bold">
                    Truck Tier
                  </label>
                  <Link href="/pricing" className="text-xs text-[var(--color-primary)] font-bold hover:underline">
                    View Pricing Matrix
                  </Link>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {TRUCK_TIERS.map(t => {
                    const isSelected = truckType === t.type
                    return (
                      <button
                        key={t.type}
                        type="button"
                        onClick={() => setTruck(t.type)}
                        className={`py-3.5 px-3 rounded-2xl flex items-center justify-center text-center transition-all ${
                          isSelected
                            ? 'neo-shadow-inner border-2 border-[var(--color-primary)] bg-[var(--color-surface-bg)] font-black text-[var(--color-primary)]'
                            : 'neo-shadow bg-[var(--color-surface-bg)] hover:neo-shadow-sm font-bold text-[var(--color-on-surface)]'
                        }`}
                      >
                        <span className="text-sm tracking-wider uppercase">{t.type}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Weight & Distance */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Weight */}
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
                      min="50"
                      max="25000"
                      step="1"
                      required
                      className="w-full bg-[var(--color-surface-bg)] border-none neo-shadow-inner focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 rounded-xl pl-10 pr-4 py-3 text-sm font-mono text-[var(--color-on-surface)] font-bold transition-all"
                    />
                  </div>
                  <p className="text-[10px] text-[var(--color-secondary)] mt-1">Min: 50 kg &nbsp;|&nbsp; Max: 25,000 kg</p>
                </div>

                {/* Editable Distance (user can type freely, limit 25 to 4000, auto-updated by route) */}
                <div>
                  <label className="block text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-1.5 font-bold">
                    Distance (KM)
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[var(--color-secondary)]">route</span>
                    <input
                      type="number"
                      value={distance}
                      onChange={e => setDistance(e.target.value)}
                      onBlur={handleDistanceBlur}
                      min="25"
                      max="4000"
                      step="1"
                      required
                      className="w-full bg-[var(--color-surface-bg)] border-none neo-shadow-inner focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 rounded-xl pl-10 pr-4 py-3 text-sm font-mono text-[var(--color-primary)] font-bold transition-all"
                    />
                  </div>
                  <p className="text-[10px] text-[var(--color-secondary)] mt-1">Min: 25 km &nbsp;|&nbsp; Max: 4,000 km (auto-updated, editable)</p>
                </div>
              </div>

              {/* Cargo Type / Cargo Sensitivity */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="block text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] font-bold">
                    Cargo Sensitivity
                  </label>
                </div>

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
                    I agree to the <strong>Haulit Return &amp; Cancellation Policy</strong>:
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
                  className="w-full bg-[var(--color-surface-bg)] text-[var(--color-primary)] text-sm tracking-widest uppercase py-4 rounded-xl neo-shadow hover:neo-shadow-sm active:neo-shadow-inner transition-all duration-200 flex justify-center items-center gap-2 font-black disabled:opacity-50 cursor-pointer"
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
                  {truckType}
                </span>
              </div>

              <div className="neo-shadow-inner rounded-2xl p-4 font-mono text-xs space-y-2.5">
                <div className="flex justify-between">
                  <span className="text-[var(--color-secondary)]">From:</span>
                  <span className="font-bold text-[var(--color-on-surface)]">{pickupCity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-secondary)]">To:</span>
                  <span className="font-bold text-[var(--color-on-surface)]">{deliveryCity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-secondary)]">Weight (w):</span>
                  <span className="font-bold">{priceDetails.weight} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-secondary)]">Distance:</span>
                  <span className="font-bold">{priceDetails.distance} km</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-secondary)]">Truck Tier:</span>
                  <span className="font-bold">{truckType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-secondary)]">Cargo Class:</span>
                  <span className="font-bold uppercase">{cargo}</span>
                </div>

                <div className="flex justify-between border-t border-[var(--color-surface-container-highest)] pt-2 text-sm font-sans font-bold">
                  <span>Total Amount:</span>
                  <span className="text-xl font-black text-[var(--color-primary)] font-mono">
                    ₹{priceDetails.formattedPrice}
                  </span>
                </div>
              </div>
            </div>

            {/* Matching Available Fleet Card */}
            <div className="bg-[var(--color-surface-bg)] rounded-3xl p-6 neo-shadow border border-[var(--color-surface-container-highest)] space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--color-surface-container-highest)] pb-2.5">
                <div className="flex items-center gap-2 text-[var(--color-primary)]">
                  <span className="material-symbols-outlined text-lg">local_shipping</span>
                  <span className="text-xs font-black tracking-widest uppercase text-[var(--color-on-surface)]">
                    Matching Available Fleet
                  </span>
                </div>
                {matchingLoading ? (
                  <span className="material-symbols-outlined text-xs animate-spin text-[var(--color-primary)]">sync</span>
                ) : (
                  <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    {matchedTrucks.length} Units Ready
                  </span>
                )}
              </div>

              {matchedTrucks.length > 0 ? (
                <div className="space-y-2">
                  {matchedTrucks.map(truck => (
                    <div key={truck.id} className="neo-shadow-inner rounded-xl p-3 text-xs flex items-center justify-between">
                      <div>
                        <p className="font-bold text-[var(--color-on-surface)] leading-tight">{truck.name}</p>
                        <p className="text-[10px] text-[var(--color-primary)] font-semibold mt-0.5">
                          {truck.partner_name || 'Partner Operator'} &bull; {truck.current_location}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Available
                        </span>
                        {truck.distance_to_pickup_km !== undefined && (
                          <p className="text-[10px] font-mono text-[var(--color-secondary)] mt-0.5">
                            {truck.distance_to_pickup_km} km away
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  <p className="text-[10px] text-[var(--color-secondary)] pt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-emerald-600">verified</span>
                    <span>Unavailable trucks are filtered out automatically.</span>
                  </p>
                </div>
              ) : (
                <div className="neo-shadow-inner rounded-xl p-3.5 text-xs text-amber-700 bg-amber-50/40 flex items-start gap-2">
                  <span className="material-symbols-outlined text-sm shrink-0 text-amber-600">warning</span>
                  <div>
                    <p className="font-bold">No available trucks in tier</p>
                    <p className="text-[11px] text-[var(--color-secondary)] mt-0.5">
                      Partner trucks are currently marked unavailable. Booking will be queued as pending dispatch.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Return Policy Quick Summary Card */}
            <div className="bg-[var(--color-surface-bg)] rounded-3xl p-6 neo-shadow border border-[var(--color-surface-container-highest)] space-y-3">
              <div className="flex items-center gap-2 text-[var(--color-primary)]">
                <span className="material-symbols-outlined text-lg">shield</span>
                <span className="text-xs font-black tracking-widest uppercase text-[var(--color-on-surface)]">
                  Return &amp; Cancellation Terms
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
