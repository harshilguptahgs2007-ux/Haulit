import React, { useState } from 'react'
import Link from 'next/link'
import { api, type HaulitOrder } from '../lib/api'

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
  return CITY_COORDS[key] ?? { lat: 20.5937 + Math.random() * 2, lon: 78.9629 + Math.random() * 2 }
}

function TrackIDModal({ trackId, onClose }: { trackId: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(trackId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(11,28,48,0.35)', backdropFilter: 'blur(6px)' }}
    >
      <div className="bg-[var(--color-surface-bg)] rounded-2xl p-10 w-full max-w-md mx-4 neo-shadow flex flex-col items-center text-center gap-6">
        <div className="w-20 h-20 rounded-full bg-[var(--color-surface-bg)] neo-shadow flex items-center justify-center">
          <span className="material-symbols-outlined fill-icon text-4xl text-[var(--color-primary)]">check_circle</span>
        </div>
        <div>
          <h2 className="text-[var(--text-headline-md)] font-extrabold text-[var(--color-on-surface)] mb-1">Order Placed!</h2>
          <p className="text-[var(--text-body-md)] text-[var(--color-on-surface-variant)]">Your tracking ID is ready.</p>
        </div>
        <div className="w-full bg-[var(--color-surface-bg)] neo-shadow-inner rounded-xl px-6 py-4 flex items-center justify-between gap-4">
          <span className="text-[var(--text-headline-md)] font-black tracking-widest text-[var(--color-primary)]">{trackId}</span>
          <button
            onClick={copy}
            className="neo-shadow text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors p-2 rounded-lg"
            title="Copy Track ID"
          >
            <span className="material-symbols-outlined">{copied ? 'check' : 'content_copy'}</span>
          </button>
        </div>
        <p className="text-[var(--text-label-md)] text-[var(--color-on-surface-variant)]">
          Use this ID on the <strong>Track</strong> page to monitor your shipment.
        </p>
        <div className="w-full flex gap-3">
          <Link
            href={`/track?id=${trackId}`}
            className="flex-1 bg-[var(--color-surface-bg)] text-[var(--color-primary)] text-[var(--text-label-md)] tracking-widest uppercase py-4 rounded-lg neo-shadow hover:neo-shadow-sm active:neo-shadow-inner transition-all duration-200 font-bold flex items-center justify-center gap-2"
          >
            <span>Track Now</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
          <button
            onClick={onClose}
            className="bg-[var(--color-surface-bg)] text-[var(--color-secondary)] text-[var(--text-label-md)] tracking-widest uppercase px-6 py-4 rounded-lg neo-shadow hover:neo-shadow-sm active:neo-shadow-inner transition-all duration-200 font-bold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Order(): React.ReactElement {
  const [pickup, setPickup]     = useState('')
  const [delivery, setDelivery] = useState('')
  const [weight, setWeight]     = useState('')
  const [cargo, setCargo]       = useState<CargoType>('standard')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [createdOrder, setCreatedOrder] = useState<HaulitOrder | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const token = typeof window !== 'undefined' ? localStorage.getItem('haulit_token') : null
    if (!token) {
      setError('Please login first to place an order.')
      return
    }
    if (!pickup.trim() || !delivery.trim() || !weight) {
      setError('Please fill in all fields.')
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
      })
      setCreatedOrder(res.order)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to place order')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {createdOrder && (
        <TrackIDModal
          trackId={createdOrder.track_id}
          onClose={() => setCreatedOrder(null)}
        />
      )}

      <div className="bg-[var(--color-surface-bg)] text-[var(--color-on-background)] antialiased min-h-screen flex flex-col font-sans">
        <main className="flex-grow max-w-[var(--spacing-container-max-width)] mx-auto px-[var(--spacing-gutter)] py-12 w-full flex flex-col lg:flex-row gap-12">

          <div className="flex-1 w-full max-w-2xl mx-auto lg:mx-0">
            <h1 className="text-[var(--text-headline-xl-mobile)] md:text-[var(--text-headline-xl)] font-extrabold leading-tight mb-8">
              Create New Order
            </h1>

            <form onSubmit={handleSubmit} className="space-y-8 bg-[var(--color-surface-bg)] p-8 rounded-xl neo-shadow border-none">

              <div className="space-y-6 relative">
                <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-[var(--color-shadow-dark)]/20 z-0 neo-shadow-inner" />

                <div className="relative z-10 flex gap-4 items-start">
                  <div className="w-12 h-12 rounded-full bg-[var(--color-surface-bg)] flex items-center justify-center shrink-0 neo-shadow border-4 border-[var(--color-surface-bg)]">
                    <span className="material-symbols-outlined text-[var(--color-secondary)]">my_location</span>
                  </div>
                  <div className="flex-1">
                    <label className="block text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-2">
                      Pickup Location
                    </label>
                    <input
                      type="text"
                      value={pickup}
                      onChange={e => setPickup(e.target.value)}
                      placeholder="e.g. Mumbai"
                      required
                      className="w-full bg-[var(--color-surface-bg)] border-none neo-shadow-inner focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 rounded-lg px-4 py-3 text-[var(--text-body-md)] text-[var(--color-on-surface)] transition-all"
                    />
                  </div>
                </div>

                <div className="relative z-10 flex gap-4 items-start">
                  <div className="w-12 h-12 rounded-full bg-[var(--color-surface-bg)] flex items-center justify-center shrink-0 neo-shadow border-4 border-[var(--color-surface-bg)]">
                    <span className="material-symbols-outlined fill-icon text-[var(--color-primary)]">location_on</span>
                  </div>
                  <div className="flex-1">
                    <label className="block text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-2">
                      Delivery Location
                    </label>
                    <input
                      type="text"
                      value={delivery}
                      onChange={e => setDelivery(e.target.value)}
                      placeholder="e.g. Delhi"
                      required
                      className="w-full bg-[var(--color-surface-bg)] border-none neo-shadow-inner focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 rounded-lg px-4 py-3 text-[var(--text-body-md)] text-[var(--color-on-surface)] transition-all"
                    />
                  </div>
                </div>
              </div>

              <hr className="border-[var(--color-shadow-dark)]/20 my-8 h-0.5 bg-transparent border-t-0 neo-shadow-inner" />

              <div className="space-y-6">
                <h2 className="text-[var(--text-headline-md)] font-semibold text-[var(--color-on-background)]">
                  Consignment Details
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-2">
                      Total Weight (KG)
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-secondary)]">weight</span>
                      <input
                        type="number"
                        value={weight}
                        onChange={e => setWeight(e.target.value)}
                        placeholder="0.00"
                        min="0.1"
                        step="0.1"
                        required
                        className="w-full bg-[var(--color-surface-bg)] border-none neo-shadow-inner focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 rounded-lg pl-12 pr-4 py-3 text-[var(--text-body-md)] text-[var(--color-on-surface)] transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-3">
                    Type of Cargo
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                        <div className={`p-4 bg-[var(--color-surface-bg)] rounded-lg text-center transition-all duration-300 ease-in-out ${
                          cargo === opt.value
                            ? 'neo-shadow-inner text-[var(--color-primary)] font-semibold'
                            : 'neo-shadow text-[var(--color-secondary)]'
                        }`}>
                          <span className="material-symbols-outlined mb-2 block">{opt.icon}</span>
                          <span className="text-[var(--text-label-md)] tracking-widest uppercase block">{opt.label}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {error && (
                <p className="text-[var(--color-error)] text-[var(--text-label-md)] neo-shadow-inner rounded-lg px-4 py-3 text-center">
                  {error}
                </p>
              )}

              <div className="pt-6">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[var(--color-surface-bg)] text-[var(--color-primary)] text-[var(--text-label-md)] tracking-widest uppercase py-4 rounded-lg neo-shadow hover:neo-shadow-sm active:neo-shadow-inner transition-all duration-200 flex justify-center items-center gap-2 font-bold disabled:opacity-50"
                >
                  <span>{loading ? 'Placing Order…' : 'Place Order'}</span>
                  {!loading && <span className="material-symbols-outlined">arrow_forward</span>}
                </button>
              </div>
            </form>
          </div>

          <div className="flex-1 w-full lg:max-w-md h-fit sticky top-32">
            <div className="bg-[var(--color-surface-bg)] rounded-xl p-8 flex flex-col items-center justify-center text-center min-h-[400px] neo-shadow border-none relative overflow-hidden">
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: 'radial-gradient(circle at center, #bc001f 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                }}
              />
              <div className="relative z-10 w-full flex flex-col items-center">
                <div className="w-24 h-24 bg-[var(--color-surface-bg)] neo-shadow rounded-full flex items-center justify-center mb-6 relative">
                  <div className="absolute inset-0 rounded-full connecting-animation" />
                  <span className="material-symbols-outlined fill-icon text-4xl text-[var(--color-primary)] z-10">radar</span>
                </div>
                <h3 className="text-[var(--text-headline-md)] font-semibold mb-2 text-[var(--color-on-surface)]">
                  Smart Dispatch
                </h3>
                <p className="text-[var(--text-body-md)] text-[var(--color-on-surface-variant)] mb-4 max-w-[250px]">
                  We auto-match your weight to the right vehicle tier and pick the nearest idle truck.
                </p>
                <div className="w-full space-y-2 text-left">
                  {[
                    { icon: 'local_shipping', label: '≤ 250 kg → Mini Truck (Tata Ace)' },
                    { icon: 'local_shipping', label: '≤ 1,500 kg → Small (Tata 407)' },
                    { icon: 'local_shipping', label: '≤ 5,000 kg → Medium (Eicher)' },
                    { icon: 'local_shipping', label: '≤ 15,000 kg → Large (Ashok Leyland)' },
                    { icon: 'local_shipping', label: '> 15,000 kg → Heavy (Volvo FH)' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2 bg-[var(--color-surface-bg)] neo-shadow-inner rounded-lg px-3 py-2">
                      <span className="material-symbols-outlined text-sm text-[var(--color-primary)]">{item.icon}</span>
                      <span className="text-[var(--text-label-md)] text-[var(--color-on-surface-variant)]">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </main>
      </div>
    </>
  )
}
