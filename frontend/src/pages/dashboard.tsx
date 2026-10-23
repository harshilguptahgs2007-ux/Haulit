import React, { useState, useEffect, useRef } from 'react'
import { api, type HaulitOrder, type HealthScore, CARGO_THRESHOLDS } from '../lib/api'
import ReturnModal from '../components/ReturnModal'
import PartnerAvailabilityDashboard from '../components/PartnerAvailabilityDashboard'

const STATUS_FLOW = [
  'pending',
  'assigned',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
]

function statusIcon(s: string) {
  return (
    {
      pending:          'receipt_long',
      assigned:         'person_pin',
      picked_up:        'inventory',
      in_transit:       'local_shipping',
      out_for_delivery: 'delivery_dining',
      delivered:        'check_circle',
      cancelled:        'cancel',
    }[s] ?? 'help'
  )
}

function riskColor(risk: HealthScore['risk_level']) {
  return {
    good:     '#10b981',
    moderate: '#f59e0b',
    high:     '#ea580c',
    critical: '#bc001f',
  }[risk]
}

function MiniGauge({ score, risk }: { score: number; risk: HealthScore['risk_level'] }) {
  const r      = 28
  const circ   = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color  = riskColor(risk)

  return (
    <svg width="70" height="70" viewBox="0 0 70 70">
      <circle cx="35" cy="35" r={r} fill="none" stroke="#aeaec0" strokeWidth="6" strokeOpacity="0.25" />
      <circle
        cx="35" cy="35" r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={`${circ}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 35 35)"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
      <text x="35" y="32" textAnchor="middle" fontSize="12" fontWeight="800" fill={color}>{Math.round(score)}</text>
      <text x="35" y="43" textAnchor="middle" fontSize="8" fill="#585e6c">/ 100</text>
    </svg>
  )
}

interface SensorState {
  vibration: number
  temperature_c: number
  moisture_pct: number
}

interface OrderPanelProps {
  order: HaulitOrder
  onRefresh: () => void
  onOpenReturn: (order: HaulitOrder) => void
}

function getThresholdHint(cargoType: string, field: 'vibration' | 'temperature_c' | 'moisture_pct'): string {
  const t = CARGO_THRESHOLDS[cargoType] ?? CARGO_THRESHOLDS['standard']
  const cargo = cargoType.charAt(0).toUpperCase() + cargoType.slice(1)
  switch (field) {
    case 'vibration':
      return t.vibration_min > 0
        ? `${cargo} safe range: ${t.vibration_min}–${t.vibration_max} g`
        : `${cargo} safe range: 0–${t.vibration_max} g`
    case 'temperature_c':
      return `${cargo} safe range: ${t.temp_min}–${t.temp_max} °C`
    case 'moisture_pct':
      return t.moisture_min > 0
        ? `${cargo} safe range: ${t.moisture_min}–${t.moisture_max}% RH`
        : `${cargo} safe range: 0–${t.moisture_max}% RH`
  }
}

function isOutOfRange(
  cargoType: string,
  field: 'vibration' | 'temperature_c' | 'moisture_pct',
  value: number
): boolean {
  const t = CARGO_THRESHOLDS[cargoType] ?? CARGO_THRESHOLDS['standard']
  switch (field) {
    case 'vibration':
      return value > t.vibration_max || (t.vibration_min > 0 && value < t.vibration_min)
    case 'temperature_c':
      return value < t.temp_min || value > t.temp_max
    case 'moisture_pct':
      return value > t.moisture_max || (t.moisture_min > 0 && value < t.moisture_min)
  }
}

function randomInRange(
  cargoType: string,
  field: 'vibration' | 'temperature_c' | 'moisture_pct',
  current: number
): number {
  const t = CARGO_THRESHOLDS[cargoType] ?? CARGO_THRESHOLDS['standard']
  let min: number, max: number, step: number
  switch (field) {
    case 'vibration':
      min = t.vibration_min; max = t.vibration_max; step = 0.01
      break
    case 'temperature_c':
      min = t.temp_min; max = t.temp_max; step = 0.5
      break
    case 'moisture_pct':
      min = t.moisture_min; max = t.moisture_max; step = 1
      break
  }

  const jitter = (Math.random() - 0.5) * (max - min) * 0.12
  const raw = current + jitter
  const clamped = Math.max(min, Math.min(max, raw))
  return parseFloat((Math.round(clamped / step) * step).toFixed(2))
}

function OrderPanel({ order, onRefresh, onOpenReturn }: OrderPanelProps) {
  const cargoType = order.cargo_type?.toLowerCase() ?? 'standard'
  const thresholds = CARGO_THRESHOLDS[cargoType] ?? CARGO_THRESHOLDS['standard']

  const [sensor, setSensor] = useState<SensorState>({
    vibration:     parseFloat(((thresholds.vibration_min + thresholds.vibration_max) / 2).toFixed(2)),
    temperature_c: parseFloat(((thresholds.temp_min + thresholds.temp_max) / 2).toFixed(1)),
    moisture_pct:  parseFloat(((thresholds.moisture_min + thresholds.moisture_max) / 2).toFixed(0)),
  })
  const [health, setHealth]     = useState<HealthScore | null>(order.latest_health)
  const [sending, setSending]   = useState(false)
  const [advancing, setAdv]     = useState(false)
  const [autoMode, setAuto]     = useState(false)
  const [log, setLog]           = useState<string[]>([])
  const autoRef                 = useRef<ReturnType<typeof setInterval> | null>(null)
  const logEnd                  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log])

  useEffect(() => {
    return () => { if (autoRef.current) clearInterval(autoRef.current) }
  }, [])

  function addLog(msg: string) {
    const ts = new Date().toLocaleTimeString('en-IN')
    setLog(prev => [...prev.slice(-49), `[${ts}] ${msg}`])
  }

  async function sendSensor(data: SensorState) {
    setSending(true)
    try {
      const res = await api.orders.ingestSensor(order.track_id, data)
      setHealth(res.health)
      addLog(
        `Sensor sent | vib=${data.vibration}g  temp=${data.temperature_c}°C  moist=${data.moisture_pct}% ` +
        `→ health=${res.health.score.toFixed(1)} [${res.health.risk_level}]`
      )
    } catch (e: unknown) {
      addLog(`ERROR sending sensor: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSending(false)
    }
  }

  async function advanceStatus() {
    const idx  = STATUS_FLOW.indexOf(order.status)
    const next = STATUS_FLOW[idx + 1]
    if (!next) return
    setAdv(true)
    try {
      await api.orders.updateStatus(order.track_id, next)
      addLog(`Status updated: ${order.status} → ${next}`)
      onRefresh()
    } catch (e: unknown) {
      addLog(`ERROR updating status: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setAdv(false)
    }
  }

  function toggleAuto() {
    if (autoMode) {
      if (autoRef.current) clearInterval(autoRef.current)
      autoRef.current = null
      setAuto(false)
      addLog('Auto-simulation stopped.')
    } else {
      setAuto(true)
      addLog(`Auto-simulation started (every 5s) — values clamped to ${cargoType} safe range.`)
      autoRef.current = setInterval(() => {
        setSensor(prev => {
          const next: SensorState = {
            vibration:     randomInRange(cargoType, 'vibration',     prev.vibration),
            temperature_c: randomInRange(cargoType, 'temperature_c', prev.temperature_c),
            moisture_pct:  randomInRange(cargoType, 'moisture_pct',  prev.moisture_pct),
          }
          sendSensor(next)
          return next
        })
      }, 5000)
    }
  }

  const nextStatus  = STATUS_FLOW[STATUS_FLOW.indexOf(order.status) + 1]
  const isDelivered = order.status === 'delivered'
  const isCancelled = order.status === 'cancelled'

  function healthStatusLabel(h: HealthScore): { label: string; color: string; bg: string } | null {
    if (h.risk_level === 'critical') return { label: '⚠ CRITICAL HEALTH', color: 'text-white', bg: 'bg-[#bc001f]' }
    if (h.risk_level === 'high')     return { label: '⚠ DANGEROUS', color: 'text-white', bg: 'bg-orange-600' }
    return null
  }

  const healthAlert = health ? healthStatusLabel(health) : null

  return (
    <div className="bg-[var(--color-surface-bg)] rounded-3xl neo-shadow p-6 space-y-6 border border-[var(--color-surface-container-highest)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)]">
              {order.vehicle?.name ?? (order.truck_type ? `${order.truck_type} Truck` : 'No vehicle assigned')}
            </p>
            {order.truck_type && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gray-100 text-gray-700">
                {order.truck_type}
              </span>
            )}
          </div>
          <p className="text-[var(--text-headline-md)] font-black text-[var(--color-primary)] tracking-widest font-mono">
            {order.track_id}
          </p>
          <p className="text-[var(--text-body-md)] text-[var(--color-secondary)] mt-0.5">
            {order.pickup} → {order.delivery} · {order.weight_kg} kg · <span className="capitalize">{order.cargo_type}</span>
            {order.price ? <span className="ml-2 font-bold font-mono text-[var(--color-on-surface)]">· ₹{order.price.toFixed(2)}/-</span> : null}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {health && <MiniGauge score={health.score} risk={health.risk_level} />}
          <div className="flex flex-col items-end gap-1">
            <span className={`px-4 py-1.5 rounded-full text-[var(--text-label-md)] tracking-widest uppercase font-bold neo-shadow-inner ${
              isCancelled ? 'text-[var(--color-error)]' : isDelivered ? 'text-emerald-600' : 'text-[var(--color-primary)]'
            }`}>
              <span className="material-symbols-outlined text-sm align-middle mr-1">{statusIcon(order.status)}</span>
              {order.status.replace(/_/g, ' ')}
            </span>
            {healthAlert && (
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider animate-pulse ${healthAlert.color} ${healthAlert.bg}`}>
                {healthAlert.label}
              </span>
            )}
          </div>
        </div>
      </div>

      {isCancelled && (
        <div className="neo-shadow-inner rounded-2xl p-4 bg-red-50/70 border border-red-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-[var(--color-error)] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">assignment_return</span>
              Return Processed ({order.return_reason === 'company_fault' ? 'Company Fault - 90% Refund' : 'Customer Cancel - 50% Refund'})
            </p>
            <p className="text-xs text-[var(--color-secondary)] mt-0.5">
              Policy agreement recorded. No damage payment from Haulit.
            </p>
          </div>
          {order.refund_amount !== undefined && order.refund_amount !== null && (
            <div className="text-right">
              <span className="text-xs text-[var(--color-secondary)] block">Refund Credited</span>
              <span className="text-lg font-black text-emerald-600 font-mono">
                ₹{order.refund_amount.toFixed(2)}/-
              </span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(
          [
            { key: 'vibration',     label: 'Vibration (g)',    min: -5,  max: 5,   step: 0.05, icon: 'vibration'  },
            { key: 'temperature_c', label: 'Temperature (°C)', min: -50, max: 80,  step: 0.5,  icon: 'thermostat' },
            { key: 'moisture_pct',  label: 'Moisture (%)',     min: 0,   max: 100, step: 1,    icon: 'water_drop' },
          ] as const
        ).map(field => {
          const val     = sensor[field.key]
          const oor     = isOutOfRange(cargoType, field.key, val)
          const hint    = getThresholdHint(cargoType, field.key)
          return (
            <div key={field.key} className={`neo-shadow-inner rounded-xl p-4 ${oor ? 'ring-2 ring-[var(--color-error)]/60' : ''}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`material-symbols-outlined text-sm ${oor ? 'text-[var(--color-error)]' : 'text-[var(--color-primary)]'}`}>{field.icon}</span>
                <label className={`text-[var(--text-label-md)] tracking-widest uppercase font-bold ${oor ? 'text-[var(--color-error)]' : 'text-[var(--color-on-surface-variant)]'}`}>
                  {field.label}
                </label>
                {oor && (
                  <span className="ml-auto text-[9px] font-black uppercase tracking-wider text-white bg-[var(--color-error)] rounded px-1.5 py-0.5 animate-pulse">
                    OUT OF RANGE
                  </span>
                )}
              </div>
              <p className="text-[10px] text-[var(--color-secondary)] mb-2 font-mono">
                ℹ {hint}
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={val}
                  onChange={e =>
                    setSensor(prev => ({ ...prev, [field.key]: parseFloat(e.target.value) }))
                  }
                  disabled={isCancelled || isDelivered}
                  className={`flex-1 ${oor ? 'accent-[var(--color-error)]' : 'accent-[var(--color-primary)]'}`}
                />
                <span className={`text-[var(--text-headline-md)] font-black w-16 text-right ${oor ? 'text-[var(--color-error)]' : 'text-[var(--color-on-surface)]'}`}>
                  {val}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => sendSensor(sensor)}
          disabled={sending || isDelivered || isCancelled}
          className="flex-1 min-w-[140px] bg-[var(--color-surface-bg)] text-[var(--color-primary)] text-[var(--text-label-md)] tracking-widest uppercase py-3.5 rounded-xl neo-shadow hover:neo-shadow-sm active:neo-shadow-inner transition-all duration-200 font-bold disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">{sending ? 'sync' : 'sensors'}</span>
          {sending ? 'Sending…' : 'Send Reading'}
        </button>

        <button
          onClick={toggleAuto}
          disabled={isDelivered || isCancelled}
          className={`flex-1 min-w-[140px] text-[var(--text-label-md)] tracking-widest uppercase py-3.5 rounded-xl transition-all duration-200 font-bold disabled:opacity-40 flex items-center justify-center gap-2 ${
            autoMode
              ? 'neo-shadow-inner text-[var(--color-primary)]'
              : 'neo-shadow text-[var(--color-secondary)] hover:neo-shadow-sm'
          } bg-[var(--color-surface-bg)]`}
          title={`Auto-generate values within ${cargoType} safe range every 5s`}
        >
          <span className="material-symbols-outlined text-sm">{autoMode ? 'pause' : 'play_arrow'}</span>
          {autoMode ? 'Stop Auto' : 'Auto (5s)'}
        </button>

        {nextStatus && !isCancelled && (
          <button
            onClick={advanceStatus}
            disabled={advancing}
            className="flex-1 min-w-[160px] bg-[var(--color-surface-bg)] text-emerald-600 text-[var(--text-label-md)] tracking-widest uppercase py-3.5 rounded-xl neo-shadow hover:neo-shadow-sm active:neo-shadow-inner transition-all duration-200 font-bold disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">arrow_circle_right</span>
            {advancing ? 'Updating…' : `Mark ${nextStatus.replace(/_/g, ' ')}`}
          </button>
        )}

        {!isCancelled && !isDelivered && (
          <button
            onClick={() => onOpenReturn(order)}
            className="flex-1 min-w-[150px] bg-[var(--color-surface-bg)] text-[var(--color-error)] text-[var(--text-label-md)] tracking-widest uppercase py-3.5 rounded-xl neo-shadow hover:neo-shadow-sm active:neo-shadow-inner transition-all duration-200 font-bold flex items-center justify-center gap-2"
            title="Request Return or Cancellation"
          >
            <span className="material-symbols-outlined text-sm">assignment_return</span>
            <span>Return Order</span>
          </button>
        )}
      </div>

      {health && health.detail?.violations && health.detail.violations.length > 0 && (
        <div className="neo-shadow-inner rounded-xl p-4 space-y-1">
          <p className="text-[var(--text-label-md)] tracking-widest uppercase font-bold text-[var(--color-error)] mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">warning</span>
            AI Alerts
          </p>
          {health.detail.violations.map((v, i) => (
            <p key={i} className="text-sm text-[var(--color-on-surface)]">{v}</p>
          ))}
        </div>
      )}

      <div className="neo-shadow-inner rounded-xl p-3 h-32 overflow-y-auto font-mono">
        {log.length === 0 && (
          <p className="text-[var(--text-label-md)] text-[var(--color-secondary)] opacity-50">Truck log will appear here…</p>
        )}
        {log.map((l, i) => (
          <p key={i} className={`text-xs leading-5 ${
            l.includes('ERROR') ? 'text-[var(--color-error)]' :
            l.includes('critical') ? 'text-orange-500' :
            l.includes('health=') ? 'text-emerald-600' :
            'text-[var(--color-on-surface-variant)]'
          }`}>{l}</p>
        ))}
        <div ref={logEnd} />
      </div>
    </div>
  )
}

export default function Dashboard(): React.ReactElement {
  const [activeTab, setActiveTab]             = useState<'availability' | 'simulator'>('availability')
  const [orders, setOrders]                   = useState<HaulitOrder[]>([])
  const [trackInput, setTrackInput]           = useState('')
  const [addError, setAddError]               = useState('')
  const [adding, setAdding]                   = useState(false)
  const [selectedReturnOrder, setReturnOrder] = useState<HaulitOrder | null>(null)

  async function refreshOrder(trackId: string) {
    try {
      const res = await api.orders.track(trackId)
      setOrders(prev =>
        prev.map(o => o.track_id === trackId ? res.order : o)
      )
    } catch {}
  }

  async function addByTrackId() {
    const id = trackInput.trim().toUpperCase()
    if (!id) return
    if (orders.find(o => o.track_id === id)) {
      setAddError('Already in dashboard.')
      return
    }
    setAdding(true)
    setAddError('')
    try {
      const res = await api.orders.track(id)
      setOrders(prev => [res.order, ...prev])
      setTrackInput('')
    } catch {
      setAddError('Track ID not found.')
    } finally {
      setAdding(false)
    }
  }

  function removeOrder(trackId: string) {
    setOrders(prev => prev.filter(o => o.track_id !== trackId))
  }

  return (
    <>
      {selectedReturnOrder && (
        <ReturnModal
          order={selectedReturnOrder}
          onClose={() => setReturnOrder(null)}
          onSuccess={updated => {
            setOrders(prev => prev.map(o => o.track_id === updated.track_id ? updated : o))
          }}
        />
      )}

      <div className="bg-[var(--color-surface-bg)] text-[var(--color-on-background)] antialiased min-h-screen font-sans">
        <main className="max-w-[var(--spacing-container-max-width)] mx-auto px-[var(--spacing-gutter)] py-12 space-y-8">

          <div className="flex flex-wrap items-center justify-between gap-6 pb-2">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full neo-shadow-inner text-xs font-bold uppercase tracking-widest text-[var(--color-primary)] mb-2">
                <span className="material-symbols-outlined text-sm">dashboard</span>
                Operations Command
              </div>
              <h1 className="text-[var(--text-headline-xl-mobile)] md:text-[var(--text-headline-lg)] font-extrabold leading-tight">
                {activeTab === 'availability' ? 'Partner Availability Management' : 'Truck Telemetry & Simulator'}
              </h1>
              <p className="text-[var(--text-body-md)] text-[var(--color-on-surface-variant)] mt-1">
                {activeTab === 'availability'
                  ? 'Manage third-party logistics truck availability, schedule maintenance & outside direct bookings, and monitor fleet readiness.'
                  : 'Simulate sensor readings, advance order status, and process return requests.'}
              </p>
            </div>

            <div className="flex items-center gap-2 bg-[var(--color-surface-bg)] p-1.5 rounded-full neo-shadow-inner">
              <button
                type="button"
                onClick={() => setActiveTab('availability')}
                className={`px-5 py-2.5 rounded-full text-xs font-black tracking-widest uppercase transition-all flex items-center gap-2 ${
                  activeTab === 'availability'
                    ? 'bg-[var(--color-surface-bg)] neo-shadow text-[var(--color-primary)]'
                    : 'text-[var(--color-secondary)] hover:text-[var(--color-on-surface)]'
                }`}
              >
                <span className="material-symbols-outlined text-sm">schedule</span>
                Partner Availability
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('simulator')}
                className={`px-5 py-2.5 rounded-full text-xs font-black tracking-widest uppercase transition-all flex items-center gap-2 ${
                  activeTab === 'simulator'
                    ? 'bg-[var(--color-surface-bg)] neo-shadow text-[var(--color-primary)]'
                    : 'text-[var(--color-secondary)] hover:text-[var(--color-on-surface)]'
                }`}
              >
                <span className="material-symbols-outlined text-sm">sensors</span>
                Order Simulator
              </button>
            </div>
          </div>

          {activeTab === 'availability' && (
            <PartnerAvailabilityDashboard />
          )}

          {activeTab === 'simulator' && (
            <div className="space-y-8">
              <div className="bg-[var(--color-surface-bg)] rounded-3xl neo-shadow p-6 border border-[var(--color-surface-container-highest)]">
                <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-3 font-bold">
                  Add Order by Track ID
                </p>
                <div className="flex gap-3 flex-wrap">
                  <input
                    type="text"
                    value={trackInput}
                    onChange={e => setTrackInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addByTrackId()}
                    placeholder="HLT-XXXX-IN"
                    className="flex-1 min-w-[180px] bg-[var(--color-surface-bg)] border-none neo-shadow-inner focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 rounded-xl px-4 py-3 text-[var(--text-body-md)] text-[var(--color-on-surface)] uppercase tracking-widest transition-all font-mono"
                  />
                  <button
                    onClick={addByTrackId}
                    disabled={adding}
                    className="bg-[var(--color-surface-bg)] text-[var(--color-primary)] text-[var(--text-label-md)] tracking-widest uppercase px-6 py-3 rounded-xl neo-shadow hover:neo-shadow-sm active:neo-shadow-inner transition-all duration-200 font-bold disabled:opacity-40 flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    {adding ? 'Adding…' : 'Add'}
                  </button>
                </div>
                {addError && (
                  <p className="text-[var(--color-error)] text-[var(--text-label-md)] mt-2">{addError}</p>
                )}
              </div>

              {orders.length === 0 && (
                <div className="bg-[var(--color-surface-bg)] rounded-3xl neo-shadow p-16 flex flex-col items-center text-center gap-4 border border-[var(--color-surface-container-highest)]">
                  <span className="material-symbols-outlined text-5xl text-[var(--color-secondary)] opacity-40">local_shipping</span>
                  <p className="text-[var(--text-headline-md)] font-semibold text-[var(--color-on-surface-variant)]">No active orders</p>
                  <p className="text-[var(--text-body-md)] text-[var(--color-secondary)]">
                    Login and place an order, or paste a track ID above.
                  </p>
                </div>
              )}

              <div className="space-y-6">
                {orders.map(order => (
                  <div key={order.track_id} className="relative">
                    <button
                      onClick={() => removeOrder(order.track_id)}
                      className="absolute -top-2 -right-2 z-10 w-8 h-8 rounded-full bg-[var(--color-surface-bg)] neo-shadow flex items-center justify-center text-[var(--color-secondary)] hover:text-[var(--color-error)] transition-colors"
                      title="Remove from dashboard"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                    <OrderPanel
                      order={order}
                      onRefresh={() => refreshOrder(order.track_id)}
                      onOpenReturn={o => setReturnOrder(o)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>
      </div>
    </>
  )
}
