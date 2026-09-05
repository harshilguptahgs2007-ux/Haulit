const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

function getToken(): string | null {
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
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error || `HTTP ${res.status}`)
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
      request<{ order: HaulitOrder }>("/api/orders/", {
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
    ingestSensor: (trackId: string, data: SensorPayload) =>
      request<{ health: HealthScore; sensor: SensorReading }>(
        `/api/orders/${trackId}/sensor`,
        { method: "POST", body: JSON.stringify(data) }
      ),
  },
  vehicles: {
    list: () => request<{ vehicles: HaulitVehicle[] }>("/api/vehicles/"),
    fleet: () => request<{ summary: FleetSummary; vehicles: FleetVehicle[] }>("/api/vehicles/fleet"),
  },
}

export interface HaulitUser {
  id: number
  name: string
  email: string
  created_at: string
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
