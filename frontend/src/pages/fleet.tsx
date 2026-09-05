import React, { useState, useEffect, useRef } from 'react'
import { api, type FleetVehicle, type FleetSummary } from '../lib/api'

const CARGO_ICON: Record<string, string> = {
  standard:  'inventory_2',
  fragile:   'ac_unit',
  hazmat:    'warning',
  oversized: 'local_shipping',
}

function statusStyle(status: string) {
  return {
    idle:       { dot: 'bg-emerald-400', badge: 'text-emerald-600', label: 'Idle'       },
    assigned:   { dot: 'bg-amber-400',   badge: 'text-amber-600',   label: 'Assigned'   },
    in_transit: { dot: 'bg-[var(--color-primary)]', badge: 'text-[var(--color-primary)]', label: 'In Transit' },
  }[status] ?? { dot: 'bg-gray-400', badge: 'text-gray-500', label: status }
}

function capacityLabel(kg: number) {
  if (kg >= 99000) return '> 15,000 kg'
  return `≤ ${kg.toLocaleString()} kg`
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

function CapacityBar({ kg }: { kg: number }) {
  const max   = 99999
  const pct   = Math.min((kg / max) * 100, 100)
  const color =
    kg <= 250   ? '#10b981' :
    kg <= 1500  ? '#3b82f6' :
    kg <= 5000  ? '#f59e0b' :
    kg <= 15000 ? '#f97316' : '#bc001f'

  return (
    <div className="w-full mt-2">
      <div className="flex justify-between mb-1">
        <span className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)]">
          Capacity
        </span>
        <span className="text-[var(--text-label-md)] font-bold text-[var(--color-on-surface)]">
          {capacityLabel(kg)}
        </span>
      </div>
      <div className="w-full h-2 rounded-full bg-[var(--color-surface-bg)] neo-shadow-inner overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.max(pct, 4)}%`, background: color }}
        />
      </div>
    </div>
  )
}

