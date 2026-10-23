import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import { api, type HaulitOrder, type HealthScore, type Waypoint, type TruckLocation, CARGO_THRESHOLDS } from '../lib/api'
import ReturnModal from '../components/ReturnModal'

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

  const isDangerous = risk === 'critical' || risk === 'high'

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
      {/* Critical / Dangerous banner */}
      {isDangerous && (
        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white animate-pulse ${
          risk === 'critical' ? 'bg-[#bc001f]' : 'bg-orange-600'
        }`}>
          {risk === 'critical' ? '⚠ Critical Health' : '⚠ Dangerous'}
        </span>
      )}
    </div>
  )
}

function WaypointTimeline({ waypoints, currentStatus }: { waypoints: Waypoint[]; currentStatus: string }) {
  const stepIdx = STATUS_ORDER.indexOf(currentStatus)

  return (
    <div className="w-full">
      <h3 className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-4 font-bold">
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
                  <p className="text-xs text-[var(--color-secondary)] mt-0.5 font-mono">
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

// ── Demo Map Component ──────────────────────────────────────────────────────────
interface DemoMapProps {
  location: TruckLocation
  pickupLabel: string
  deliveryLabel: string
}

function DemoMap({ location, pickupLabel, deliveryLabel }: DemoMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const drawMap = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height

    // Coordinate bounds
    const minLat = Math.min(location.pickup_lat, location.delivery_lat) - 0.5
    const maxLat = Math.max(location.pickup_lat, location.delivery_lat) + 0.5
    const minLon = Math.min(location.pickup_lon, location.delivery_lon) - 0.5
    const maxLon = Math.max(location.pickup_lon, location.delivery_lon) + 0.5

    function toX(lon: number) { return ((lon - minLon) / (maxLon - minLon)) * (W - 40) + 20 }
    function toY(lat: number) { return H - (((lat - minLat) / (maxLat - minLat)) * (H - 40) + 20) }

    // Background
    ctx.fillStyle = '#f0f4f8'
    ctx.fillRect(0, 0, W, H)

    // Grid lines
    ctx.strokeStyle = '#dde3ea'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= 5; i++) {
      const y = (H / 5) * i
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      const x = (W / 5) * i
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
    }

    const px = toX(location.pickup_lon), py = toY(location.pickup_lat)
    const dx = toX(location.delivery_lon), dy = toY(location.delivery_lat)
    const tx = toX(location.lon), ty = toY(location.lat)

    // Route line (dashed behind truck, solid ahead)
    ctx.setLineDash([6, 4])
    ctx.strokeStyle = '#c9d2dc'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(dx, dy); ctx.stroke()
    ctx.setLineDash([])

    // Completed path (solid colored)
    ctx.strokeStyle = '#6366f1'
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx, ty); ctx.stroke()

    // Remaining path
    ctx.strokeStyle = '#a5b4fc'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(dx, dy); ctx.stroke()
    ctx.setLineDash([])

    // Pickup pin
    ctx.fillStyle = '#10b981'
    ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 10px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('A', px, py + 3.5)

    // Delivery pin
    ctx.fillStyle = '#ef4444'
    ctx.beginPath(); ctx.arc(dx, dy, 8, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.fillText('B', dx, dy + 3.5)

    // Truck icon
    const isDone = location.status === 'delivered'
    const truckColor = isDone ? '#10b981' : '#6366f1'
    ctx.fillStyle = truckColor
    ctx.beginPath(); ctx.arc(tx, ty, 11, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 12px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('🚛', tx, ty + 4)

    // Labels
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillStyle = '#10b981'
    ctx.fillText(pickupLabel.slice(0, 18), Math.min(px + 12, W - 100), py - 10)
    ctx.fillStyle = '#ef4444'
    const dlabel = deliveryLabel.slice(0, 18)
    const dLabelX = dx + 12 > W - dlabel.length * 6 ? dx - dlabel.length * 6 - 12 : dx + 12
    ctx.fillText(dlabel, dLabelX, dy - 10)

    // Progress bar at bottom
    const barY = H - 10
    ctx.fillStyle = '#dde3ea'
    ctx.fillRect(20, barY - 4, W - 40, 4)
    ctx.fillStyle = '#6366f1'
    ctx.fillRect(20, barY - 4, (W - 40) * location.progress, 4)

  }, [location, pickupLabel, deliveryLabel])

  useEffect(() => {
    drawMap()
  }, [drawMap])

  return (
    <canvas
      ref={canvasRef}
      width={520}
      height={280}
      className="w-full rounded-xl"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}

// ── Live Map Panel ──────────────────────────────────────────────────────────────
interface LiveMapPanelProps {
  order: HaulitOrder
}

function LiveMapPanel({ order }: LiveMapPanelProps) {
  const [location, setLocation] = useState<TruckLocation | null>(null)
  const [loading, setLoading]   = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchLocation = useCallback(async () => {
    try {
      const loc = await api.orders.getTruckLocation(order.track_id)
      setLocation(loc)
    } catch {
      // silently ignore
    } finally {
      setLoading(false)
    }
  }, [order.track_id])

  useEffect(() => {
    fetchLocation()
    // Poll every 8 seconds when in transit
    if (order.status !== 'delivered' && order.status !== 'cancelled') {
      pollRef.current = setInterval(fetchLocation, 8000)
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchLocation, order.status])

  const isActive = order.status !== 'delivered' && order.status !== 'cancelled'

  return (
    <div className="bg-[var(--color-surface-bg)] rounded-3xl neo-shadow p-6 sm:p-8 border border-[var(--color-surface-container-highest)] space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[var(--color-primary)]">map</span>
          <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] font-bold">
            Live Truck Tracking
          </p>
          <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded bg-amber-100 text-amber-700">
            Demo Mode
          </span>
        </div>
        {isActive && (
          <span className="flex items-center gap-1.5 text-[var(--text-label-md)] tracking-widest uppercase text-emerald-600 text-xs font-bold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Live · refreshes every 8s
          </span>
        )}
      </div>

      {/* Map */}
      {loading ? (
        <div className="h-[280px] rounded-xl neo-shadow-inner flex items-center justify-center">
          <span className="material-symbols-outlined text-4xl text-[var(--color-secondary)] opacity-40 animate-spin">progress_activity</span>
        </div>
      ) : location ? (
        <div className="neo-shadow-inner rounded-xl p-3">
          <DemoMap
            location={location}
            pickupLabel={order.pickup}
            deliveryLabel={order.delivery}
          />
        </div>
      ) : (
        <div className="h-[200px] rounded-xl neo-shadow-inner flex items-center justify-center text-[var(--color-secondary)] text-sm">
          Map unavailable
        </div>
      )}

      {/* Stats Row */}
      {location && (
        <div className="grid grid-cols-3 gap-3">
          <div className="neo-shadow-inner rounded-xl p-3 text-center">
            <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-1 font-bold text-[10px]">Progress</p>
            <p className="font-black text-[var(--color-primary)] text-lg">{Math.round(location.progress * 100)}%</p>
          </div>
          <div className="neo-shadow-inner rounded-xl p-3 text-center">
            <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-1 font-bold text-[10px]">Remaining</p>
            <p className="font-black text-[var(--color-on-surface)] text-lg font-mono">
              {location.status === 'delivered' ? '0' : location.remaining_km} km
            </p>
          </div>
          <div className="neo-shadow-inner rounded-xl p-3 text-center">
            <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-1 font-bold text-[10px]">ETA</p>
            <p className="font-black text-[var(--color-primary)] text-lg font-mono">
              {location.status === 'delivered'
                ? '✓ Done'
                : location.eta_minutes != null
                  ? `${location.eta_minutes} min`
                  : '—'}
            </p>
          </div>
        </div>
      )}

      {/* Route */}
      <div className="flex items-center gap-2 text-sm">
        <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
        <span className="text-[var(--color-on-surface-variant)] flex-1 truncate">{order.pickup}</span>
        <span className="material-symbols-outlined text-sm text-[var(--color-secondary)]">arrow_forward</span>
        <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
        <span className="text-[var(--color-on-surface-variant)] flex-1 truncate">{order.delivery}</span>
      </div>
      <p className="text-[9px] text-[var(--color-secondary)] opacity-60 text-center">
        ℹ Truck position is simulated based on order status. No real GPS data is used in demo mode.
      </p>
    </div>
  )
}

// ── Sensor Info Tiles ───────────────────────────────────────────────────────────
function SensorTiles({ order }: { order: HaulitOrder }) {
  const sensor    = order.latest_sensor
  const cargoType = order.cargo_type?.toLowerCase() ?? 'standard'
  const t         = CARGO_THRESHOLDS[cargoType] ?? CARGO_THRESHOLDS['standard']

  if (!sensor) return null

  const fields = [
    {
      label: 'Vibration',
      value: sensor.vibration,
      unit: 'g',
      icon: 'vibration',
      safeMin: t.vibration_min,
      safeMax: t.vibration_max,
      hint: t.vibration_min > 0 ? `${t.vibration_min}–${t.vibration_max} g` : `0–${t.vibration_max} g`,
    },
    {
      label: 'Temp',
      value: sensor.temperature_c,
      unit: '°C',
      icon: 'thermostat',
      safeMin: t.temp_min,
      safeMax: t.temp_max,
      hint: `${t.temp_min}–${t.temp_max} °C`,
    },
    {
      label: 'Moisture',
      value: sensor.moisture_pct,
      unit: '%',
      icon: 'water_drop',
      safeMin: t.moisture_min,
      safeMax: t.moisture_max,
      hint: t.moisture_min > 0 ? `${t.moisture_min}–${t.moisture_max}% RH` : `0–${t.moisture_max}% RH`,
    },
  ]

  return (
    <div className="grid grid-cols-3 gap-3">
      {fields.map(f => {
        const oor = f.value > f.safeMax || (f.safeMin > 0 && f.value < f.safeMin)
        return (
          <div key={f.label} className={`neo-shadow-inner rounded-xl p-3 text-center ${oor ? 'ring-2 ring-[var(--color-error)]/50' : ''}`}>
            <span className={`material-symbols-outlined text-sm block mb-1 ${oor ? 'text-[var(--color-error)]' : 'text-[var(--color-primary)]'}`}>{f.icon}</span>
            <p className={`font-bold text-sm ${oor ? 'text-[var(--color-error)]' : 'text-[var(--color-on-surface)]'}`}>
              {f.value}{f.unit}
              {oor && <span className="ml-1 text-[9px] font-black bg-[var(--color-error)] text-white rounded px-1">!</span>}
            </p>
            <p className="text-[var(--text-label-md)] text-[var(--color-secondary)]">{f.label}</p>
            <p className="text-[9px] text-[var(--color-secondary)] opacity-70 mt-0.5 font-mono">
              Safe: {f.hint}
            </p>
          </div>
        )
      })}
    </div>
  )
}

// ── Order Card ──────────────────────────────────────────────────────────────────
interface OrderCardProps {
  order: HaulitOrder
  onOpenReturn: () => void
}

function OrderCard({ order, onOpenReturn }: OrderCardProps) {
  const health  = order.latest_health
  const vehicle = order.vehicle
  const isCancelled = order.status === 'cancelled'
  const isDelivered = order.status === 'delivered'

  function fmt(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 animate-[fadeIn_.4s_ease]">
      {/* Cancellation / Refund Banner */}
      {isCancelled && (
        <div className="bg-red-50/80 border border-red-200 rounded-2xl p-5 neo-shadow space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-[var(--color-error)] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">cancel</span>
              Order Cancelled & Refund Processed
            </span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-[var(--color-error)]">
              {order.return_reason === 'company_fault' ? 'Company Fault (90%)' : 'Customer Cancellation (50%)'}
            </span>
          </div>
          <div className="flex justify-between items-center pt-1">
            <p className="text-xs text-[var(--color-on-surface-variant)]">
              Notice: No damage payment from Haulit.
            </p>
            {order.refund_amount !== undefined && order.refund_amount !== null && (
              <span className="text-lg font-black text-emerald-600 font-mono">
                Refund: ₹{order.refund_amount.toFixed(2)}/-
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main Order Header Card */}
      <div className="bg-[var(--color-surface-bg)] rounded-3xl neo-shadow p-6 sm:p-8 border border-[var(--color-surface-container-highest)]">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] font-bold">
              Tracking ID
            </p>
            <p className="text-[var(--text-headline-md)] font-black text-[var(--color-primary)] tracking-widest font-mono">
              {order.track_id}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-4 py-1.5 rounded-full text-[var(--text-label-md)] tracking-widest uppercase font-bold neo-shadow-inner ${
              isCancelled ? 'text-[var(--color-error)]' : isDelivered ? 'text-emerald-600' : 'text-[var(--color-primary)]'
            }`}>
              {order.status.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[var(--text-body-md)]">
          <div className="neo-shadow-inner rounded-xl p-4">
            <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-1 font-bold">From</p>
            <p className="font-semibold text-[var(--color-on-surface)]">{order.pickup}</p>
          </div>
          <div className="neo-shadow-inner rounded-xl p-4">
            <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-1 font-bold">To</p>
            <p className="font-semibold text-[var(--color-on-surface)]">{order.delivery}</p>
          </div>
          <div className="neo-shadow-inner rounded-xl p-4">
            <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-1 font-bold">Shipment Amount</p>
            <p className="font-mono font-bold text-lg text-[var(--color-primary)]">
              {order.price ? `₹${order.price.toFixed(2)}/-` : '—'}
            </p>
          </div>

          <div className="neo-shadow-inner rounded-xl p-4">
            <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-1 font-bold">Weight</p>
            <p className="font-semibold text-[var(--color-on-surface)]">{order.weight_kg} kg</p>
          </div>
          <div className="neo-shadow-inner rounded-xl p-4">
            <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-1 font-bold">Vehicle Tier</p>
            <p className="font-semibold text-[var(--color-on-surface)]">{order.truck_type ?? 'SMALL'} Truck</p>
          </div>
          <div className="neo-shadow-inner rounded-xl p-4">
            <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-1 font-bold">Est. Distance</p>
            <p className="font-semibold text-[var(--color-on-surface)]">{order.distance_km ? `${order.distance_km} km` : '—'}</p>
          </div>

          <div className="neo-shadow-inner rounded-xl p-4">
            <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-1 font-bold">Cargo Type</p>
            <p className="font-semibold text-[var(--color-on-surface)] capitalize">{order.cargo_type}</p>
          </div>
          <div className="neo-shadow-inner rounded-xl p-4">
            <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-1 font-bold">Placed At</p>
            <p className="font-semibold text-[var(--color-on-surface)]">{fmt(order.created_at)}</p>
          </div>
          <div className="neo-shadow-inner rounded-xl p-4">
            <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-1 font-bold">ETA</p>
            <p className={`font-semibold ${order.eta ? 'text-[var(--color-primary)]' : 'text-[var(--color-secondary)]'}`}>
              {fmt(order.eta)}
            </p>
          </div>
        </div>

        {/* Return Button inside Order Card */}
        {!isCancelled && !isDelivered && (
          <div className="mt-6 pt-5 border-t border-[var(--color-surface-container-highest)] flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-[var(--color-on-surface)]">Need to cancel or return this shipment?</p>
              <p className="text-xs text-[var(--color-secondary)]">50% refund on customer cancel · 90% on company fault</p>
            </div>
            <button
              onClick={onOpenReturn}
              className="bg-[var(--color-surface-bg)] text-[var(--color-error)] text-[var(--text-label-md)] tracking-widest uppercase px-6 py-3 rounded-xl neo-shadow hover:neo-shadow-sm active:neo-shadow-inner transition-all duration-200 font-bold flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">assignment_return</span>
              <span>Return / Cancel Order</span>
            </button>
          </div>
        )}
      </div>

      {/* Live Map */}
      {!isCancelled && (
        <LiveMapPanel order={order} />
      )}

      {/* Assigned Vehicle */}
      {vehicle && (
        <div className="bg-[var(--color-surface-bg)] rounded-3xl neo-shadow p-6 sm:p-8 border border-[var(--color-surface-container-highest)]">
          <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-3 font-bold">
            Assigned Vehicle
          </p>
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

      {/* Timeline */}
      <div className="bg-[var(--color-surface-bg)] rounded-3xl neo-shadow p-6 sm:p-8 border border-[var(--color-surface-container-highest)]">
        <WaypointTimeline waypoints={order.waypoints} currentStatus={order.status} />
      </div>

      {/* Luggage Health & Sensors */}
      {(health || order.latest_sensor) && (
        <div className="bg-[var(--color-surface-bg)] rounded-3xl neo-shadow p-6 sm:p-8 border border-[var(--color-surface-container-highest)]">
          <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-4 font-bold">
            Luggage Health & IoT Telemetry
          </p>
          <div className="flex flex-col md:flex-row gap-6 items-center">
            {health && <HealthGauge score={health.score} risk={health.risk_level} />}
            <div className="flex-1 space-y-3 w-full">
              {/* Sensor tiles with threshold info */}
              <SensorTiles order={order} />

              {health && health.detail?.violations && health.detail.violations.length > 0 && (
                <div className={`rounded-xl p-4 ${riskBg(health.risk_level)}`}>
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
                <div className="rounded-xl p-4 bg-emerald-50">
                  <p className="text-[var(--text-label-md)] tracking-widest uppercase font-bold text-emerald-600 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    All sensors within safe range
                  </p>
                </div>
              )}
              <p className="text-xs text-[var(--color-secondary)] text-right">
                Last reading: {order.latest_sensor ? new Date(order.latest_sensor.timestamp).toLocaleString('en-IN') : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Return & Cancellation Policy Information Card */}
      <div className="bg-[var(--color-surface-bg)] rounded-3xl neo-shadow p-6 sm:p-8 border border-[var(--color-surface-container-highest)] space-y-3">
        <div className="flex items-center gap-2 text-[var(--color-primary)]">
          <span className="material-symbols-outlined text-lg">policy</span>
          <span className="text-xs font-black tracking-widest uppercase text-[var(--color-on-surface)]">
            Haulit Return & Cancellation Policy
          </span>
        </div>
        <p className="text-xs text-[var(--color-on-surface-variant)] leading-relaxed text-justify">
          Orders can be cancelled or returned under the following strict conditions. If a return or cancellation
          is initiated by the customer, a <strong>50% refund</strong> of the total booking payment will be issued.
          If the cancellation or return occurs due to company or logistics fault (such as vehicle breakdown, unexpected
          operational delays, or dispatch errors), a <strong>90% refund</strong> will be returned. Please note that{' '}
          <strong className="text-[var(--color-error)]">no damage payment or compensation is provided by Haulit under any circumstances</strong>.
          By accepting, you agree to these binding terms.
        </p>
      </div>
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
  const [showReturnModal, setShowReturnModal] = useState(false)
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
    activeId.current = id
    pollRef.current = setInterval(async () => {
      if (!activeId.current) return
      try {
        const res = await api.orders.track(activeId.current)
        setOrder(res.order)
        setLastUpdated(new Date())
        if (res.order.status === 'delivered' || res.order.status === 'cancelled') {
          stopPolling()
        }
      } catch {}
    }, 4000)
  }

  async function lookupTrackId(id: string) {
    const clean = id.trim().toUpperCase()
    if (!clean) return
    setLoading(true)
    setError('')
    stopPolling()
    try {
      const res = await api.orders.track(clean)
      setOrder(res.order)
      setLastUpdated(new Date())
      if (res.order.status !== 'delivered' && res.order.status !== 'cancelled') {
        startPolling(clean)
      }
    } catch {
      setError(`No shipment found for "${clean}". Please verify your Tracking ID.`)
      setOrder(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    return () => stopPolling()
  }, [])

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
    <>
      {showReturnModal && order && (
        <ReturnModal
          order={order}
          onClose={() => setShowReturnModal(false)}
          onSuccess={updated => {
            setOrder(updated)
            stopPolling()
          }}
        />
      )}

      <div className="bg-[var(--color-surface-bg)] text-[var(--color-on-background)] antialiased min-h-screen flex flex-col font-sans">
        <main className="flex-grow max-w-[var(--spacing-container-max-width)] mx-auto px-[var(--spacing-gutter)] py-14 w-full flex flex-col items-center gap-10">

          <div
            className="bg-[var(--color-surface-bg)] p-8 sm:p-10 rounded-[32px] neo-shadow flex flex-col items-center text-center max-w-lg w-full border border-[var(--color-surface-container-highest)]"
          >
            <div className="w-24 h-24 rounded-full bg-[var(--color-surface-bg)] flex items-center justify-center neo-shadow mb-6 relative overflow-hidden">
              <img className="absolute w-[6rem] max-w-none" src="/assets/haulit.png" alt="HAULIT Logo" />
            </div>

            <h1 className="text-[var(--text-headline-lg)] font-extrabold tracking-tight text-[var(--color-on-surface)] mb-2">
              Track Your Shipment
            </h1>
            <p className="text-[var(--text-body-md)] text-[var(--color-on-surface-variant)] mb-6">
              Enter your Tracking ID to monitor location, luggage health, and manage returns.
            </p>

            <form onSubmit={handleTrack} className="w-full flex flex-col gap-4">
              <input
                type="text"
                value={trackInput}
                onChange={e => setTrackInput(e.target.value)}
                placeholder="e.g. HLT-XXXX-IN"
                className="w-full bg-[var(--color-surface-bg)] border-none neo-shadow-inner focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 rounded-xl px-4 py-3.5 text-[var(--text-body-md)] text-[var(--color-on-surface)] transition-all uppercase tracking-widest font-mono text-center font-bold"
              />
              {error && (
                <p className="text-[var(--color-error)] text-xs neo-shadow-inner rounded-xl px-4 py-2 font-medium">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[var(--color-surface-bg)] text-[var(--color-primary)] text-[var(--text-label-md)] tracking-widest uppercase py-4 rounded-xl neo-shadow hover:neo-shadow-sm active:neo-shadow-inner transition-all duration-200 font-extrabold disabled:opacity-50"
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

          {order && (
            <OrderCard
              order={order}
              onOpenReturn={() => setShowReturnModal(true)}
            />
          )}

        </main>
      </div>
    </>
  )
}
