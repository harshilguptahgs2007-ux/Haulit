import React, { useState, useEffect, useRef } from 'react'
import {
  api,
  type FleetVehicle,
  type FleetSummary,
  type Partner,
  type VehicleAvailabilityRecord,
} from '../lib/api'

const REASON_OPTIONS = [
  { value: 'direct_booking',  label: 'Direct Booking (Outside HaulIt)', icon: 'local_shipping' },
  { value: 'maintenance',     label: 'Maintenance & Servicing',        icon: 'build'          },
  { value: 'personal_request',label: 'Personal / Fleet Internal Use',   icon: 'person'         },
  { value: 'driver_rest',     label: 'Driver Off-Duty / Rest',          icon: 'hotel'          },
  { value: 'other',           label: 'Other Commitment',                icon: 'event_busy'     },
]

function reasonLabel(code: string): string {
  const found = REASON_OPTIONS.find(r => r.value === code)
  if (found) return found.label
  return code.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

function reasonIcon(code: string): string {
  const found = REASON_OPTIONS.find(r => r.value === code)
  return found ? found.icon : 'info'
}

function toLocalDatetimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const h = pad(date.getHours())
  const min = pad(date.getMinutes())
  return `${y}-${m}-${d}T${h}:${min}`
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatRemaining(iso: string | null | undefined): string {
  if (!iso) return ''
  const target = new Date(iso).getTime()
  const diffMs = target - Date.now()
  if (diffMs <= 0) return 'ended'
  const totalMin = Math.round(diffMs / 60000)
  if (totalMin < 60) return `in ${totalMin}m`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (m === 0) return `in ${h}h`
  if (h < 24) return `in ${h}h ${m}m`
  const days = Math.floor(h / 24)
  const remH = h % 24
  return `in ${days}d ${remH}h`
}

interface SetUnavailabilityModalProps {
  vehicle: FleetVehicle
  onClose: () => void
  onSuccess: () => void
}

function SetUnavailabilityModal({ vehicle, onClose, onSuccess }: SetUnavailabilityModalProps) {
  const now = new Date()
  const defaultStart = toLocalDatetimeString(now)
  const defaultEnd = toLocalDatetimeString(new Date(now.getTime() + 4 * 3600 * 1000))

  const [startTime, setStartTime] = useState(defaultStart)
  const [endTime, setEndTime]     = useState(defaultEnd)
  const [reason, setReason]       = useState('direct_booking')
  const [notes, setNotes]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  function applyPresetHours(hours: number) {
    const s = startTime ? new Date(startTime) : new Date()
    const e = new Date(s.getTime() + hours * 3600 * 1000)
    setEndTime(toLocalDatetimeString(e))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const sDate = new Date(startTime)
    const eDate = new Date(endTime)

    if (isNaN(sDate.getTime()) || isNaN(eDate.getTime())) {
      setError('Please provide valid start and end dates.')
      return
    }
    if (eDate <= sDate) {
      setError('End date & time must be strictly after the start date & time.')
      return
    }
    if (eDate.getTime() <= Date.now()) {
      setError('End date & time cannot be in the past.')
      return
    }

    setLoading(true)
    try {
      await api.vehicles.setAvailability(vehicle.id, {
        start_time: sDate.toISOString(),
        end_time:   eDate.toISOString(),
        reason,
        notes: notes.trim() || undefined,
      })
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to set unavailability period')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(11,28,48,0.5)', backdropFilter: 'blur(8px)' }}
    >
      <div className="bg-[var(--color-surface-bg)] rounded-3xl p-6 sm:p-8 w-full max-w-lg mx-4 neo-shadow border border-[var(--color-surface-container-highest)] max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full neo-shadow-inner text-xs font-bold uppercase tracking-widest text-[var(--color-primary)] mb-2">
              <span className="material-symbols-outlined text-sm">event_busy</span>
              Partner Fleet Management
            </div>
            <h2 className="text-xl font-black text-[var(--color-on-surface)] leading-tight">
              Mark Truck as Unavailable
            </h2>
            <p className="text-xs text-[var(--color-secondary)] mt-1">
              {vehicle.name} &bull; {vehicle.partner_name || 'Partner Truck'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[var(--color-surface-bg)] neo-shadow flex items-center justify-center text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        {error && (
          <div className="neo-shadow-inner rounded-xl p-3.5 mb-5 text-xs text-[var(--color-error)] font-medium flex items-start gap-2">
            <span className="material-symbols-outlined text-sm shrink-0">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">

          <div>
            <label className="block text-[var(--text-label-md)] tracking-widest uppercase font-bold text-[var(--color-on-surface-variant)] mb-2">
              Reason for Unavailability
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {REASON_OPTIONS.map(opt => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setReason(opt.value)}
                  className={`p-3 rounded-xl text-left flex items-center gap-2.5 transition-all text-xs ${
                    reason === opt.value
                      ? 'neo-shadow-inner border-2 border-[var(--color-primary)] font-bold text-[var(--color-primary)]'
                      : 'neo-shadow hover:neo-shadow-sm text-[var(--color-on-surface)] font-medium'
                  }`}
                >
                  <span className="material-symbols-outlined text-base shrink-0">{opt.icon}</span>
                  <span className="truncate">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[var(--text-label-md)] tracking-widest uppercase font-bold text-[var(--color-on-surface-variant)]">
                Start Date &amp; Time
              </label>
              <button
                type="button"
                onClick={() => setStartTime(toLocalDatetimeString(new Date()))}
                className="text-[10px] uppercase font-bold text-[var(--color-primary)] hover:underline"
              >
                Now
              </button>
            </div>
            <input
              type="datetime-local"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              required
              className="w-full bg-[var(--color-surface-bg)] border-none neo-shadow-inner focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 rounded-xl px-4 py-3 text-xs text-[var(--color-on-surface)] font-mono font-bold"
            />
          </div>

          <div>
            <label className="block text-[var(--text-label-md)] tracking-widest uppercase font-bold text-[var(--color-on-surface-variant)] mb-1.5">
              End Date &amp; Time (Automatic Restoration)
            </label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              required
              className="w-full bg-[var(--color-surface-bg)] border-none neo-shadow-inner focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 rounded-xl px-4 py-3 text-xs text-[var(--color-on-surface)] font-mono font-bold"
            />

            <div className="flex flex-wrap gap-1.5 mt-2.5">
              <span className="text-[10px] text-[var(--color-secondary)] uppercase font-bold self-center mr-1">
                Presets:
              </span>
              {[
                { label: '+2h',  hours: 2  },
                { label: '+6h',  hours: 6  },
                { label: '+12h', hours: 12 },
                { label: '+24h', hours: 24 },
                { label: '+3d',  hours: 72 },
                { label: '+7d',  hours: 168},
              ].map(p => (
                <button
                  type="button"
                  key={p.label}
                  onClick={() => applyPresetHours(p.hours)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-[var(--color-surface-bg)] neo-shadow hover:neo-shadow-sm text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-all"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[var(--text-label-md)] tracking-widest uppercase font-bold text-[var(--color-on-surface-variant)] mb-1.5">
              Internal Notes / Reference (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Contract #9822, driver on leave, brake overhaul"
              maxLength={200}
              className="w-full bg-[var(--color-surface-bg)] border-none neo-shadow-inner focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 rounded-xl px-4 py-2.5 text-xs text-[var(--color-on-surface)]"
            />
          </div>

          <div className="p-3 rounded-xl neo-shadow-inner bg-[var(--color-surface-bg)] text-[11px] text-[var(--color-secondary)] flex items-start gap-2">
            <span className="material-symbols-outlined text-sm text-emerald-600 shrink-0">check_circle</span>
            <span>
              <strong>Safe Protection:</strong> Availability will automatically restore when this period ends.
              Any existing confirmed HaulIt shipments stay active and unchanged.
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-2">
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
              className="px-6 py-2.5 rounded-xl neo-shadow hover:neo-shadow-sm active:neo-shadow-inner text-xs font-black uppercase tracking-widest bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-container)] transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                  Saving…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">block</span>
                  Set Unavailable
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface ScheduleModalProps {
  vehicle: FleetVehicle
  onClose: () => void
  onRefresh: () => void
}

function ScheduleModal({ vehicle, onClose, onRefresh }: ScheduleModalProps) {
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState<VehicleAvailabilityRecord[]>([])
  const [actionError, setActionError] = useState('')

  async function loadData() {
    setLoading(true)
    setActionError('')
    try {
      const res = await api.vehicles.getAvailability(vehicle.id)
      setHistory(res.history || [])
    } catch (err: any) {
      setActionError(err?.message || 'Failed to load schedule history')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [vehicle.id])

  async function handleRestoreNow() {
    setActionError('')
    try {
      await api.vehicles.restoreAvailability(vehicle.id)
      await loadData()
      onRefresh()
    } catch (err: any) {
      setActionError(err?.message || 'Failed to restore availability')
    }
  }

  async function handleDelete(recordId: number) {
    if (!confirm('Are you sure you want to cancel this unavailability window?')) return
    setActionError('')
    try {
      await api.vehicles.deleteAvailability(recordId)
      await loadData()
      onRefresh()
    } catch (err: any) {
      setActionError(err?.message || 'Failed to cancel period')
    }
  }

  const activeRecords = history.filter(r => r.is_current)
  const upcomingRecords = history.filter(r => r.is_future)
  const pastRecords = history.filter(r => r.is_past)

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(11,28,48,0.5)', backdropFilter: 'blur(8px)' }}
    >
      <div className="bg-[var(--color-surface-bg)] rounded-3xl p-6 sm:p-8 w-full max-w-2xl mx-4 neo-shadow border border-[var(--color-surface-container-highest)] max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full neo-shadow-inner text-xs font-bold uppercase tracking-widest text-[var(--color-primary)] mb-2">
              <span className="material-symbols-outlined text-sm">calendar_month</span>
              Availability Schedule
            </div>
            <h2 className="text-xl font-black text-[var(--color-on-surface)] leading-tight">
              {vehicle.name}
            </h2>
            <p className="text-xs text-[var(--color-secondary)] mt-0.5">
              Partner: <span className="font-bold text-[var(--color-on-surface)]">{vehicle.partner_name || 'Partner Truck'}</span>
              {' '}&bull; Current: <span className={vehicle.is_available ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                {vehicle.is_available ? 'Available' : 'Unavailable'}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[var(--color-surface-bg)] neo-shadow flex items-center justify-center text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        {actionError && (
          <div className="neo-shadow-inner rounded-xl p-3.5 mb-4 text-xs text-[var(--color-error)] font-medium flex items-start gap-2">
            <span className="material-symbols-outlined text-sm shrink-0">error</span>
            <span>{actionError}</span>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-xs text-[var(--color-secondary)] flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-2xl animate-spin text-[var(--color-primary)]">sync</span>
            <span>Loading schedule records…</span>
          </div>
        ) : history.length === 0 ? (
          <div className="neo-shadow-inner rounded-2xl p-8 text-center text-xs text-[var(--color-secondary)] flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-3xl opacity-40">event_available</span>
            <p className="font-semibold text-[var(--color-on-surface)]">No unavailability periods on record.</p>
            <p className="text-[11px]">This truck has full availability without schedule blocks.</p>
          </div>
        ) : (
          <div className="space-y-6">

            {activeRecords.length > 0 && (
              <div>
                <p className="text-xs uppercase font-extrabold tracking-widest text-amber-600 mb-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  Active Unavailability Period
                </p>
                <div className="space-y-2">
                  {activeRecords.map(rec => (
                    <div
                      key={rec.id}
                      className="bg-[var(--color-surface-bg)] neo-shadow-inner rounded-2xl p-4 border-l-4 border-amber-500 flex flex-wrap items-center justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2 font-bold text-sm text-[var(--color-on-surface)]">
                          <span className="material-symbols-outlined text-base text-amber-600">{reasonIcon(rec.reason)}</span>
                          <span>{reasonLabel(rec.reason)}</span>
                        </div>
                        <p className="text-xs text-[var(--color-secondary)] mt-1">
                          {fmtDate(rec.start_time)} &rarr; {fmtDate(rec.end_time)}
                          <span className="ml-2 font-bold text-amber-600">({formatRemaining(rec.end_time)})</span>
                        </p>
                        {rec.notes && (
                          <p className="text-[11px] text-[var(--color-on-surface-variant)] mt-1 italic">
                            Note: &quot;{rec.notes}&quot;
                          </p>
                        )}
                      </div>
                      <button
                        onClick={handleRestoreNow}
                        className="px-4 py-2 rounded-xl neo-shadow hover:neo-shadow-sm text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-[var(--color-surface-bg)] uppercase tracking-wider flex items-center gap-1.5 transition-all"
                      >
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        Restore Available Now
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {upcomingRecords.length > 0 && (
              <div>
                <p className="text-xs uppercase font-extrabold tracking-widest text-[var(--color-primary)] mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">schedule</span>
                  Upcoming Scheduled Periods
                </p>
                <div className="space-y-2">
                  {upcomingRecords.map(rec => (
                    <div
                      key={rec.id}
                      className="bg-[var(--color-surface-bg)] neo-shadow rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2 font-bold text-xs text-[var(--color-on-surface)]">
                          <span className="material-symbols-outlined text-base text-[var(--color-secondary)]">{reasonIcon(rec.reason)}</span>
                          <span>{reasonLabel(rec.reason)}</span>
                          <span className="text-[10px] uppercase font-bold text-[var(--color-primary)] neo-shadow-inner px-2 py-0.5 rounded-full">
                            Upcoming
                          </span>
                        </div>
                        <p className="text-xs text-[var(--color-secondary)] mt-1">
                          {fmtDate(rec.start_time)} &rarr; {fmtDate(rec.end_time)}
                        </p>
                        {rec.notes && (
                          <p className="text-[11px] text-[var(--color-secondary)] mt-1 italic">
                            Note: &quot;{rec.notes}&quot;
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(rec.id)}
                        className="px-3 py-1.5 rounded-lg neo-shadow hover:neo-shadow-sm text-[11px] font-bold text-[var(--color-error)] bg-[var(--color-surface-bg)] uppercase tracking-wider flex items-center gap-1 transition-all"
                      >
                        <span className="material-symbols-outlined text-xs">delete</span>
                        Cancel
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pastRecords.length > 0 && (
              <div>
                <p className="text-xs uppercase font-extrabold tracking-widest text-[var(--color-secondary)] mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">history</span>
                  Past Unavailability History
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {pastRecords.map(rec => (
                    <div
                      key={rec.id}
                      className="bg-[var(--color-surface-bg)] neo-shadow-inner rounded-xl p-3 flex items-center justify-between opacity-75"
                    >
                      <div>
                        <p className="text-xs font-semibold text-[var(--color-on-surface)] flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-xs">{reasonIcon(rec.reason)}</span>
                          {reasonLabel(rec.reason)}
                        </p>
                        <p className="text-[10px] text-[var(--color-secondary)]">
                          {fmtDate(rec.start_time)} &rarr; {fmtDate(rec.end_time)}
                        </p>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-[var(--color-secondary)] neo-shadow-inner px-2 py-0.5 rounded-full">
                        Ended
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-6">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl neo-shadow hover:neo-shadow-sm text-xs font-bold uppercase tracking-widest text-[var(--color-secondary)] transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PartnerAvailabilityDashboard(): React.ReactElement {
  const [vehicles, setVehicles]       = useState<FleetVehicle[]>([])
  const [partners, setPartners]       = useState<Partner[]>([])
  const [summary, setSummary]         = useState<FleetSummary | null>(null)
  const [filterStatus, setFilterStatus] = useState<'all' | 'available' | 'unavailable'>('all')
  const [partnerFilter, setPartnerFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [successMsg, setSuccessMsg]   = useState('')

  const [selectedForUnavail, setSelectedForUnavail] = useState<FleetVehicle | null>(null)
  const [selectedForSchedule, setSelectedForSchedule] = useState<FleetVehicle | null>(null)
  const [togglingId, setTogglingId]   = useState<number | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function loadFleet() {
    try {
      const [fleetRes, partnersRes] = await Promise.all([
        api.vehicles.fleet(),
        api.vehicles.partners().catch(() => ({ partners: [] })),
      ])
      setVehicles(fleetRes.vehicles)
      setSummary(fleetRes.summary)
      setPartners(partnersRes.partners)
      setError('')
    } catch (err: any) {
      setError(err?.message || 'Failed to load partner fleet data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFleet()
    pollRef.current = setInterval(loadFleet, 4000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  function showBanner(msg: string) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 4000)
  }

  async function handleToggle(vehicle: FleetVehicle) {
    if (vehicle.is_available) {

      setSelectedForUnavail(vehicle)
    } else {

      setTogglingId(vehicle.id)
      setError('')
      try {
        const res = await api.vehicles.restoreAvailability(vehicle.id)
        showBanner(res.message || `Truck '${vehicle.name}' is now marked Available.`)
        await loadFleet()
      } catch (err: any) {
        setError(err?.message || 'Failed to restore vehicle availability')
      } finally {
        setTogglingId(null)
      }
    }
  }

  const displayed = vehicles.filter(v => {
    if (filterStatus === 'available' && !v.is_available) return false
    if (filterStatus === 'unavailable' && v.is_available) return false
    if (partnerFilter !== 'all' && v.partner_name !== partnerFilter) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchName = v.name.toLowerCase().includes(q)
      const matchLoc  = v.current_location.toLowerCase().includes(q)
      const matchP    = (v.partner_name || '').toLowerCase().includes(q)
      if (!matchName && !matchLoc && !matchP) return false
    }
    return true
  })

  return (
    <div className="space-y-8">

      {selectedForUnavail && (
        <SetUnavailabilityModal
          vehicle={selectedForUnavail}
          onClose={() => setSelectedForUnavail(null)}
          onSuccess={() => {
            showBanner(`Truck '${selectedForUnavail.name}' marked Unavailable. Availability will automatically restore when period ends.`)
            loadFleet()
          }}
        />
      )}

      {selectedForSchedule && (
        <ScheduleModal
          vehicle={selectedForSchedule}
          onClose={() => setSelectedForSchedule(null)}
          onRefresh={loadFleet}
        />
      )}

      {successMsg && (
        <div className="bg-[var(--color-surface-bg)] neo-shadow rounded-2xl p-4 text-xs font-bold text-emerald-600 flex items-center justify-between gap-3 border-l-4 border-emerald-500 animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">check_circle</span>
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-[var(--color-secondary)] hover:text-emerald-700">
            <span className="material-symbols-outlined text-xs">close</span>
          </button>
        </div>
      )}

      {error && (
        <div className="bg-[var(--color-surface-bg)] neo-shadow-inner rounded-2xl p-4 text-xs font-bold text-[var(--color-error)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span>
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-[var(--color-secondary)] hover:text-[var(--color-error)]">
            <span className="material-symbols-outlined text-xs">close</span>
          </button>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[var(--color-surface-bg)] rounded-2xl neo-shadow p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[var(--color-surface-bg)] neo-shadow flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl text-[var(--color-on-surface)]">local_shipping</span>
            </div>
            <div>
              <p className="text-[10px] tracking-widest uppercase text-[var(--color-secondary)] font-bold">Total Fleet</p>
              <p className="text-2xl font-black text-[var(--color-on-surface)] leading-tight">{summary.total}</p>
            </div>
          </div>

          <div className="bg-[var(--color-surface-bg)] rounded-2xl neo-shadow p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[var(--color-surface-bg)] neo-shadow flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl text-emerald-600">verified</span>
            </div>
            <div>
              <p className="text-[10px] tracking-widest uppercase text-[var(--color-secondary)] font-bold">Available Now</p>
              <p className="text-2xl font-black text-emerald-600 leading-tight">{summary.available}</p>
            </div>
          </div>

          <div className="bg-[var(--color-surface-bg)] rounded-2xl neo-shadow p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[var(--color-surface-bg)] neo-shadow flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl text-amber-600">event_busy</span>
            </div>
            <div>
              <p className="text-[10px] tracking-widest uppercase text-[var(--color-secondary)] font-bold">Unavailable</p>
              <p className="text-2xl font-black text-amber-600 leading-tight">{summary.unavailable}</p>
            </div>
          </div>

          <div className="bg-[var(--color-surface-bg)] rounded-2xl neo-shadow p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[var(--color-surface-bg)] neo-shadow flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl text-[var(--color-primary)]">corporate_fare</span>
            </div>
            <div>
              <p className="text-[10px] tracking-widest uppercase text-[var(--color-secondary)] font-bold">Partner Companies</p>
              <p className="text-2xl font-black text-[var(--color-primary)] leading-tight">{partners.length || 4}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-[var(--color-surface-bg)] rounded-3xl neo-shadow p-5 flex flex-wrap items-center justify-between gap-4 border border-[var(--color-surface-container-highest)]">
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'available', 'unavailable'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-4 py-2 rounded-full text-xs tracking-widest uppercase font-bold transition-all ${
                filterStatus === s
                  ? 'neo-shadow-inner text-[var(--color-primary)] font-black'
                  : 'neo-shadow text-[var(--color-secondary)] hover:text-[var(--color-primary)]'
              }`}
            >
              {s === 'all' ? 'All Units' : s}
              {summary && s !== 'all' && (
                <span className="ml-1.5 opacity-60">({summary[s]})</span>
              )}
            </button>
          ))}

          {partners.length > 0 && (
            <select
              value={partnerFilter}
              onChange={e => setPartnerFilter(e.target.value)}
              className="bg-[var(--color-surface-bg)] neo-shadow-inner text-xs font-bold text-[var(--color-secondary)] rounded-full px-4 py-2 focus:outline-none cursor-pointer"
            >
              <option value="all">All Partners</option>
              {partners.map(p => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-secondary)]">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search truck, city, partner…"
              className="w-full bg-[var(--color-surface-bg)] neo-shadow-inner rounded-full pl-9 pr-4 py-2 text-xs text-[var(--color-on-surface)] focus:outline-none"
            />
          </div>
          <button
            onClick={loadFleet}
            title="Refresh Fleet Availability"
            className="w-9 h-9 rounded-full bg-[var(--color-surface-bg)] neo-shadow flex items-center justify-center text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-all shrink-0"
          >
            <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>sync</span>
          </button>
        </div>
      </div>

      {displayed.length === 0 ? (
        <div className="bg-[var(--color-surface-bg)] rounded-3xl neo-shadow p-16 text-center text-xs text-[var(--color-secondary)] flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-4xl opacity-30">local_shipping</span>
          <p className="font-bold text-sm text-[var(--color-on-surface)]">No trucks match current filter</p>
          <p>Try switching filters or clearing your search query.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {displayed.map(vehicle => {
            const isAvail = vehicle.is_available
            const unavail = vehicle.current_unavailability

            return (
              <div
                key={vehicle.id}
                className={`bg-[var(--color-surface-bg)] rounded-3xl neo-shadow p-6 flex flex-col justify-between gap-5 transition-all border ${
                  isAvail ? 'border-transparent' : 'border-amber-400/40'
                }`}
              >
                <div className="space-y-4">

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-[var(--color-surface-bg)] neo-shadow flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[var(--color-primary)] text-xl">
                          local_shipping
                        </span>
                      </div>
                      <div>
                        <h3 className="font-extrabold text-[var(--color-on-surface)] leading-tight text-base">
                          {vehicle.name}
                        </h3>
                        <p className="text-[11px] font-bold text-[var(--color-primary)] flex items-center gap-1 mt-0.5">
                          <span className="material-symbols-outlined text-xs">corporate_fare</span>
                          {vehicle.partner_name || 'Partner Truck'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggle(vehicle)}
                        disabled={togglingId === vehicle.id}
                        title={isAvail ? 'Click to mark Unavailable' : 'Click to mark Available'}
                        className={`relative w-14 h-8 rounded-full p-1 transition-colors duration-300 focus:outline-none flex items-center ${
                          isAvail ? 'bg-emerald-500 neo-shadow' : 'bg-gray-300 neo-shadow-inner'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-full bg-white neo-shadow-sm transform transition-transform duration-300 flex items-center justify-center text-[10px] ${
                            isAvail ? 'translate-x-6 text-emerald-600' : 'translate-x-0 text-gray-400'
                          }`}
                        >
                          {togglingId === vehicle.id ? (
                            <span className="material-symbols-outlined text-xs animate-spin">sync</span>
                          ) : isAvail ? (
                            <span className="material-symbols-outlined text-xs font-black">check</span>
                          ) : (
                            <span className="material-symbols-outlined text-xs font-black">close</span>
                          )}
                        </div>
                      </button>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-[var(--color-secondary)]">
                        {isAvail ? 'Available' : 'Unavailable'}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`rounded-2xl p-4 neo-shadow-inner flex flex-col gap-2 ${
                      isAvail ? 'bg-emerald-50/20' : 'bg-amber-50/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            isAvail ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                          }`}
                        />
                        <span
                          className={`text-xs font-black uppercase tracking-widest ${
                            isAvail ? 'text-emerald-600' : 'text-amber-600'
                          }`}
                        >
                          {isAvail ? 'Available For Booking' : 'Currently Unavailable'}
                        </span>
                      </div>

                      {!isAvail && unavail && (
                        <span className="text-[10px] font-bold uppercase tracking-wider neo-shadow-inner rounded-full px-2 py-0.5 text-amber-700 bg-[var(--color-surface-bg)] flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">{reasonIcon(unavail.reason)}</span>
                          {unavail.reason.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-[var(--color-secondary)]">
                      {isAvail ? (
                        <p className="flex items-center gap-1.5 font-medium text-[var(--color-on-surface)]">
                          <span className="material-symbols-outlined text-sm text-emerald-600">verified</span>
                          <span>Next Available: <strong>Now</strong> (Ready for automatic dispatch)</span>
                        </p>
                      ) : (
                        <div className="space-y-1">
                          <p className="flex items-center gap-1.5 text-[var(--color-on-surface)]">
                            <span className="material-symbols-outlined text-sm text-amber-600">schedule</span>
                            <span>
                              Next Available:{' '}
                              <strong>{fmtDate(vehicle.next_available_time)}</strong>
                              <span className="ml-1.5 font-bold text-amber-600">
                                ({formatRemaining(vehicle.next_available_time)})
                              </span>
                            </span>
                          </p>
                          {unavail?.notes && (
                            <p className="text-[11px] text-[var(--color-secondary)] italic">
                              &ldquo;{unavail.notes}&rdquo;
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-[var(--color-secondary)]">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-[var(--color-primary)]">location_on</span>
                      <span className="truncate">{vehicle.current_location}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-[var(--color-secondary)]">weight</span>
                      <span>&le; {vehicle.capacity_kg.toLocaleString()} kg</span>
                    </div>
                  </div>

                  {vehicle.active_order && (
                    <div className="p-2.5 rounded-xl neo-shadow-inner bg-[var(--color-surface-bg)] text-[11px] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-[var(--color-on-surface)]">
                        <span className="material-symbols-outlined text-xs text-[var(--color-primary)]">assignment</span>
                        <span>Order: <strong className="font-mono">{vehicle.active_order.track_id}</strong></span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                        Confirmed &bull; Unaltered
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-[var(--color-surface-container-highest)] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedForSchedule(vehicle)}
                    className="flex-1 py-2 px-3 rounded-xl neo-shadow hover:neo-shadow-sm text-[11px] font-bold uppercase tracking-wider text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-all flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-xs">calendar_month</span>
                    Schedule &amp; History
                  </button>

                  {isAvail ? (
                    <button
                      type="button"
                      onClick={() => setSelectedForUnavail(vehicle)}
                      className="py-2 px-3.5 rounded-xl neo-shadow hover:neo-shadow-sm active:neo-shadow-inner text-[11px] font-bold uppercase tracking-wider text-amber-600 hover:text-amber-700 bg-[var(--color-surface-bg)] transition-all flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-xs">block</span>
                      Set Period
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleToggle(vehicle)}
                      disabled={togglingId === vehicle.id}
                      className="py-2 px-3.5 rounded-xl neo-shadow hover:neo-shadow-sm active:neo-shadow-inner text-[11px] font-bold uppercase tracking-wider text-emerald-600 hover:text-emerald-700 bg-[var(--color-surface-bg)] transition-all flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-xs">check_circle</span>
                      Mark Available
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
