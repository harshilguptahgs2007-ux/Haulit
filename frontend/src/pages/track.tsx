import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import { api, type HaulitOrder, type HealthScore, type Waypoint, type TruckLocation, CARGO_THRESHOLDS } from '../lib/api'
import ReturnModal from '../components/ReturnModal'
import {
  geocodeLocation,
  getDrivingDirections,
  type RouteData,
  type RouteStep,
} from '../services/directionsApi'
// @ts-ignore
import mbxStatic from '@mapbox/mapbox-sdk/services/static'

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

// ── Mapbox & CARTO Track Map Component ──────────────────────────────────────────
const TILE_SIZE = 256

function lonToWorldX(lon: number, zoom: number): number {
  return ((lon + 180) / 360) * Math.pow(2, zoom) * TILE_SIZE
}

function latToWorldY(lat: number, zoom: number): number {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat))
  const sin = Math.sin((clamped * Math.PI) / 180)
  return ((1 - Math.log((1 + sin) / (1 - sin)) / (2 * Math.PI)) / 2) * Math.pow(2, zoom) * TILE_SIZE
}

interface MapboxTrackMapProps {
  routeCoordinates: [number, number][] // Mapbox GeoJSON LineString coordinates: [lon, lat][]
  pickupLabel: string
  deliveryLabel: string
  progress: number // 0.0 to 1.0
  truckPosition?: [number, number] | null // optional explicit [lon, lat]
  status?: string
}

