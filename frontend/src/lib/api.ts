// API base URL strategy:
// - In the browser: use relative paths ("") so the Next.js proxy handles
//   all /api/* calls. This works for localhost AND any LAN device
//   (e.g. 192.168.11.158) accessing the app, because the proxy runs
//   server-side and always reaches Flask at 192.168.11.156:5000.
// - On the server (SSR): call Flask directly via the network IP.
//   Override with NEXT_PUBLIC_API_URL env var if needed.
const BASE_URL = typeof window !== "undefined"
  ? ""                                                                    // browser → Next.js proxy → Flask
  : (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000")          // SSR → Flask directly

function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("haulit_token")
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  let json: any = {}
  try {
    json = await res.json()
  } catch {}

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("haulit_token")
      localStorage.removeItem("haulit_user_name")
    }
    const errMsg = json.error || json.msg || json.message || (res.status === 401 ? "Session expired or unauthorized. Please log in." : `HTTP ${res.status}`)
    throw new Error(errMsg)
  }
  return json as T
}

export const api = {
  auth: {
    register: (name: string, email: string, password: string) =>
      request<{ token: string; user: HaulitUser }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      }),
    login: (email: string, password: string) =>
      request<{ token: string; user: HaulitUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    me: () => request<HaulitUser>("/api/auth/me"),
  },
  orders: {
    create: (payload: CreateOrderPayload) =>
      request<{ order: HaulitOrder; pricing?: PriceCalculation }>("/api/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    track: (trackId: string) =>
      request<{ order: HaulitOrder }>(`/api/orders/${trackId}`),
    myOrders: () =>
      request<{ orders: HaulitOrder[] }>("/api/orders/my"),
    updateStatus: (trackId: string, status: string) =>
      request<{ order: HaulitOrder }>(`/api/orders/${trackId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      }),
    requestReturn: (trackId: string, payload: { reason: string; policy_agreed: boolean }) =>
      request<ReturnResponse>(`/api/orders/${trackId}/return`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    ingestSensor: (trackId: string, data: SensorPayload) =>
      request<{ health: HealthScore; sensor: SensorReading }>(
        `/api/orders/${trackId}/sensor`,
        { method: "POST", body: JSON.stringify(data) }
      ),
    getTruckLocation: (trackId: string) =>
      request<TruckLocation>(`/api/orders/${trackId}/location`),
  },
  pricing: {
    getConfig: () =>
      request<PricingConfig>("/api/orders/pricing-config"),
    calculate: (payload: {
      weight_kg: number
      distance_km?: number
      truck_type: TruckType | string
      cargo_type?: string
      pickup_lat?: number
      pickup_lon?: number
      delivery_lat?: number
      delivery_lon?: number
    }) =>
      request<PriceCalculation>("/api/orders/calculate-price", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },
  vehicles: {
    list: () => request<{ vehicles: HaulitVehicle[] }>("/api/vehicles/"),
    fleet: () => request<{ summary: FleetSummary; vehicles: FleetVehicle[] }>("/api/vehicles/fleet"),
    get: (vid: number) => request<{ vehicle: HaulitVehicle }>(`/api/vehicles/${vid}`),
    partners: () => request<{ partners: Partner[] }>("/api/vehicles/partners"),
    getAvailability: (vid: number) =>
      request<{
        vehicle: HaulitVehicle
        is_available: boolean
        availability_status: "available" | "unavailable"
        next_available_time: string | null
        current_unavailability: VehicleAvailabilityRecord | null
        history: VehicleAvailabilityRecord[]
      }>(`/api/vehicles/${vid}/availability`),
    setAvailability: (
      vid: number,
      payload: { start_time?: string; end_time: string; reason?: string; notes?: string }
    ) =>
      request<{
        message: string
        unavailability: VehicleAvailabilityRecord
        vehicle: HaulitVehicle
      }>(`/api/vehicles/${vid}/availability`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    toggleAvailability: (
      vid: number,
      payload?: { start_time?: string; end_time?: string; reason?: string; notes?: string }
    ) =>
      request<{
        status: "available" | "unavailable"
        message: string
        vehicle: HaulitVehicle
        unavailability?: VehicleAvailabilityRecord
      }>(`/api/vehicles/${vid}/availability/toggle`, {
        method: "POST",
        body: JSON.stringify(payload || {}),
      }),
    restoreAvailability: (vid: number) =>
      request<{ message: string; vehicle: HaulitVehicle }>(
        `/api/vehicles/${vid}/availability/restore`,
        { method: "POST" }
      ),
    deleteAvailability: (aid: number) =>
      request<{ message: string; vehicle: HaulitVehicle }>(
        `/api/vehicles/availability/${aid}`,
        { method: "DELETE" }
      ),
    recommend: (payload: { weight_kg: number; pickup_lat?: number; pickup_lon?: number; limit?: number }) =>
      request<{ weight_kg: number; recommendations: (FleetVehicle & { distance_to_pickup_km?: number })[]; count: number }>(
        "/api/vehicles/recommend",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      ),
  },
}

export type TruckType = "SMALL" | "MEDIUM" | "LARGE"

export interface PricingConfig {
  min_distance_km: number
  max_distance_km: number
  stabilizing_value: number
  coefficients: Record<string, number>
  return_policy_text: string
  return_policies: {
    customer_cancellation: { refund_percentage: number; label: string; description: string }
    company_fault: { refund_percentage: number; label: string; description: string }
    damage_disclaimer: string
  }
}

export interface PriceCalculation {
  weight_kg: number
  distance_km: number
  truck_type: string
  coefficient: number
  norm: number
  stable: number
  base_price?: number
  cargo_type?: string
  extra_charge_name?: string | null
  extra_charge?: number
  price: number
  formatted_price: string
  formatted_base_price?: string
  formatted_extra_charge?: string
}

export interface ReturnResponse {
  message: string
  order: HaulitOrder
  refund: {
    original_price: number
    reason: string
    refund_percentage: number
    label: string
    refund_amount: number
    formatted_refund: string
    damage_disclaimer: string
  }
  policy: string
}

export interface HaulitUser {
  id: number
  name: string
  email: string
  created_at: string
}

export interface Partner {
  id: number
  name: string
  code?: string | null
  contact_name?: string | null
  contact_email?: string | null
  phone?: string | null
  vehicle_count?: number
  created_at?: string | null
}

export interface VehicleAvailabilityRecord {
  id: number
  vehicle_id: number
  start_time: string
  end_time: string
  reason: string
  notes?: string
  is_active: boolean
  is_current: boolean
  is_future: boolean
  is_past: boolean
  created_at?: string | null
}

export interface HaulitVehicle {
  id: number
  name: string
  capacity_kg: number
  avg_speed_kmh: number
  current_location: string
  current_lat: number
  current_lon: number
  status: "idle" | "assigned" | "in_transit"
  partner_id?: number | null
  partner_name?: string | null
  is_available: boolean
  availability_status: "available" | "unavailable"
  next_available_time: string | null
  current_unavailability: VehicleAvailabilityRecord | null
}

export interface Waypoint {
  id: number
  location: string
  lat: number | null
  lon: number | null
  arrived_at: string | null
  sequence: number
}

export interface SensorReading {
  id: number
  timestamp: string
  vibration: number
  temperature_c: number
  moisture_pct: number
}

export interface HealthScore {
  id: number
  timestamp: string
  score: number
  risk_level: "good" | "moderate" | "high" | "critical"
  detail: {
    violations: string[]
    thresholds_used: Record<string, number>
    raw_model_score: number
  }
}

export interface HaulitOrder {
  id: number
  track_id: string
  user_id: number
  vehicle: HaulitVehicle | null
  pickup: string
  pickup_lat: number
  pickup_lon: number
  delivery: string
  delivery_lat: number
  delivery_lon: number
  weight_kg: number
  cargo_type: string
  status: string
  eta: string | null
  created_at: string
  updated_at: string
  price?: number | null
  distance_km?: number | null
  truck_type?: string | null
  payment_status?: string | null
  return_status?: string | null
  return_reason?: string | null
  refund_amount?: number | null
  return_policy_agreed?: boolean | null
  waypoints: Waypoint[]
  latest_health: HealthScore | null
  latest_sensor: SensorReading | null
}

export interface CreateOrderPayload {
  pickup: string
  pickup_lat: number
  pickup_lon: number
  delivery: string
  delivery_lat: number
  delivery_lon: number
  weight_kg: number
  cargo_type: string
  truck_type?: string
  distance_km?: number
  payment_status?: string
  vehicle_id?: number | null
}

export interface SensorPayload {
  vibration: number
  temperature_c: number
  moisture_pct: number
}

export interface FleetSummary {
  total: number
  idle: number
  assigned: number
  in_transit: number
  available: number
  unavailable: number
}

export interface FleetActiveOrder {
  track_id: string
  pickup: string
  delivery: string
  weight_kg: number
  cargo_type: string
  status: string
  eta: string | null
  user_id: number
}

export interface FleetVehicle extends HaulitVehicle {
  active_order: FleetActiveOrder | null
}

export interface TruckLocation {
  demo_mode: boolean
  status: string
  lat: number
  lon: number
  progress: number
  remaining_km: number
  eta_minutes: number | null
  pickup_lat: number
  pickup_lon: number
  delivery_lat: number
  delivery_lon: number
}

export interface CargoThresholds {
  vibration_min: number
  vibration_max: number
  temp_min: number
  temp_max: number
  moisture_min: number
  moisture_max: number
}

// Per-cargo threshold map matching backend config
export const CARGO_THRESHOLDS: Record<string, CargoThresholds> = {
  standard: { vibration_min: 0.1, vibration_max: 0.5, temp_min: -10, temp_max: 35, moisture_min: 30, moisture_max: 70 },
  fragile:  { vibration_min: 0.0, vibration_max: 0.3, temp_min: 15,  temp_max: 25, moisture_min: 45, moisture_max: 55 },
  hazmat:   { vibration_min: 0.0, vibration_max: 1.0, temp_min: -40, temp_max: 55, moisture_min: 40, moisture_max: 60 },
  oversized:{ vibration_min: 0.0, vibration_max: 0.8, temp_min: -10, temp_max: 35, moisture_min: 0,  moisture_max: 15 },
}