function VehicleCard({ vehicle }: { vehicle: FleetVehicle }) {
  const st    = statusStyle(vehicle.status)
  const order = vehicle.active_order

  return (
    <div className="bg-[var(--color-surface-bg)] rounded-2xl neo-shadow p-6 flex flex-col gap-4 transition-all duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-[var(--color-surface-bg)] neo-shadow flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[var(--color-primary)]">local_shipping</span>
          </div>
          <div>
            <p className="font-bold text-[var(--color-on-surface)] leading-tight">{vehicle.name}</p>
            <p className="text-[var(--text-label-md)] text-[var(--color-secondary)] flex items-center gap-1 mt-0.5">
              <span className="material-symbols-outlined text-xs">location_on</span>
              {vehicle.current_location}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 neo-shadow-inner rounded-full px-3 py-1.5 shrink-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot} ${vehicle.status === 'in_transit' ? 'animate-pulse' : ''}`} />
          <span className={`text-[var(--text-label-md)] tracking-widest uppercase font-bold ${st.badge}`}>
            {st.label}
          </span>
        </div>
      </div>

      <CapacityBar kg={vehicle.capacity_kg} />

      <div className="flex items-center justify-between text-[var(--text-label-md)] text-[var(--color-secondary)]">
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-xs">speed</span>
          {vehicle.avg_speed_kmh} km/h avg
        </span>
        <span className="font-mono text-xs opacity-60">ID #{vehicle.id}</span>
      </div>

      {order ? (
        <div className="neo-shadow-inner rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)]">
              Active Order
            </span>
            <span className="font-black text-[var(--color-primary)] tracking-widest text-sm">
              {order.track_id}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[var(--text-body-md)]">
            <span className="material-symbols-outlined text-sm text-[var(--color-secondary)]">my_location</span>
            <span className="text-[var(--color-on-surface)] font-medium truncate">{order.pickup}</span>
            <span className="material-symbols-outlined text-sm text-[var(--color-secondary)] shrink-0">arrow_forward</span>
            <span className="text-[var(--color-on-surface)] font-medium truncate">{order.delivery}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="flex items-center gap-1 neo-shadow-inner rounded-lg px-2.5 py-1 text-[var(--text-label-md)] text-[var(--color-secondary)]">
              <span className="material-symbols-outlined text-xs">weight</span>
              {order.weight_kg} kg
            </span>
            <span className="flex items-center gap-1 neo-shadow-inner rounded-lg px-2.5 py-1 text-[var(--text-label-md)] text-[var(--color-secondary)] capitalize">
              <span className="material-symbols-outlined text-xs">{CARGO_ICON[order.cargo_type] ?? 'inventory_2'}</span>
              {order.cargo_type}
            </span>
            <span className={`flex items-center gap-1 neo-shadow-inner rounded-lg px-2.5 py-1 text-[var(--text-label-md)] font-bold capitalize ${
              order.status === 'in_transit' ? 'text-[var(--color-primary)]' :
              order.status === 'picked_up'  ? 'text-amber-600' : 'text-[var(--color-secondary)]'
            }`}>
              <span className="material-symbols-outlined text-xs">local_shipping</span>
              {order.status.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[var(--text-label-md)] text-[var(--color-secondary)]">
            <span className="material-symbols-outlined text-xs">schedule</span>
            ETA: <span className="font-semibold text-[var(--color-on-surface)] ml-1">{fmt(order.eta)}</span>
          </div>
        </div>
      ) : (
        <div className="neo-shadow-inner rounded-xl p-4 flex items-center gap-3 opacity-50">
          <span className="material-symbols-outlined text-[var(--color-secondary)]">hourglass_empty</span>
          <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-secondary)]">
            No active order
          </p>
        </div>
      )}
    </div>
  )
}

function StatCard({
  icon, label, value, color,
}: { icon: string; label: string; value: number; color: string }) {
  return (
    <div className="bg-[var(--color-surface-bg)] rounded-2xl neo-shadow p-6 flex items-center gap-5">
      <div className="w-14 h-14 rounded-full bg-[var(--color-surface-bg)] neo-shadow flex items-center justify-center shrink-0">
        <span className={`material-symbols-outlined text-2xl ${color}`}>{icon}</span>
      </div>
      <div>
        <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)]">{label}</p>
        <p className={`text-[var(--text-headline-lg)] font-black leading-none mt-0.5 ${color}`}>{value}</p>
      </div>
    </div>
  )
}

type FilterStatus = 'all' | 'idle' | 'assigned' | 'in_transit'

export default function Fleet(): React.ReactElement {
  const [vehicles, setVehicles]   = useState<FleetVehicle[]>([])
  const [summary, setSummary]     = useState<FleetSummary | null>(null)
  const [filter, setFilter]       = useState<FilterStatus>('all')
  const [lastUpdated, setLast]    = useState<Date | null>(null)
  const [error, setError]         = useState('')
  const pollRef                   = useRef<ReturnType<typeof setInterval> | null>(null)

  async function fetchFleet() {
    try {
      const res = await api.vehicles.fleet()
      setVehicles(res.vehicles)
      setSummary(res.summary)
      setLast(new Date())
      setError('')
    } catch {
      setError('Could not reach the backend. Is the Flask server running?')
    }
  }

  useEffect(() => {
    fetchFleet()
    pollRef.current = setInterval(fetchFleet, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const displayed = filter === 'all'
    ? vehicles
    : vehicles.filter(v => v.status === filter)

  const FILTERS: { key: FilterStatus; label: string }[] = [
    { key: 'all',        label: 'All'        },
    { key: 'idle',       label: 'Idle'       },
    { key: 'assigned',   label: 'Assigned'   },
    { key: 'in_transit', label: 'In Transit' },
  ]

  return (
    <div className="bg-[var(--color-surface-bg)] text-[var(--color-on-background)] antialiased min-h-screen font-sans">
      <main className="max-w-[var(--spacing-container-max-width)] mx-auto px-[var(--spacing-gutter)] py-12 space-y-8">

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[var(--text-headline-xl-mobile)] md:text-[var(--text-headline-lg)] font-extrabold leading-tight">
              Fleet Overview
            </h1>
            <p className="text-[var(--text-body-md)] text-[var(--color-on-surface-variant)] mt-1">
              All vehicles, capacities, and their current assignments.
            </p>
          </div>
          {lastUpdated && (
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-secondary)]">
                Live · {lastUpdated.toLocaleTimeString('en-IN')}
              </span>
            </div>
          )}
        </div>

        {error && (
          <div className="neo-shadow-inner rounded-xl p-4 text-center text-[var(--color-error)] text-[var(--text-label-md)]">
            {error}
          </div>
        )}

        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon="garage"         label="Total Vehicles" value={summary.total}      color="text-[var(--color-on-surface)]" />
            <StatCard icon="check_circle"   label="Idle"           value={summary.idle}       color="text-emerald-600"               />
            <StatCard icon="person_pin"     label="Assigned"       value={summary.assigned}   color="text-amber-600"                 />
            <StatCard icon="local_shipping" label="In Transit"     value={summary.in_transit} color="text-[var(--color-primary)]"    />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-5 py-2 rounded-full text-[var(--text-label-md)] tracking-widest uppercase font-bold transition-all duration-200 bg-[var(--color-surface-bg)] ${
                filter === f.key
                  ? 'neo-shadow-inner text-[var(--color-primary)]'
                  : 'neo-shadow text-[var(--color-secondary)] hover:neo-shadow-sm'
              }`}
            >
              {f.label}
              {summary && f.key !== 'all' && (
                <span className="ml-1.5 opacity-60">
                  ({summary[f.key as keyof FleetSummary]})
                </span>
              )}
              {f.key === 'all' && summary && (
                <span className="ml-1.5 opacity-60">({summary.total})</span>
              )}
            </button>
          ))}
        </div>

        {displayed.length === 0 && !error && (
          <div className="bg-[var(--color-surface-bg)] rounded-2xl neo-shadow p-16 flex flex-col items-center text-center gap-4">
            <span className="material-symbols-outlined text-5xl text-[var(--color-secondary)] opacity-40">local_shipping</span>
            <p className="text-[var(--text-headline-md)] font-semibold text-[var(--color-on-surface-variant)]">
              No vehicles in this category
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {displayed.map(v => (
            <VehicleCard key={v.id} vehicle={v} />
          ))}
        </div>

      </main>
    </div>
  )
}