function MapboxTrackMap({
  routeCoordinates,
  pickupLabel,
  deliveryLabel,
  progress,
  truckPosition,
  status = 'in_transit',
}: MapboxTrackMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tileCacheRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const [zoomOffset, setZoomOffset] = useState<number>(0)
  const [mapStyle, setMapStyle] = useState<'voyager' | 'light_all'>('voyager')
  const [pulse, setPulse] = useState<number>(0)
  const [tilesLoadedCount, setTilesLoadedCount] = useState<number>(0)

  // Radar pulse animation for moving truck marker
  useEffect(() => {
    const anim = setInterval(() => {
      setPulse(p => (p + 1) % 40)
    }, 50)
    return () => clearInterval(anim)
  }, [])

  const drawMap = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    const displayW = canvas.clientWidth || 560
    const displayH = canvas.clientHeight || 340

    if (canvas.width !== displayW * dpr || canvas.height !== displayH * dpr) {
      canvas.width = displayW * dpr
      canvas.height = displayH * dpr
    }

    ctx.save()
    ctx.scale(dpr, dpr)

    const W = displayW
    const H = displayH

    // Clean background
    ctx.fillStyle = '#eef3f8'
    ctx.fillRect(0, 0, W, H)

    if (!routeCoordinates || routeCoordinates.length < 2) {
      ctx.fillStyle = '#64748b'
      ctx.font = '14px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('No route selected. Enter Origin & Destination to find road route.', W / 2, H / 2)
      ctx.restore()
      return
    }

    // Determine bounding box across ALL coordinates of the road route
    let minLon = Infinity, maxLon = -Infinity
    let minLat = Infinity, maxLat = -Infinity

    for (const [lon, lat] of routeCoordinates) {
      if (lon < minLon) minLon = lon
      if (lon > maxLon) maxLon = lon
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
    }

    const centerLat = (minLat + maxLat) / 2
    const centerLon = (minLon + maxLon) / 2

    // Auto-calculate optimal integer zoom level so the entire driving route fits
    let baseZoom = 5
    for (let z = 14; z >= 3; z--) {
      const spanX = Math.abs(lonToWorldX(maxLon, z) - lonToWorldX(minLon, z))
      const spanY = Math.abs(latToWorldY(minLat, z) - latToWorldY(maxLat, z))
      if (spanX <= Math.max(120, W - 140) && spanY <= Math.max(120, H - 110)) {
        baseZoom = z
        break
      }
    }

    const currentZoom = Math.max(3, Math.min(16, baseZoom + zoomOffset))
    const centerX = lonToWorldX(centerLon, currentZoom)
    const centerY = latToWorldY(centerLat, currentZoom)

    function toScreenX(lon: number): number {
      return lonToWorldX(lon, currentZoom) - centerX + W / 2
    }

    function toScreenY(lat: number): number {
      return latToWorldY(lat, currentZoom) - centerY + H / 2
    }

    // Draw CARTO Voyager Map Tiles
    const tileMinX = Math.floor((centerX - W / 2) / TILE_SIZE)
    const tileMaxX = Math.floor((centerX + W / 2) / TILE_SIZE)
    const tileMinY = Math.floor((centerY - H / 2) / TILE_SIZE)
    const tileMaxY = Math.floor((centerY + H / 2) / TILE_SIZE)

    const maxTileIdx = Math.pow(2, currentZoom) - 1
    const subdomains = ['a', 'b', 'c', 'd']

    for (let tx = tileMinX; tx <= tileMaxX; tx++) {
      for (let ty = tileMinY; ty <= tileMaxY; ty++) {
        if (ty < 0 || ty > maxTileIdx) continue
        const wrappedTx = ((tx % (maxTileIdx + 1)) + (maxTileIdx + 1)) % (maxTileIdx + 1)
        const sub = subdomains[Math.abs(tx + ty) % subdomains.length]
        const tileKey = `${mapStyle}_${currentZoom}_${wrappedTx}_${ty}`

        const screenX = tx * TILE_SIZE - centerX + W / 2
        const screenY = ty * TILE_SIZE - centerY + H / 2

        const cached = tileCacheRef.current.get(tileKey)
        if (cached && cached.complete && cached.naturalWidth > 0) {
          ctx.drawImage(cached, screenX, screenY, TILE_SIZE, TILE_SIZE)
        } else if (!cached) {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          // Preserved CARTO Voyager tile URL: https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png
          img.src = `https://${sub}.basemaps.cartocdn.com/rastertiles/${mapStyle}/${currentZoom}/${wrappedTx}/${ty}@2x.png`
          img.onload = () => {
            tileCacheRef.current.set(tileKey, img)
            setTilesLoadedCount(c => c + 1)
          }
          img.onerror = () => {
            // Fallback without @2x
            const fallback = new Image()
            fallback.crossOrigin = 'anonymous'
            fallback.src = `https://${sub}.basemaps.cartocdn.com/rastertiles/${mapStyle}/${currentZoom}/${wrappedTx}/${ty}.png`
            fallback.onload = () => {
              tileCacheRef.current.set(tileKey, fallback)
              setTilesLoadedCount(c => c + 1)
            }
          }
          tileCacheRef.current.set(tileKey, img)
        }
      }
    }

    // Soft contrast tint
    ctx.fillStyle = mapStyle === 'voyager' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.12)'
    ctx.fillRect(0, 0, W, H)

    // Calculate current truck position interpolated along road coordinates
    const clampedProgress = Math.max(0, Math.min(1, progress))
    const floatIdx = clampedProgress * (routeCoordinates.length - 1)
    const baseIdx = Math.floor(floatIdx)
    const t = floatIdx - baseIdx
    const nextIdx = Math.min(routeCoordinates.length - 1, baseIdx + 1)

    let truckLon: number, truckLat: number
    if (truckPosition) {
      truckLon = truckPosition[0]
      truckLat = truckPosition[1]
    } else {
      truckLon = routeCoordinates[baseIdx][0] + (routeCoordinates[nextIdx][0] - routeCoordinates[baseIdx][0]) * t
      truckLat = routeCoordinates[baseIdx][1] + (routeCoordinates[nextIdx][1] - routeCoordinates[baseIdx][1]) * t
    }

    // Draw the actual road route returned by Mapbox Directions
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // 1. Remaining route segment (dashed sky-blue road line)
    ctx.setLineDash([8, 6])
    ctx.strokeStyle = '#38bdf8'
    ctx.lineWidth = 3.5
    ctx.beginPath()
    const truckScreenX = toScreenX(truckLon)
    const truckScreenY = toScreenY(truckLat)
    ctx.moveTo(truckScreenX, truckScreenY)
    for (let i = nextIdx; i < routeCoordinates.length; i++) {
      ctx.lineTo(toScreenX(routeCoordinates[i][0]), toScreenY(routeCoordinates[i][1]))
    }
    ctx.stroke()
    ctx.setLineDash([])

    // 2. Traveled route segment (solid glowing purple/indigo line with rounded edges)
    ctx.shadowColor = 'rgba(79, 70, 229, 0.5)'
    ctx.shadowBlur = 8
    ctx.strokeStyle = '#4f46e5'
    ctx.lineWidth = 4.5
    ctx.beginPath()
    ctx.moveTo(toScreenX(routeCoordinates[0][0]), toScreenY(routeCoordinates[0][1]))
    for (let i = 1; i <= baseIdx; i++) {
      ctx.lineTo(toScreenX(routeCoordinates[i][0]), toScreenY(routeCoordinates[i][1]))
    }
    ctx.lineTo(truckScreenX, truckScreenY)
    ctx.stroke()
    ctx.shadowBlur = 0

    // Helper to draw high-contrast pill labels for Origin & Destination
    function drawPillLabel(
      c: CanvasRenderingContext2D,
      text: string,
      x: number,
      y: number,
      color: string,
      badgeLetter: string
    ) {
      c.save()
      // Marker circle
      c.shadowColor = 'rgba(0, 0, 0, 0.3)'
      c.shadowBlur = 6
      c.fillStyle = color
      c.beginPath()
      c.arc(x, y, 10, 0, Math.PI * 2)
      c.fill()
      c.shadowBlur = 0

      // Letter inside marker
      c.fillStyle = '#ffffff'
      c.font = 'bold 11px sans-serif'
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText(badgeLetter, x, y)

      // Text pill
      c.font = 'bold 12px sans-serif'
      const textWidth = c.measureText(text).width
      const pillW = textWidth + 14
      const pillH = 22
      const pillX = x - pillW / 2
      const pillY = y - 30

      c.fillStyle = 'rgba(255, 255, 255, 0.95)'
      c.strokeStyle = color
      c.lineWidth = 1.5
      c.beginPath()
      if (typeof (c as any).roundRect === 'function') {
        (c as any).roundRect(pillX, pillY, pillW, pillH, 8)
      } else {
        c.rect(pillX, pillY, pillW, pillH)
      }
      c.fill()
      c.stroke()

      c.fillStyle = '#0f172a'
      c.fillText(text, x, pillY + pillH / 2)
      c.restore()
    }

    // Origin Marker (A)
    const origScreenX = toScreenX(routeCoordinates[0][0])
    const origScreenY = toScreenY(routeCoordinates[0][1])
    drawPillLabel(ctx, pickupLabel, origScreenX, origScreenY, '#10b981', 'A')

    // Destination Marker (B)
    const destScreenX = toScreenX(routeCoordinates[routeCoordinates.length - 1][0])
    const destScreenY = toScreenY(routeCoordinates[routeCoordinates.length - 1][1])
    drawPillLabel(ctx, deliveryLabel, destScreenX, destScreenY, '#ef4444', 'B')

    // Live Moving Truck with Animated Radar Pulse Wave
    const isDone = status === 'delivered' || clampedProgress >= 0.999
    const truckColor = isDone ? '#10b981' : '#4f46e5'

    // Expanding radar waves
    const pulseRadius1 = 12 + (pulse / 40) * 18
    const pulseAlpha1 = Math.max(0, 0.45 * (1 - pulse / 40))
    ctx.fillStyle = truckColor
    ctx.globalAlpha = pulseAlpha1
    ctx.beginPath()
    ctx.arc(truckScreenX, truckScreenY, pulseRadius1, 0, Math.PI * 2)
    ctx.fill()

    const pulseRadius2 = 12 + (((pulse + 20) % 40) / 40) * 18
    const pulseAlpha2 = Math.max(0, 0.45 * (1 - ((pulse + 20) % 40) / 40))
    ctx.globalAlpha = pulseAlpha2
    ctx.beginPath()
    ctx.arc(truckScreenX, truckScreenY, pulseRadius2, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1.0

    // Truck container circle
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'
    ctx.shadowBlur = 8
    ctx.fillStyle = truckColor
    ctx.beginPath()
    ctx.arc(truckScreenX, truckScreenY, 13, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    // Truck Emoji Icon
    ctx.font = '13px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('🚛', truckScreenX, truckScreenY)

    // Bottom sleek progress bar
    const padX = 24
    const barY = H - 10
    ctx.fillStyle = 'rgba(226, 232, 240, 0.85)'
    ctx.fillRect(padX, barY - 2, W - padX * 2, 4)
    ctx.fillStyle = '#4f46e5'
    ctx.fillRect(padX, barY - 2, (W - padX * 2) * clampedProgress, 4)

    // Map Attribution
    ctx.font = '9px sans-serif'
    ctx.fillStyle = 'rgba(100, 116, 139, 0.8)'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillText('© CARTO Voyager · Mapbox Directions API', W - 10, H - 4)

    ctx.restore()
  }, [routeCoordinates, pickupLabel, deliveryLabel, progress, truckPosition, status, zoomOffset, mapStyle, pulse, tilesLoadedCount])

  useEffect(() => {
    drawMap()
  }, [drawMap])

  return (
    <div className="relative w-full overflow-hidden rounded-2xl neo-shadow-inner border border-[var(--color-surface-container-highest)]">
      <canvas
        ref={canvasRef}
        className="w-full h-[340px] block cursor-crosshair"
      />

      {/* Map Control Buttons */}
      <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
        <button
          type="button"
          onClick={() => setZoomOffset(z => Math.min(6, z + 1))}
          title="Zoom In"
          className="w-8 h-8 rounded-lg bg-[var(--color-surface-bg)] neo-shadow flex items-center justify-center font-bold text-sm text-[var(--color-on-surface)] hover:text-[var(--color-primary)] active:neo-shadow-inner transition-all"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setZoomOffset(z => Math.max(-3, z - 1))}
          title="Zoom Out"
          className="w-8 h-8 rounded-lg bg-[var(--color-surface-bg)] neo-shadow flex items-center justify-center font-bold text-sm text-[var(--color-on-surface)] hover:text-[var(--color-primary)] active:neo-shadow-inner transition-all"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => setZoomOffset(0)}
          title="Reset to Fit Route"
          className="w-8 h-8 rounded-lg bg-[var(--color-surface-bg)] neo-shadow flex items-center justify-center text-xs text-[var(--color-secondary)] hover:text-[var(--color-primary)] active:neo-shadow-inner transition-all"
        >
          <span className="material-symbols-outlined text-sm">center_focus_strong</span>
        </button>
      </div>

      {/* Style Toggle Pill */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-[var(--color-surface-bg)]/90 backdrop-blur-sm neo-shadow rounded-full px-2.5 py-1 text-[10px] font-bold text-[var(--color-secondary)]">
        <span className="material-symbols-outlined text-xs text-indigo-500">layers</span>
        <button
          type="button"
          onClick={() => setMapStyle(s => (s === 'voyager' ? 'light_all' : 'voyager'))}
          className="uppercase tracking-wider hover:text-[var(--color-primary)] transition-colors"
        >
          {mapStyle === 'voyager' ? 'CARTO Voyager' : 'Clean Light'}
        </button>
      </div>
    </div>
  )
}

