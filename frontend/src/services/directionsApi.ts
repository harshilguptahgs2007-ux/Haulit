// Mapbox Directions and Geocoding Service
// Uses Mapbox Directions API v5 to calculate real road routes
// Token read via VITE_MAPBOX_TOKEN (supports Vite and Next.js environments)

export interface RouteStep {
  name: string
  distance: number // meters
  duration: number // seconds
  instruction?: string
  maneuver?: {
    instruction: string
    type: string
    location: [number, number]
  }
}

export interface RouteData {
  coordinates: [number, number][] // [lon, lat][]
  distanceKm: number
  durationMinutes: number
  steps: RouteStep[]
  summary: string
  originCoords: [number, number]
  destCoords: [number, number]
}

export interface GeocodeResult {
  placeName: string
  coordinates: [number, number] // [lon, lat]
}

export function getMapboxToken(): string {
  let token: string | undefined

  try {
    // Vite environment variable support
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_MAPBOX_TOKEN) {
      // @ts-ignore
      token = import.meta.env.VITE_MAPBOX_TOKEN
    }
  } catch {}

  if (!token && typeof process !== 'undefined' && process.env) {
    token = process.env.VITE_MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  }

  if (!token) {
    throw new Error('Mapbox token is missing. Please set VITE_MAPBOX_TOKEN in your .env file.')
  }

  return token
}

/**
 * Geocode a user-entered location string (e.g. "Delhi", "Raipur", "Noida") into coordinates [lon, lat].
 */
export async function geocodeLocation(query: string): Promise<GeocodeResult> {
  const clean = query.trim()
  if (!clean) {
    throw new Error('Please enter a valid location.')
  }

  // Pre-mapped major Indian logistics hubs for instant zero-latency resolution
  const KNOWN_CITIES: Record<string, [number, number]> = {
    mumbai:     [72.8777, 19.0760],
    delhi:      [77.2090, 28.6139],
    'new delhi':[77.2090, 28.6139],
    bangalore:  [77.5946, 12.9716],
    bengaluru:  [77.5946, 12.9716],
    chennai:    [80.2707, 13.0827],
    kolkata:    [88.3639, 22.5726],
    hyderabad:  [78.4867, 17.3850],
    pune:       [73.8567, 18.5204],
    ahmedabad:  [72.5714, 23.0225],
    jaipur:     [75.7873, 26.9124],
    raipur:     [81.6343, 21.2432],
    lucknow:    [80.9462, 26.8467],
    noida:      [77.3910, 28.5355],
    surat:      [72.8311, 21.1702],
    nagpur:     [79.0882, 21.1458],
    indore:     [75.8577, 22.7196],
    bhopal:     [77.4126, 23.2599],
    patna:      [85.1376, 25.5941],
    chandigarh: [76.7794, 30.7333],
    agra:       [78.0081, 27.1767],
    gurugram:   [77.0266, 28.4595],
    gurgaon:    [77.0266, 28.4595],
  }

  const lookupKey = clean.toLowerCase()
  if (KNOWN_CITIES[lookupKey]) {
    return {
      placeName: clean,
      coordinates: KNOWN_CITIES[lookupKey],
    }
  }

  const token = getMapboxToken()
  const encoded = encodeURIComponent(clean)
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?country=IN&limit=1&access_token=${token}`

  const res = await fetch(url)
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Invalid Mapbox access token. Please check VITE_MAPBOX_TOKEN.')
    }
    throw new Error(`Geocoding error: HTTP ${res.status}`)
  }

  const data = await res.json()
  if (!data.features || data.features.length === 0) {
    throw new Error(`Location "${clean}" could not be found. Please enter a valid city or address.`)
  }

  const feat = data.features[0]
  return {
    placeName: feat.place_name || clean,
    coordinates: [feat.center[0], feat.center[1]], // [lon, lat]
  }
}

/**
 * Fetch driving directions road route from Mapbox Directions API v5.
 * Format: origin [lon, lat], destination [lon, lat]
 */
export async function getDrivingDirections(
  origin: [number, number],
  destination: [number, number]
): Promise<RouteData> {
  const token = getMapboxToken()

  // Format: longitude,latitude;longitude,latitude
  const coordsParam = `${origin[0]},${origin[1]};${destination[0]},${destination[1]}`
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsParam}?geometries=geojson&overview=full&steps=true&access_token=${token}`

  const res = await fetch(url)
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Invalid Mapbox access token. Please verify VITE_MAPBOX_TOKEN.')
    }
    throw new Error(`Mapbox Directions API error: HTTP ${res.status}`)
  }

  const data = await res.json()

  if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
    const errorMsg = data.message || data.code || 'No drivable route found between these locations.'
    throw new Error(`Could not find a driving route: ${errorMsg}`)
  }

  const route = data.routes[0]
  const coordinates: [number, number][] = route.geometry?.coordinates || []

  if (coordinates.length < 2) {
    throw new Error('Mapbox returned an empty route. Please choose different locations.')
  }

  const distanceKm = Math.round((route.distance / 1000) * 10) / 10
  const durationMinutes = Math.round(route.duration / 60)

  const steps: RouteStep[] = []
  if (route.legs && route.legs[0] && Array.isArray(route.legs[0].steps)) {
    for (const s of route.legs[0].steps) {
      steps.push({
        name: s.name || '',
        distance: s.distance,
        duration: s.duration,
        instruction: s.maneuver?.instruction || '',
        maneuver: s.maneuver,
      })
    }
  }

  const summary = route.legs && route.legs[0] ? route.legs[0].summary || '' : ''

  return {
    coordinates,
    distanceKm,
    durationMinutes,
    steps,
    summary,
    originCoords: origin,
    destCoords: destination,
  }
}
