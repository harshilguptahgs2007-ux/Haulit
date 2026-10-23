import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { api, type FleetVehicle, type FleetSummary } from '../lib/api'

const CARGO_ICON: Record<string, string> = {
  standard:  'inventory_2',
  fragile:   'ac_unit',
  hazmat:    'warning',
  oversized: 'local_shipping',
}

const UNAVAILABILITY_OPTIONS = [
  'Medically unfit / driver unavailable',
  'Handling orders from companies outside HaulIt',
  'Truck under maintenance or repair',
  'Truck already assigned to another shipment',
  'Driver on leave / unavailable',
  'Personal or emergency commitment',
  'Other',
] as const

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

// -------------------------------------------------------------
// Modal: Why is this truck unavailable?
// -------------------------------------------------------------
interface WhyUnavailableModalProps {
  vehicle: FleetVehicle
  onClose: () => void
  onConfirm: (reasons: string[], otherText?: string) => Promise<void>
}

function WhyUnavailableModal({ vehicle, onClose, onConfirm }: WhyUnavailableModalProps) {
  const [selected, setSelected] = useState<string[]>([])
  const [otherText, setOtherText] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function toggleReason(r: string) {
    setError('')
    setSelected(prev =>
      prev.includes(r) ? prev.filter(item => item !== r) : [...prev, r]
    )
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (selected.length === 0) {
      setError('Please select at least one reason before confirming.')
      return
    }

    if (selected.includes('Other') && !otherText.trim() && selected.length === 1) {
      setError("Please specify the reason under 'Other'.")
      return
    }

    setLoading(true)
    try {
      await onConfirm(selected, otherText.trim() || undefined)
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to update truck availability')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(11,28,48,0.55)', backdropFilter: 'blur(8px)' }}
    >
      <div className="bg-[var(--color-surface-bg)] rounded-3xl p-6 sm:p-8 w-full max-w-lg mx-4 neo-shadow border border-[var(--color-surface-container-highest)] max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full neo-shadow-inner text-xs font-bold uppercase tracking-widest text-[var(--color-error)] mb-2">
              <span className="material-symbols-outlined text-sm">event_busy</span>
              Availability Management
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--color-on-surface)] leading-tight">
              Why is this truck unavailable?
            </h2>
            <p className="text-xs text-[var(--color-secondary)] mt-1">
              Select one or more reasons for <strong className="text-[var(--color-on-surface)]">{vehicle.name}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[var(--color-surface-bg)] neo-shadow flex items-center justify-center text-[var(--color-secondary)] hover:text-[var(--color-error)] transition-colors shrink-0"
            title="Cancel"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        {error && (
          <div className="neo-shadow-inner rounded-xl p-3.5 mb-5 text-xs text-[var(--color-error)] font-medium flex items-start gap-2 bg-red-50/50">
            <span className="material-symbols-outlined text-sm shrink-0">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleConfirm} className="space-y-4">
          <div className="space-y-2">
            {UNAVAILABILITY_OPTIONS.map(opt => {
              const isChecked = selected.includes(opt)
              const isOther = opt === 'Other'

              return (
                <div key={opt} className="space-y-2">
                  <label
                    onClick={() => toggleReason(opt)}
                    className={`w-full p-3.5 rounded-2xl flex items-center gap-3.5 cursor-pointer transition-all select-none ${
                      isChecked
                        ? 'neo-shadow-inner bg-[var(--color-surface-bg)] border border-[var(--color-error)]/40 font-bold text-[var(--color-on-surface)]'
                        : 'neo-shadow hover:neo-shadow-sm bg-[var(--color-surface-bg)] text-[var(--color-secondary)]'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center transition-all shrink-0 ${
                        isChecked
                          ? 'bg-[var(--color-error)] text-white neo-shadow-sm'
                          : 'neo-shadow-inner bg-[var(--color-surface-bg)] border border-gray-300'
                      }`}
                    >
                      {isChecked && <span className="material-symbols-outlined text-xs font-black">check</span>}
                    </div>
                    <span className="text-xs leading-relaxed flex-1">
                      {isOther ? 'Other (specify reason below)' : opt}
                    </span>
                  </label>

                  {/* Text field shown when Other is selected */}
                  {isOther && isChecked && (
                    <div className="pl-8 pr-1 pt-1 pb-2 animate-fadeIn">
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-[var(--color-secondary)] mb-1">
                        Please specify the reason:
                      </label>
                      <input
                        type="text"
                        value={otherText}
                        onChange={e => {
                          setOtherText(e.target.value)
                          setError('')
                        }}
                        placeholder="e.g. Awaiting spare parts, driver attending family emergency…"
                        autoFocus
                        className="w-full bg-[var(--color-surface-bg)] neo-shadow-inner rounded-xl px-3.5 py-2.5 text-xs text-[var(--color-on-surface)] border-none focus:outline-none focus:ring-2 focus:ring-[var(--color-error)]/40"
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <p className="text-[11px] text-[var(--color-secondary)] pt-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-xs text-[var(--color-primary)]">info</span>
            <span>This truck will be blocked from new bookings until marked available.</span>
          </p>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-surface-container-highest)]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl neo-shadow hover:neo-shadow-sm text-xs font-bold uppercase tracking-widest text-[var(--color-secondary)] transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl neo-shadow hover:neo-shadow-sm active:neo-shadow-inner text-xs font-black uppercase tracking-widest bg-[var(--color-error)] text-white hover:bg-red-700 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                  Saving…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">block</span>
                  Confirm
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// Modal: Confirm Mark Available
// -------------------------------------------------------------
interface ConfirmAvailableModalProps {
  vehicle: FleetVehicle
  onClose: () => void
  onConfirm: () => Promise<void>
}

function ConfirmAvailableModal({ vehicle, onClose, onConfirm }: ConfirmAvailableModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    setLoading(true)
    setError('')
    try {
      await onConfirm()
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to restore availability')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(11,28,48,0.55)', backdropFilter: 'blur(8px)' }}
    >
      <div className="bg-[var(--color-surface-bg)] rounded-3xl p-6 sm:p-8 w-full max-w-md mx-4 neo-shadow border border-[var(--color-surface-container-highest)]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 neo-shadow">
            <span className="material-symbols-outlined text-2xl">check_circle</span>
          </div>
          <div>
            <h3 className="text-lg font-black text-[var(--color-on-surface)] leading-tight">
              Mark Truck as Available?
            </h3>
            <p className="text-xs text-[var(--color-secondary)] mt-0.5 font-bold">
              {vehicle.name}
            </p>
          </div>
        </div>

        <p className="text-xs text-[var(--color-secondary)] leading-relaxed mb-6">
          Are you sure you want to mark this truck as <strong>Available</strong> again? Current unavailability reasons will be cleared, and this truck will be eligible for new booking recommendations.
        </p>

        {error && (
          <div className="neo-shadow-inner rounded-xl p-3 mb-4 text-xs text-[var(--color-error)] font-medium">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl neo-shadow hover:neo-shadow-sm text-xs font-bold uppercase tracking-widest text-[var(--color-secondary)] transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="px-6 py-2.5 rounded-xl neo-shadow hover:neo-shadow-sm active:neo-shadow-inner text-xs font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            {loading ? 'Restoring…' : 'Confirm Available'}
          </button>
        </div>
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// VehicleCard
// -------------------------------------------------------------
interface VehicleCardProps {
  vehicle: FleetVehicle
  onMarkNotAvailable: (vehicle: FleetVehicle) => void
  onMarkAvailable: (vehicle: FleetVehicle) => void
}

function VehicleCard({ vehicle, onMarkNotAvailable, onMarkAvailable }: VehicleCardProps) {
  const st      = statusStyle(vehicle.status)
  const order   = vehicle.active_order
  const isAvail = vehicle.is_available

  // Extract reasons from unavailability record or vehicle property
  const reasons: string[] =
    vehicle.unavailability_reasons && vehicle.unavailability_reasons.length > 0
      ? vehicle.unavailability_reasons
      : vehicle.current_unavailability?.reasons && vehicle.current_unavailability.reasons.length > 0
      ? vehicle.current_unavailability.reasons
      : vehicle.current_unavailability?.reason
      ? [vehicle.current_unavailability.reason]
      : []

  const reasonsTooltip = reasons.length > 0
    ? `Unavailable Reasons:\n• ${reasons.join('\n• ')}`
    : 'Truck is currently marked Not Available'

  return (
    <div
      className={`bg-[var(--color-surface-bg)] rounded-3xl neo-shadow p-6 flex flex-col justify-between gap-5 transition-all duration-300 border ${
        isAvail ? 'border-transparent' : 'border-red-400/30'
      }`}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[var(--color-surface-bg)] neo-shadow flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[var(--color-primary)] text-xl">local_shipping</span>
            </div>
            <div>
              <p className="font-extrabold text-[var(--color-on-surface)] leading-tight text-base">
                {vehicle.name}
              </p>
              <p className="text-[11px] font-bold text-[var(--color-primary)] flex items-center gap-1 mt-0.5">
                <span className="material-symbols-outlined text-xs">corporate_fare</span>
                {vehicle.partner_name || 'HaulIt Logistics Partner'}
              </p>
              <p className="text-[var(--text-label-md)] text-[var(--color-secondary)] flex items-center gap-1 mt-0.5">
                <span className="material-symbols-outlined text-xs">location_on</span>
                {vehicle.current_location}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {/* 1. Dispatch Status Pill */}
            <div className="flex items-center gap-1.5 neo-shadow-inner rounded-full px-3 py-1 shrink-0">
              <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot} ${vehicle.status === 'in_transit' ? 'animate-pulse' : ''}`} />
              <span className={`text-[10px] tracking-widest uppercase font-bold ${st.badge}`}>
                {st.label}
              </span>
            </div>

            {/* 2. Availability Status Badge: Green Available vs Red Not Available */}
            {isAvail ? (
              <div
                className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-300/80 neo-shadow-sm"
                title="Available for new shipments and dispatches"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span>Available</span>
              </div>
            ) : (
              <div
                className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider bg-red-50 text-red-700 border border-red-300/80 neo-shadow-sm cursor-help"
                title={reasonsTooltip}
              >
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                <span>Not Available</span>
              </div>
            )}
          </div>
        </div>

        {/* Selected Reasons Details Display (When Not Available) */}
        {!isAvail && (
          <div
            className="rounded-2xl p-3.5 neo-shadow-inner bg-red-50/50 border border-red-200/70 text-xs space-y-2 animate-fadeIn"
            title={reasonsTooltip}
          >
            <div className="flex items-center justify-between text-red-700 font-bold">
              <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                <span className="material-symbols-outlined text-sm text-red-600">block</span>
                Unavailability Reason{reasons.length > 1 ? 's' : ''}:
              </span>
              <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-black">
                Blocked
              </span>
            </div>

            {reasons.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {reasons.map((r, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--color-surface-bg)] neo-shadow-sm text-[11px] font-semibold text-[var(--color-on-surface)]"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                    <span>{r}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-[var(--color-secondary)] italic">
                Reason recorded by partner operator.
              </p>
            )}

            <p className="text-[10px] text-red-600/80 flex items-center gap-1 pt-1 font-medium">
              <span className="material-symbols-outlined text-xs">do_not_disturb</span>
              <span>This truck is excluded from booking recommendations.</span>
            </p>
          </div>
        )}

        <CapacityBar kg={vehicle.capacity_kg} />

        <div className="flex items-center justify-between text-[var(--text-label-md)] text-[var(--color-secondary)]">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">speed</span>
            {vehicle.avg_speed_kmh} km/h avg
          </span>
          <span className="font-mono text-xs opacity-60">ID #{vehicle.id}</span>
        </div>

        {/* Existing Confirmed Booking (Remains unchanged) */}
        {order ? (
          <div className="neo-shadow-inner rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)]">
                Active Order
              </span>
              <span className="font-black text-[var(--color-primary)] tracking-widest text-sm font-mono">
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
            <div className="flex items-center justify-between text-[var(--text-label-md)] text-[var(--color-secondary)] pt-1">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">schedule</span>
                ETA: <strong className="text-[var(--color-on-surface)] ml-1">{fmt(order.eta)}</strong>
              </span>
              <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                Confirmed
              </span>
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

      {/* Card Action Buttons (Mark Available / Mark Not Available + Booking Action) */}
      <div className="pt-3 border-t border-[var(--color-surface-container-highest)] space-y-2">
        <div className="flex items-center gap-2">
          {/* Availability Toggle Button */}
          {isAvail ? (
            <button
              type="button"
              onClick={() => onMarkNotAvailable(vehicle)}
              className="flex-1 py-3 px-4 rounded-xl neo-shadow hover:neo-shadow-sm active:neo-shadow-inner text-xs font-bold uppercase tracking-wider text-[var(--color-error)] bg-[var(--color-surface-bg)] hover:text-red-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">block</span>
              <span>Mark Not Available</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onMarkAvailable(vehicle)}
              className="flex-1 py-3 px-4 rounded-xl neo-shadow hover:neo-shadow-sm active:neo-shadow-inner text-xs font-bold uppercase tracking-wider text-emerald-600 bg-[var(--color-surface-bg)] hover:text-emerald-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">check_circle</span>
              <span>Mark Available</span>
            </button>
          )}

          {/* Booking Action Button */}
          {isAvail ? (
            <Link
              href={`/order?vehicle_id=${vehicle.id}&truck=${vehicle.capacity_kg <= 1500 ? 'SMALL' : vehicle.capacity_kg <= 5000 ? 'MEDIUM' : 'LARGE'}`}
              className="py-3 px-4 rounded-xl neo-shadow hover:neo-shadow-sm active:neo-shadow-inner text-xs font-bold uppercase tracking-wider text-[var(--color-primary)] bg-[var(--color-surface-bg)] hover:text-red-800 transition-all flex items-center justify-center gap-1.5 shrink-0"
              title="Book this truck for a new shipment"
            >
              <span className="material-symbols-outlined text-sm">local_shipping</span>
              <span>Book</span>
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="py-3 px-4 rounded-xl neo-shadow-inner text-xs font-bold uppercase tracking-wider text-gray-400 bg-gray-100 cursor-not-allowed flex items-center justify-center gap-1.5 shrink-0 opacity-60"
              title="Booking disabled while truck is marked Not Available"
            >
              <span className="material-symbols-outlined text-sm">do_not_disturb</span>
              <span>Disabled</span>
            </button>
          )}
        </div>
      </div>
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

type FilterStatus = 'all' | 'available' | 'not_available' | 'idle' | 'assigned' | 'in_transit'

export default function Fleet(): React.ReactElement {
  const [vehicles, setVehicles]       = useState<FleetVehicle[]>([])
  const [summary, setSummary]         = useState<FleetSummary | null>(null)
  const [filter, setFilter]           = useState<FilterStatus>('all')
  const [lastUpdated, setLast]        = useState<Date | null>(null)
  const [error, setError]             = useState('')
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Modals state
  const [truckForUnavail, setTruckForUnavail] = useState<FleetVehicle | null>(null)
  const [truckForAvail, setTruckForAvail]     = useState<FleetVehicle | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function fetchFleet() {
    try {
      const res = await api.vehicles.fleet()
      setVehicles(res.vehicles)
      setSummary(res.summary)
      setLast(new Date())
      setError('')
    } catch (err: any) {
      console.error('Failed to fetch fleet:', err)
      setError(err?.message ? `Failed to load fleet: ${err.message}` : 'Could not reach backend.')
    }
  }

  useEffect(() => {
    fetchFleet()
    pollRef.current = setInterval(fetchFleet, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  function showNotification(type: 'success' | 'error', message: string) {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4000)
  }

  // Handle confirming "Mark Not Available" with reasons
  async function handleConfirmNotAvailable(reasons: string[], otherText?: string) {
    if (!truckForUnavail) return
    try {
      const res = await api.vehicles.markUnavailable(truckForUnavail.id, {
        reasons,
        custom_reason: otherText,
      })
      showNotification('success', res.message || `Truck '${truckForUnavail.name}' marked Not Available.`)
      await fetchFleet()
    } catch (err: any) {
      showNotification('error', err?.message || 'Failed to mark truck as Not Available.')
      throw err
    }
  }

  // Handle confirming "Mark Available"
  async function handleConfirmAvailable() {
    if (!truckForAvail) return
    try {
      const res = await api.vehicles.markAvailable(truckForAvail.id)
      showNotification('success', res.message || `Truck '${truckForAvail.name}' is now Available.`)
      await fetchFleet()
    } catch (err: any) {
      showNotification('error', err?.message || 'Failed to restore truck availability.')
      throw err
    }
  }

  const displayed = filter === 'all'
    ? vehicles
    : filter === 'available'
    ? vehicles.filter(v => v.is_available)
    : filter === 'not_available'
    ? vehicles.filter(v => !v.is_available)
    : vehicles.filter(v => v.status === filter)

  const FILTERS: { key: FilterStatus; label: string }[] = [
    { key: 'all',           label: 'All Units'     },
    { key: 'available',     label: 'Available'     },
    { key: 'not_available', label: 'Not Available' },
    { key: 'idle',          label: 'Idle'          },
    { key: 'assigned',      label: 'Assigned'      },
    { key: 'in_transit',    label: 'In Transit'    },
  ]

  return (
    <>
      {/* 1. Modal: Why is this truck unavailable? */}
      {truckForUnavail && (
        <WhyUnavailableModal
          vehicle={truckForUnavail}
          onClose={() => setTruckForUnavail(null)}
          onConfirm={handleConfirmNotAvailable}
        />
      )}

      {/* 2. Modal: Confirm Mark Available */}
      {truckForAvail && (
        <ConfirmAvailableModal
          vehicle={truckForAvail}
          onClose={() => setTruckForAvail(null)}
          onConfirm={handleConfirmAvailable}
        />
      )}

      <div className="bg-[var(--color-surface-bg)] text-[var(--color-on-background)] antialiased min-h-screen font-sans">
        <main className="max-w-[var(--spacing-container-max-width)] mx-auto px-[var(--spacing-gutter)] py-12 space-y-8">

          {/* Header */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full neo-shadow-inner text-xs font-bold uppercase tracking-widest text-[var(--color-primary)] mb-2">
                <span className="material-symbols-outlined text-sm">local_shipping</span>
                Fleet Management
              </div>
              <h1 className="text-[var(--text-headline-xl-mobile)] md:text-[var(--text-headline-lg)] font-extrabold leading-tight">
                Fleet Overview
              </h1>
              <p className="text-[var(--text-body-md)] text-[var(--color-on-surface-variant)] mt-1">
                Monitor fleet units, toggle availability with reason tracking, and manage partner commitments.
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

          {/* Notifications */}
          {notification && (
            <div
              className={`rounded-2xl p-4 text-xs font-bold flex items-center justify-between gap-3 neo-shadow border-l-4 transition-all ${
                notification.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-500'
                  : 'bg-red-50 text-red-700 border-red-500'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base">
                  {notification.type === 'success' ? 'check_circle' : 'error'}
                </span>
                <span>{notification.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setNotification(null)}
                className="opacity-60 hover:opacity-100"
              >
                <span className="material-symbols-outlined text-xs">close</span>
              </button>
            </div>
          )}

          {error && (
            <div className="neo-shadow-inner rounded-xl p-4 text-center text-[var(--color-error)] text-[var(--text-label-md)]">
              {error}
            </div>
          )}

          {/* Stat Cards */}
          {summary && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon="garage"         label="Total Units"   value={summary.total}       color="text-[var(--color-on-surface)]" />
              <StatCard icon="check_circle"   label="Available"     value={summary.available}   color="text-emerald-600"               />
              <StatCard icon="event_busy"     label="Not Available" value={summary.unavailable} color="text-red-600"                   />
              <StatCard icon="local_shipping" label="In Transit"     value={summary.in_transit}  color="text-[var(--color-primary)]"    />
            </div>
          )}

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-5 py-2 rounded-full text-[var(--text-label-md)] tracking-widest uppercase font-bold transition-all duration-200 bg-[var(--color-surface-bg)] ${
                  filter === f.key
                    ? 'neo-shadow-inner text-[var(--color-primary)] font-black'
                    : 'neo-shadow text-[var(--color-secondary)] hover:neo-shadow-sm'
                }`}
              >
                {f.label}
                {summary && f.key === 'available' && (
                  <span className="ml-1.5 opacity-60">({summary.available})</span>
                )}
                {summary && f.key === 'not_available' && (
                  <span className="ml-1.5 opacity-60">({summary.unavailable})</span>
                )}
                {summary && f.key === 'all' && (
                  <span className="ml-1.5 opacity-60">({summary.total})</span>
                )}
              </button>
            ))}
          </div>

          {displayed.length === 0 && !error && (
            <div className="bg-[var(--color-surface-bg)] rounded-3xl neo-shadow p-16 flex flex-col items-center text-center gap-4">
              <span className="material-symbols-outlined text-5xl text-[var(--color-secondary)] opacity-40">local_shipping</span>
              <p className="text-[var(--text-headline-md)] font-semibold text-[var(--color-on-surface-variant)]">
                No vehicles in this category
              </p>
            </div>
          )}

          {/* Grid of Vehicle Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {displayed.map(v => (
              <VehicleCard
                key={v.id}
                vehicle={v}
                onMarkNotAvailable={veh => setTruckForUnavail(veh)}
                onMarkAvailable={veh => setTruckForAvail(veh)}
              />
            ))}
          </div>

        </main>
      </div>
    </>
  )
}
