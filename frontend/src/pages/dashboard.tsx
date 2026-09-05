import React, { useState, useEffect, useRef } from 'react'
import { api, type HaulitOrder, type HealthScore } from '../lib/api'

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
}

function OrderPanel({ order, onRefresh }: OrderPanelProps) {
  const [sensor, setSensor] = useState<SensorState>({
    vibration:     0.2,
    temperature_c: 22,
    moisture_pct:  25,
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
      addLog('Auto-simulation started (every 5s).')
      autoRef.current = setInterval(() => {
        const jitter = (base: number, range: number) =>
          parseFloat(Math.max(0, base + (Math.random() - 0.5) * range).toFixed(2))
        const next: SensorState = {
          vibration:     jitter(sensor.vibration,     0.4),
          temperature_c: jitter(sensor.temperature_c, 6),
          moisture_pct:  jitter(sensor.moisture_pct,  10),
        }
        setSensor(next)
        sendSensor(next)
      }, 5000)
    }
  }

  const nextStatus  = STATUS_FLOW[STATUS_FLOW.indexOf(order.status) + 1]
  const isDelivered = order.status === 'delivered'

  return (
    <div className="bg-[var(--color-surface-bg)] rounded-2xl neo-shadow p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)]">
            {order.vehicle?.name ?? 'No vehicle assigned'}
          </p>
          <p className="text-[var(--text-headline-md)] font-black text-[var(--color-primary)] tracking-widest">
            {order.track_id}
          </p>
          <p className="text-[var(--text-body-md)] text-[var(--color-secondary)] mt-0.5">
            {order.pickup} → {order.delivery} · {order.weight_kg} kg · <span className="capitalize">{order.cargo_type}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {health && <MiniGauge score={health.score} risk={health.risk_level} />}
          <span className={`px-3 py-1.5 rounded-full text-[var(--text-label-md)] tracking-widest uppercase font-bold neo-shadow-inner ${
            isDelivered ? 'text-emerald-600' : 'text-[var(--color-primary)]'
          }`}>
            <span className="material-symbols-outlined text-sm align-middle mr-1">{statusIcon(order.status)}</span>
            {order.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(
          [
            { key: 'vibration',     label: 'Vibration (g)',  min: 0,   max: 5,   step: 0.05, icon: 'vibration'  },
            { key: 'temperature_c', label: 'Temperature (°C)', min: -10, max: 70,  step: 0.5,  icon: 'thermostat' },
            { key: 'moisture_pct',  label: 'Moisture (%)',   min: 0,   max: 100, step: 1,    icon: 'water_drop' },
          ] as const
        ).map(field => (
          <div key={field.key} className="neo-shadow-inner rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-[var(--color-primary)] text-sm">{field.icon}</span>
              <label className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)]">
                {field.label}
              </label>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={field.min}
                max={field.max}
                step={field.step}
                value={sensor[field.key]}
                onChange={e =>
                  setSensor(prev => ({ ...prev, [field.key]: parseFloat(e.target.value) }))
                }
                className="flex-1 accent-[var(--color-primary)]"
              />
              <span className="text-[var(--text-headline-md)] font-black text-[var(--color-on-surface)] w-16 text-right">
                {sensor[field.key]}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => sendSensor(sensor)}
          disabled={sending || isDelivered}
          className="flex-1 min-w-[140px] bg-[var(--color-surface-bg)] text-[var(--color-primary)] text-[var(--text-label-md)] tracking-widest uppercase py-3 rounded-lg neo-shadow hover:neo-shadow-sm active:neo-shadow-inner transition-all duration-200 font-bold disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">{sending ? 'sync' : 'sensors'}</span>
          {sending ? 'Sending…' : 'Send Reading'}
        </button>

        <button
          onClick={toggleAuto}
          disabled={isDelivered}
          className={`flex-1 min-w-[140px] text-[var(--text-label-md)] tracking-widest uppercase py-3 rounded-lg transition-all duration-200 font-bold disabled:opacity-40 flex items-center justify-center gap-2 ${
            autoMode
              ? 'neo-shadow-inner text-[var(--color-primary)]'
              : 'neo-shadow text-[var(--color-secondary)] hover:neo-shadow-sm'
          } bg-[var(--color-surface-bg)]`}
        >
          <span className="material-symbols-outlined text-sm">{autoMode ? 'pause' : 'play_arrow'}</span>
          {autoMode ? 'Stop Auto' : 'Auto (5s)'}
        </button>

        {nextStatus && (
          <button
            onClick={advanceStatus}
            disabled={advancing}
            className="flex-1 min-w-[160px] bg-[var(--color-surface-bg)] text-emerald-600 text-[var(--text-label-md)] tracking-widest uppercase py-3 rounded-lg neo-shadow hover:neo-shadow-sm active:neo-shadow-inner transition-all duration-200 font-bold disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">arrow_circle_right</span>
            {advancing ? 'Updating…' : `Mark ${nextStatus.replace(/_/g, ' ')}`}
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
  const [orders, setOrders]         = useState<HaulitOrder[]>([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [trackInput, setTrackInput] = useState('')
  const [addError, setAddError]     = useState('')
  const [adding, setAdding]         = useState(false)

  async function fetchMyOrders() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('haulit_token') : null
    if (!token) {
      setError('Please login to view your orders.')
      return
    }
    setLoading(true)
    try {
      const res = await api.orders.myOrders()
      setOrders(res.orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled'))
      setError('')
    } catch {
      setError('Could not load orders. Are you logged in?')
    } finally {
      setLoading(false)
    }
  }

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

  useEffect(() => {
    fetchMyOrders()
  }, [])

  return (
    <div className="bg-[var(--color-surface-bg)] text-[var(--color-on-background)] antialiased min-h-screen font-sans">
      <main className="max-w-[var(--spacing-container-max-width)] mx-auto px-[var(--spacing-gutter)] py-12 space-y-8">

        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="text-[var(--text-headline-xl-mobile)] md:text-[var(--text-headline-lg)] font-extrabold leading-tight">
              Truck Dashboard
            </h1>
            <p className="text-[var(--text-body-md)] text-[var(--color-on-surface-variant)] mt-1">
              Simulate sensor readings and advance order status in real-time.
            </p>
          </div>
          <button
            onClick={fetchMyOrders}
            disabled={loading}
            className="bg-[var(--color-surface-bg)] text-[var(--color-secondary)] text-[var(--text-label-md)] tracking-widest uppercase px-5 py-2.5 rounded-full neo-shadow hover:neo-shadow-sm active:neo-shadow-inner transition-all duration-200 font-bold flex items-center gap-2 disabled:opacity-40"
          >
            <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>refresh</span>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        <div className="bg-[var(--color-surface-bg)] rounded-2xl neo-shadow p-6">
          <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-3">
            Add Order by Track ID
          </p>
          <div className="flex gap-3 flex-wrap">
            <input
              type="text"
              value={trackInput}
              onChange={e => setTrackInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addByTrackId()}
              placeholder="HLT-XXXX-IN"
              className="flex-1 min-w-[180px] bg-[var(--color-surface-bg)] border-none neo-shadow-inner focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 rounded-lg px-4 py-3 text-[var(--text-body-md)] text-[var(--color-on-surface)] uppercase tracking-widest transition-all"
            />
            <button
              onClick={addByTrackId}
              disabled={adding}
              className="bg-[var(--color-surface-bg)] text-[var(--color-primary)] text-[var(--text-label-md)] tracking-widest uppercase px-6 py-3 rounded-lg neo-shadow hover:neo-shadow-sm active:neo-shadow-inner transition-all duration-200 font-bold disabled:opacity-40 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              {adding ? 'Adding…' : 'Add'}
            </button>
          </div>
          {addError && (
            <p className="text-[var(--color-error)] text-[var(--text-label-md)] mt-2">{addError}</p>
          )}
        </div>

        {error && (
          <div className="neo-shadow-inner rounded-xl p-4 text-center text-[var(--color-error)] text-[var(--text-label-md)]">
            {error}
          </div>
        )}

        {orders.length === 0 && !loading && !error && (
          <div className="bg-[var(--color-surface-bg)] rounded-2xl neo-shadow p-16 flex flex-col items-center text-center gap-4">
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
                className="absolute -top-2 -right-2 z-10 w-7 h-7 rounded-full bg-[var(--color-surface-bg)] neo-shadow-sm flex items-center justify-center text-[var(--color-secondary)] hover:text-[var(--color-error)] transition-colors"
                title="Remove from dashboard"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
              <OrderPanel
                order={order}
                onRefresh={() => refreshOrder(order.track_id)}
              />
            </div>
          ))}
        </div>

      </main>
    </div>
  )
}