// ── Live Map Panel with Mapbox Directions ───────────────────────────────────────
interface LiveMapPanelProps {
  order?: HaulitOrder | null
  initialPickup?: string
  initialDelivery?: string
}

function LiveMapPanel({ order, initialPickup, initialDelivery }: LiveMapPanelProps) {
  const [originInput, setOriginInput] = useState<string>(
    order?.pickup || initialPickup || 'Delhi'
  )
  const [destInput, setDestInput] = useState<string>(
    order?.delivery || initialDelivery || 'Raipur'
  )

  const [loadingRoute, setLoadingRoute] = useState<boolean>(false)
  const [routeError, setRouteError] = useState<string>('')
  const [routeData, setRouteData] = useState<RouteData | null>(null)
  const [simProgress, setSimProgress] = useState<number>(0)
  const [isSimulating, setIsSimulating] = useState<boolean>(true)
  const [showSteps, setShowSteps] = useState<boolean>(false)

  // Calculate driving road route using Mapbox Directions API
  const handleFindRoute = useCallback(async (fromPlace: string, toPlace: string) => {
    const o = fromPlace.trim()
    const d = toPlace.trim()

    if (!o || !d) {
      setRouteError('Please enter both an origin and a destination.')
      return
    }

    setLoadingRoute(true)
    setRouteError('')

    try {
      // 1. Geocode both locations to coordinates [lon, lat]
      const [originGeo, destGeo] = await Promise.all([
        geocodeLocation(o),
        geocodeLocation(d),
      ])

      // 2. Fetch actual road route from Mapbox Directions API v5
      const data = await getDrivingDirections(originGeo.coordinates, destGeo.coordinates)
      setRouteData(data)
      setSimProgress(0) // Reset simulation to start of new road route
    } catch (err: any) {
      console.error('Directions calculation failed:', err)
      setRouteError(err?.message || 'Failed to fetch road directions from Mapbox.')
      setRouteData(null)
    } finally {
      setLoadingRoute(false)
    }
  }, [])

  // Auto-load route on initial mount or when order changes
  useEffect(() => {
    const from = order?.pickup || initialPickup || 'Delhi'
    const to = order?.delivery || initialDelivery || 'Raipur'
    setOriginInput(from)
    setDestInput(to)
    handleFindRoute(from, to)
  }, [order?.pickup, order?.delivery, initialPickup, initialDelivery, handleFindRoute])

  // Swap origin and destination
  function handleSwapLocations() {
    const prevOrigin = originInput
    const prevDest = destInput
    setOriginInput(prevDest)
    setDestInput(prevOrigin)
    handleFindRoute(prevDest, prevOrigin)
  }

  // Animate truck along actual road route in DEMO MODE
  useEffect(() => {
    if (!isSimulating || !routeData || routeData.coordinates.length < 2) return

    const interval = setInterval(() => {
      setSimProgress(prev => {
        if (prev >= 1) return 0 // Loop animation smoothly
        return Math.min(1, prev + 0.0035)
      })
    }, 100)

    return () => clearInterval(interval)
  }, [isSimulating, routeData])

  // Derived statistics along the actual road route
  const totalKm = routeData ? routeData.distanceKm : 0
  const totalDurationMin = routeData ? routeData.durationMinutes : 0
  const remainingKm = routeData
    ? Math.max(0, Math.round(totalKm * (1 - simProgress) * 10) / 10)
    : 0
  const remainingMin = routeData
    ? Math.max(0, Math.round(totalDurationMin * (1 - simProgress)))
    : 0

  function formatDuration(min: number): string {
    if (min <= 0) return '0 min'
    const h = Math.floor(min / 60)
    const m = min % 60
    if (h === 0) return `${m} min`
    return `${h}h ${m}m`
  }

  const PRESETS = [
    { from: 'Delhi', to: 'Raipur' },
    { from: 'Delhi', to: 'Mumbai' },
    { from: 'Jaipur', to: 'Lucknow' },
    { from: 'Noida', to: 'Bengaluru' },
  ]

  return (
    <div className="bg-[var(--color-surface-bg)] rounded-3xl neo-shadow p-6 sm:p-8 border border-[var(--color-surface-container-highest)] space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[var(--color-primary)]">alt_route</span>
          <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] font-bold">
            Mapbox Road Directions & Live Tracking
          </p>
          <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded bg-indigo-100 text-indigo-700">
            Mapbox API
          </span>
        </div>
        <span className="flex items-center gap-1.5 text-[var(--text-label-md)] tracking-widest uppercase text-emerald-600 text-xs font-bold">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Road Trajectory · CARTO Voyager
        </span>
      </div>

      {/* Origin & Destination Search Fields */}
      <div className="bg-[var(--color-surface-bg)] p-4 rounded-2xl neo-shadow-inner border border-[var(--color-surface-container-highest)] space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-2.5">
          {/* Origin Input */}
          <div className="relative flex-1 w-full">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 text-sm">
              trip_origin
            </span>
            <input
              type="text"
              value={originInput}
              onChange={e => setOriginInput(e.target.value)}
              placeholder="Origin (e.g. Delhi, Jaipur, Noida)"
              className="w-full bg-[var(--color-surface-bg)] pl-9 pr-3 py-2.5 rounded-xl neo-shadow focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 text-sm text-[var(--color-on-surface)] font-medium"
            />
          </div>

          {/* Swap Button */}
          <button
            type="button"
            onClick={handleSwapLocations}
            title="Swap Origin and Destination"
            className="w-10 h-10 rounded-xl bg-[var(--color-surface-bg)] neo-shadow hover:neo-shadow-sm active:neo-shadow-inner flex items-center justify-center text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-all shrink-0"
          >
            <span className="material-symbols-outlined text-lg">swap_horiz</span>
          </button>

          {/* Destination Input */}
          <div className="relative flex-1 w-full">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-red-500 text-sm">
              location_on
            </span>
            <input
              type="text"
              value={destInput}
              onChange={e => setDestInput(e.target.value)}
              placeholder="Destination (e.g. Raipur, Mumbai, Bengaluru)"
              className="w-full bg-[var(--color-surface-bg)] pl-9 pr-3 py-2.5 rounded-xl neo-shadow focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 text-sm text-[var(--color-on-surface)] font-medium"
            />
          </div>

          {/* Find Route Button */}
          <button
            type="button"
            disabled={loadingRoute}
            onClick={() => handleFindRoute(originInput, destInput)}
            className="w-full md:w-auto bg-[var(--color-surface-bg)] text-[var(--color-primary)] font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl neo-shadow hover:neo-shadow-sm active:neo-shadow-inner transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
          >
            {loadingRoute ? (
              <>
                <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                <span>Calculating...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">directions</span>
                <span>Find Route</span>
              </>
            )}
          </button>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] uppercase font-bold text-[var(--color-secondary)] tracking-wider mr-1">
            Presets:
          </span>
          {PRESETS.map(p => (
            <button
              key={`${p.from}-${p.to}`}
              type="button"
              onClick={() => {
                setOriginInput(p.from)
                setDestInput(p.to)
                handleFindRoute(p.from, p.to)
              }}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-[var(--color-surface-bg)] neo-shadow hover:neo-shadow-sm active:neo-shadow-inner text-[var(--color-on-surface)] font-semibold transition-all hover:text-[var(--color-primary)]"
            >
              {p.from} → {p.to}
            </button>
          ))}
        </div>

        {/* Error message */}
        {routeError && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-sm shrink-0">error</span>
            <span>{routeError}</span>
          </div>
        )}
      </div>

      {/* Mapbox Route Summary pill */}
      {routeData && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-on-surface)]">
            <span className="material-symbols-outlined text-sm text-[var(--color-primary)]">navigation</span>
            <span>
              {routeData.summary ? `via ${routeData.summary}` : 'Mapbox Driving Route'}{' '}
              · <span className="font-bold text-[var(--color-primary)]">{routeData.distanceKm} km</span>{' '}
              · ~{formatDuration(routeData.durationMinutes)}
            </span>
          </div>
          {routeData.steps.length > 0 && (
            <button
              type="button"
              onClick={() => setShowSteps(s => !s)}
              className="text-[11px] text-[var(--color-secondary)] hover:text-[var(--color-primary)] font-bold flex items-center gap-1 uppercase tracking-wider"
            >
              <span>{showSteps ? 'Hide' : 'Show'} Turn-by-Turn ({routeData.steps.length})</span>
              <span className="material-symbols-outlined text-xs">
                {showSteps ? 'expand_less' : 'expand_more'}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Turn-by-Turn Accordion */}
      {showSteps && routeData && routeData.steps.length > 0 && (
        <div className="max-h-48 overflow-y-auto rounded-xl neo-shadow-inner p-3 bg-[var(--color-surface-bg)] text-xs space-y-2 border border-[var(--color-surface-container-highest)]">
          <p className="font-bold uppercase tracking-wider text-[10px] text-[var(--color-secondary)]">
            Driving Instructions ({routeData.steps.length} steps)
          </p>
          {routeData.steps.map((st, i) => (
            <div key={i} className="flex items-start gap-2 py-1 border-b border-slate-100 last:border-none">
              <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 font-bold text-[10px] flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <div className="flex-1">
                <p className="text-[var(--color-on-surface)] font-medium">
                  {st.instruction || st.name || `Proceed on route`}
                </p>
                <p className="text-[10px] text-[var(--color-secondary)]">
                  {(st.distance / 1000).toFixed(1)} km · {Math.round(st.duration / 60)} min
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Real Road Route on CARTO Voyager Map */}
      <div className="neo-shadow-inner rounded-xl p-3">
        <MapboxTrackMap
          routeCoordinates={routeData ? routeData.coordinates : []}
          pickupLabel={originInput}
          deliveryLabel={destInput}
          progress={simProgress}
          status={order?.status || 'in_transit'}
        />
      </div>

      {/* Route Statistics Row (Using actual Mapbox Directions API values) */}
      <div className="grid grid-cols-3 gap-3">
        <div className="neo-shadow-inner rounded-xl p-3 text-center">
          <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-1 font-bold text-[10px]">
            Route Progress
          </p>
          <p className="font-black text-[var(--color-primary)] text-lg">
            {Math.round(simProgress * 100)}%
          </p>
        </div>
        <div className="neo-shadow-inner rounded-xl p-3 text-center">
          <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-1 font-bold text-[10px]">
            Remaining Road
          </p>
          <p className="font-black text-[var(--color-on-surface)] text-lg font-mono">
            {remainingKm} km
          </p>
        </div>
        <div className="neo-shadow-inner rounded-xl p-3 text-center">
          <p className="text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-1 font-bold text-[10px]">
            Remaining ETA
          </p>
          <p className="font-black text-[var(--color-primary)] text-lg font-mono">
            {formatDuration(remainingMin)}
          </p>
        </div>
      </div>

      {/* Route Corridor */}
      <div className="flex items-center gap-2 text-sm">
        <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
        <span className="text-[var(--color-on-surface-variant)] flex-1 truncate font-medium">{originInput}</span>
        <span className="material-symbols-outlined text-sm text-[var(--color-secondary)]">arrow_forward</span>
        <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
        <span className="text-[var(--color-on-surface-variant)] flex-1 truncate font-medium">{destInput}</span>
      </div>

      {/* Transparency Disclaimer */}
      <p className="text-[9px] text-[var(--color-secondary)] opacity-70 text-center">
        ℹ Demo Mode: Truck movement is simulated along the actual Mapbox road driving route. No real GPS hardware data is claimed.
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

          {order ? (
            <OrderCard
              order={order}
              onOpenReturn={() => setShowReturnModal(true)}
            />
          ) : (
            <div className="w-full max-w-4xl">
              <LiveMapPanel initialPickup="Delhi" initialDelivery="Raipur" />
            </div>
          )}

        </main>
      </div>
    </>
  )
}
