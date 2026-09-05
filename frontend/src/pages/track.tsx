import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { api, type HaulitOrder, type HealthScore, type Waypoint } from '../lib/api'

const STATUS_STEPS = [
  { key: 'pending',           label: 'Order Placed',       icon: 'receipt_long'   },
  { key: 'assigned',          label: 'Driver Assigned',    icon: 'person_pin'     },
  { key: 'picked_up',         label: 'Picked Up',          icon: 'inventory'      },
  { key: 'in_transit',        label: 'In Transit',         icon: 'local_shipping' },
  { key: 'out_for_delivery',  label: 'Out for Delivery',   icon: 'delivery_dining'},
  { key: 'delivered',         label: 'Delivered',          icon: 'check_circle'   },
]

const STATUS_ORDER = STATUS_STEPS.map(s => s.key)

function riskColor(risk: HealthScore['risk_level']) {
  return {
    good:     'text-emerald-600',
    moderate: 'text-amber-500',
    high:     'text-orange-600',
    critical: 'text-[var(--color-error)]',
  }[risk]
}

function riskBg(risk: HealthScore['risk_level']) {
  return {
    good:     'bg-emerald-50',
    moderate: 'bg-amber-50',
    high:     'bg-orange-50',
    critical: 'bg-red-50',
  }[risk]
}

function HealthGauge({ score, risk }: { score: number; risk: HealthScore['risk_level'] }) {
  const color = { good: '#10b981', moderate: '#f59e0b', high: '#ea580c', critical: '#bc001f' }[risk]
  const r = 44
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={r} fill="none" stroke="#aeaec0" strokeWidth="8" strokeOpacity="0.25" />
        <circle
          cx="55" cy="55" r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={`${circ}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 55 55)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x="55" y="52" textAnchor="middle" fontSize="18" fontWeight="800" fill={color}>{Math.round(score)}</text>
        <text x="55" y="67" textAnchor="middle" fontSize="10" fill="#585e6c">/ 100</text>
      </svg>
      <span className={`text-[var(--text-label-md)] tracking-widest uppercase font-bold ${riskColor(risk)}`}>
        {risk}
      </span>
    </div>
  )
}

function WaypointTimeline({ waypoints, currentStatus }: { waypoints: Waypoint[]; currentStatus: string }) {
  const stepIdx = STATUS_ORDER.indexOf(currentStatus)

  return (
    <div className="w-full">
      <h3 className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-4">
        Journey Timeline
      </h3>
      <div className="space-y-0">
        {STATUS_STEPS.map((step, i) => {
          const done    = i < stepIdx
          const current = i === stepIdx
          const wp      = waypoints.find(w =>
            (i === 0 && w.sequence === 0) ||
            (i === 3 && w.sequence === 1) ||
            (i === 5 && w.sequence === 2)
          )

          return (
            <div key={step.key} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all ${
                  done    ? 'bg-[var(--color-surface-bg)] neo-shadow text-emerald-600' :
                  current ? 'bg-[var(--color-surface-bg)] neo-shadow text-[var(--color-primary)] connecting-animation' :
                            'bg-[var(--color-surface-bg)] neo-shadow-inner text-[var(--color-secondary)] opacity-50'
                }`}>
                  <span className="material-symbols-outlined text-sm">{done ? 'check' : step.icon}</span>
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <div className={`w-0.5 flex-1 min-h-[24px] my-1 ${done ? 'bg-emerald-400' : 'bg-[var(--color-shadow-dark)]/20'}`} />
                )}
              </div>
              <div className="pb-5 pt-2 flex-1">
                <p className={`text-[var(--text-label-md)] tracking-widest uppercase font-bold ${
                  current ? 'text-[var(--color-primary)]' : done ? 'text-emerald-600' : 'text-[var(--color-secondary)] opacity-60'
                }`}>
                  {step.label}
                </p>
                {wp?.arrived_at && (
                  <p className="text-xs text-[var(--color-secondary)] mt-0.5">
                    {new Date(wp.arrived_at).toLocaleString('en-IN')}
                  </p>
                )}
                {wp?.location && wp.location !== 'In Transit' && (
                  <p className="text-xs text-[var(--color-on-surface-variant)] mt-0.5">{wp.location}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function OrderCard({ order }: { order: HaulitOrder }) {
  const health  = order.latest_health
  const sensor  = order.latest_sensor
  const vehicle = order.vehicle

  function fmt(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 animate-[fadeIn_.4s_ease]">
      <div className="bg-[var(--color-surface-bg)] rounded-2xl neo-shadow p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)]">Tracking ID</p>
            <p className="text-[var(--text-headline-md)] font-black text-[var(--color-primary)] tracking-widest">{order.track_id}</p>
          </div>
          <span className={`px-4 py-1.5 rounded-full text-[var(--text-label-md)] tracking-widest uppercase font-bold neo-shadow-inner ${
            order.status === 'delivered' ? 'text-emerald-600' : 'text-[var(--color-primary)]'
          }`}>
            {order.status.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[var(--text-body-md)]">
          <div className="neo-shadow-inner rounded-lg p-4">
            <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-1">From</p>
            <p className="font-semibold text-[var(--color-on-surface)]">{order.pickup}</p>
          </div>
          <div className="neo-shadow-inner rounded-lg p-4">
            <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-1">To</p>
            <p className="font-semibold text-[var(--color-on-surface)]">{order.delivery}</p>
          </div>
          <div className="neo-shadow-inner rounded-lg p-4">
            <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-1">Weight</p>
            <p className="font-semibold text-[var(--color-on-surface)]">{order.weight_kg} kg</p>
          </div>
          <div className="neo-shadow-inner rounded-lg p-4">
            <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-1">Cargo Type</p>
            <p className="font-semibold text-[var(--color-on-surface)] capitalize">{order.cargo_type}</p>
          </div>
          <div className="neo-shadow-inner rounded-lg p-4">
            <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-1">Placed</p>
            <p className="font-semibold text-[var(--color-on-surface)]">{fmt(order.created_at)}</p>
          </div>
          <div className="neo-shadow-inner rounded-lg p-4">
            <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-1">ETA</p>
            <p className={`font-semibold ${order.eta ? 'text-[var(--color-primary)]' : 'text-[var(--color-secondary)]'}`}>
              {fmt(order.eta)}
            </p>
          </div>
        </div>
      </div>

      {vehicle && (
        <div className="bg-[var(--color-surface-bg)] rounded-2xl neo-shadow p-6">
          <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-3">Assigned Vehicle</p>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[var(--color-surface-bg)] neo-shadow flex items-center justify-center">
              <span className="material-symbols-outlined text-[var(--color-primary)]">local_shipping</span>
            </div>
            <div>
              <p className="font-bold text-[var(--color-on-surface)]">{vehicle.name}</p>
              <p className="text-[var(--text-label-md)] text-[var(--color-secondary)]">
                Capacity {vehicle.capacity_kg.toLocaleString()} kg · {vehicle.avg_speed_kmh} km/h avg
              </p>
              <p className="text-[var(--text-label-md)] text-[var(--color-secondary)] mt-0.5">
                📍 Currently at <strong>{vehicle.current_location}</strong>
              </p>
            </div>
            <span className={`ml-auto px-3 py-1 rounded-full text-[var(--text-label-md)] tracking-widest uppercase font-bold neo-shadow-inner ${
              vehicle.status === 'in_transit' ? 'text-[var(--color-primary)]' :
              vehicle.status === 'assigned'   ? 'text-amber-600' : 'text-emerald-600'
            }`}>
              {vehicle.status.replace('_', ' ')}
            </span>
          </div>
        </div>
      )}

      <div className="bg-[var(--color-surface-bg)] rounded-2xl neo-shadow p-6">
        <WaypointTimeline waypoints={order.waypoints} currentStatus={order.status} />
      </div>

      {(health || sensor) && (
        <div className="bg-[var(--color-surface-bg)] rounded-2xl neo-shadow p-6">
          <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-4">Luggage Health</p>
          <div className="flex flex-col md:flex-row gap-6 items-center">
            {health && <HealthGauge score={health.score} risk={health.risk_level} />}
            <div className="flex-1 space-y-3 w-full">
              {sensor && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Vibration', value: `${sensor.vibration}g`, icon: 'vibration' },
                    { label: 'Temp', value: `${sensor.temperature_c}°C`, icon: 'thermostat' },
                    { label: 'Moisture', value: `${sensor.moisture_pct}%`, icon: 'water_drop' },
                  ].map(s => (
                    <div key={s.label} className="neo-shadow-inner rounded-lg p-3 text-center">
                      <span className="material-symbols-outlined text-[var(--color-primary)] text-sm block mb-1">{s.icon}</span>
                      <p className="font-bold text-[var(--color-on-surface)] text-sm">{s.value}</p>
                      <p className="text-[var(--text-label-md)] text-[var(--color-secondary)]">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}
              {health && health.detail?.violations && health.detail.violations.length > 0 && (
                <div className={`rounded-lg p-4 ${riskBg(health.risk_level)}`}>
                  <p className={`text-[var(--text-label-md)] tracking-widest uppercase font-bold mb-2 ${riskColor(health.risk_level)}`}>
                    AI Alerts
                  </p>
                  {health.detail.violations.map((v, i) => (
                    <p key={i} className="text-sm text-[var(--color-on-surface)] flex items-start gap-2">
                      <span className="material-symbols-outlined text-sm shrink-0 mt-0.5">warning</span>
                      {v}
                    </p>
                  ))}
                </div>
              )}
              {health && (!health.detail?.violations || health.detail.violations.length === 0) && (
                <div className="rounded-lg p-4 bg-emerald-50">
                  <p className="text-[var(--text-label-md)] tracking-widest uppercase font-bold text-emerald-600 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    All sensors within safe range
                  </p>
                </div>
              )}
              <p className="text-xs text-[var(--color-secondary)] text-right">
                Last reading: {sensor ? new Date(sensor.timestamp).toLocaleString('en-IN') : '—'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Track(): React.ReactElement {
  const router = useRouter()
  const queryId = typeof router.query.id === 'string' ? router.query.id : ''

  const [trackInput, setTrackInput]   = useState(queryId)
  const [order, setOrder]             = useState<HaulitOrder | null>(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const activeId = useRef<string | null>(null)

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  function startPolling(id: string) {
    stopPolling()
    pollRef.current = setInterval(async () => {
      if (!activeId.current) return
      try {
        const res = await api.orders.track(id)
        setOrder(res.order)
        setLastUpdated(new Date())
        if (res.order.status === 'delivered' || res.order.status === 'cancelled') {
          stopPolling()
        }
      } catch {}
    }, 1000)
  }

  useEffect(() => {
    return () => stopPolling()
  }, [])

  async function lookupTrackId(idToLookup: string) {
    const id = idToLookup.trim().toUpperCase()
    if (!id) return
    setError('')
    setLoading(true)
    stopPolling()
    try {
      const res = await api.orders.track(id)
      setOrder(res.order)
      setLastUpdated(new Date())
      activeId.current = id
      if (res.order.status !== 'delivered' && res.order.status !== 'cancelled') {
        startPolling(id)
      }
    } catch {
      setError('No shipment found for that tracking ID.')
      setOrder(null)
      activeId.current = null
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (queryId) {
      setTrackInput(queryId)
      lookupTrackId(queryId)
    }
  }, [queryId])

  function handleTrack(e: React.FormEvent) {
    e.preventDefault()
    lookupTrackId(trackInput)
  }

  return (
    <div className="bg-[var(--color-surface-bg)] text-[var(--color-on-background)] antialiased min-h-screen flex flex-col font-sans">
      <main className="flex-grow max-w-[var(--spacing-container-max-width)] mx-auto px-[var(--spacing-gutter)] py-16 w-full flex flex-col items-center gap-10">

        <div
          className="bg-[var(--color-surface-bg)] p-10 rounded-[32px] neo-shadow flex flex-col items-center text-center max-w-lg w-full"
          style={{ boxShadow: 'rgba(255,255,255,0.8) -5px -5px 10px, rgba(0,0,0,0.1) 5px 5px 10px' }}
        >
          <div className="w-24 h-24 rounded-full bg-[var(--color-surface-bg)] flex items-center justify-center neo-shadow mb-6 relative overflow-hidden">
            <img className="absolute w-[6rem] max-w-none" src="/assets/haulit.png" alt="HAULIT Logo" />
          </div>

          <h1 className="text-[var(--text-headline-lg)] font-extrabold tracking-tight text-[var(--color-on-surface)] mb-3">
            Track Your Shipment
          </h1>
          <p className="text-[var(--text-body-md)] text-[var(--color-on-surface-variant)] mb-8">
            Enter your Tracking ID to monitor your order in real-time.
          </p>

          <form onSubmit={handleTrack} className="w-full flex flex-col gap-4">
            <input
              type="text"
              value={trackInput}
              onChange={e => setTrackInput(e.target.value)}
              placeholder="e.g. HLT-8924-IN"
              className="w-full bg-[var(--color-surface-bg)] border-none neo-shadow-inner focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 rounded-lg px-4 py-3 text-[var(--text-body-md)] text-[var(--color-on-surface)] transition-all uppercase tracking-widest"
            />
            {error && (
              <p className="text-[var(--color-error)] text-[var(--text-label-md)] neo-shadow-inner rounded-lg px-4 py-2">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--color-surface-bg)] text-[var(--color-primary)] text-[var(--text-label-md)] tracking-widest uppercase py-4 rounded-lg neo-shadow hover:neo-shadow-sm active:neo-shadow-inner transition-all duration-200 font-bold disabled:opacity-50"
            >
              {loading ? 'Looking up…' : 'Track Now'}
            </button>
          </form>

          {lastUpdated && (
            <div className="flex items-center gap-2 mt-4">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-secondary)]">
                Live · updated {lastUpdated.toLocaleTimeString('en-IN')}
              </span>
            </div>
          )}
        </div>

        {order && <OrderCard order={order} />}

      </main>
    </div>
  )
}
