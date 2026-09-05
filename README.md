#  HAULIT — Next-Gen Logistics & Freight Management Platform

<div align="center">

[![Next.js](https://img.shields.io/badge/Next.js-15.2-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-38bdf8?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776ab?style=for-the-badge&logo=python&logoColor=white)](https://python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0-white?style=for-the-badge&logo=flask&logoColor=black)](https://flask.palletsprojects.com/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.0+-ee4c2c?style=for-the-badge&logo=pytorch&logoColor=white)](https://pytorch.org/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003b57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org/)

**Simplifying local logistics across India. Reliable trucks, affordable rates, real-time IoT luggage health monitoring, and smart dispatch.**

[Explore Features](#-core-features) • [Architecture](#-system-architecture) • [Getting Started](#-getting-started) • [API Reference](#-complete-api-reference) • [ML & IoT Engine](#-iot-telemetry--ai-health-engine) • [Deployment](#-deployment-guide)

</div>

---

##  Overview & Vision

**HAULIT** is an intelligent, full-stack logistics and intra-city/inter-city freight orchestration platform tailored for the Indian supply chain ecosystem. In India, local freight transportation has traditionally been fragmented, opaque in pricing, and plagued by empty return trips ("deadheading"). Small business owners, retailers, farmers, and manufacturers often struggle with unpredictable freight costs and lack of visibility into the condition of sensitive cargo.

HAULIT solves these problems through:
1. **Algorithmic Vehicle Matching**: Matching consignment weight and cargo sensitivity to the most cost-effective vehicle tier.
2. **Anti-Empty Truck Dispatcher**: Reallocating idle return-leg capacity to reduce costs and carbon footprint.
3. **IoT Telemetry & AI Cargo Health**: A trained PyTorch machine learning model that processes real-time sensor streams (vibration, temperature, moisture) to compute luggage integrity scores and trigger automated threshold alerts.
4. **Modern Neomorphic UI**: A sleek, accessible soft-shadow neomorphic interface built with **Next.js 15**, **React 19**, and **Tailwind CSS v4**.

---

##  Core Features

### 1.  Smart Vehicle Dispatcher
- Auto-evaluates consignment weight against tiered payload capacities:
  - **≤ 250 kg**: Mini Truck (*Tata Ace / "Chhota Hathi"*)
  - **≤ 1,500 kg**: Small Commercial Vehicle (*Tata 407*)
  - **≤ 5,000 kg**: Medium Duty Truck (*Eicher Pro*)
  - **≤ 15,000 kg**: Large Heavy Truck (*Ashok Leyland 1618*)
  - **> 15,000 kg**: Multi-Axle Heavy Hauler (*Volvo FH*)
- Locates nearest idle vehicles using spherical distance formulas (Haversine calculation).
- Generates human-friendly tracking identifiers (e.g., `HLT-4105-IN`).

### 2.  Real-Time Shipment Tracking
- **Live 1-second interval polling** for sub-second status synchronization.
- **Deep-linking support**: Navigate directly to `/track?id=HLT-XXXX-IN` to auto-load shipment details.
- **6-Stage Journey Timeline**:
  - `Order Placed` &rarr; `Driver Assigned` &rarr; `Picked Up` &rarr; `In Transit` &rarr; `Out for Delivery` &rarr; `Delivered`.
- **Dynamic Waypoints**: Records exact timestamps as drivers transition through key journey milestones.

### 3.  IoT Telemetry & ML Luggage Health
- Monitors tri-axial vibration ($g$), temperature ($^\circ\text{C}$), and relative moisture ($\%$).
- Evaluates readings against a custom PyTorch deep neural network and cargo-specific safety envelopes (Standard, Fragile, Hazmat, Oversized).
- Computes an interactive circular **Health Gauge (0–100)** with dynamic color gradations:
  - **Good (85–100)**: All parameters normal.
  - **Moderate (65–84)**: Minor deviation.
  - **High (40–64)**: Risk threshold violated.
  - **Critical (0–39)**: Active damage risk detected.
- Generates descriptive AI alerts for cold-chain breaks, excessive shocks, or moisture intrusion.

### 4.  Driver & Telemetry Simulator Dashboard
- Interactive control panel designed for fleet operators and drivers.
- **Manual Sensor Sliders**: Real-time manipulation of vibration ($0 - 5g$), temperature ($-10^\circ\text{C} - 70^\circ\text{C}$), and moisture ($0 - 100\%$).
- **Autonomous Simulation Loop**: Built-in 5-second automated jitter generator that simulates road roughness, weather variance, and engine harmonics.
- **Status Advancement**: One-click sequential progression of order lifecycle states.
- **Real-Time Telemetry Log**: Terminal-style live log displaying timestamped sensor packets, AI responses, and error events.

### 5.  Fleet Command Center
- High-level operational metrics: Total Vehicles, Idle, Assigned, and In-Transit.
- Live status filters with item counts.
- Interactive vehicle cards with animated capacity progress bars, current GPS coordinates, and linked active order summaries.

### 6. Secure JWT Authentication
- Stateless JSON Web Token authentication with bcrypt password hashing.
- Client-side persistence and hydration guards to prevent SSR mismatch.
- Conditional UI states (personalized greetings, authenticated order tracking, instant logout).

---

##  System Architecture

```
                                  ┌──────────────────────────────┐
                                  │       Client Browser         │
                                  │   (Next.js Pages Router)     │
                                  └──────────────┬───────────────┘
                                                 │
                        HTTP / JSON (REST API)   │   Rewrites via next.config.ts
                                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                Flask Backend (Port 5000)                               │
│                                                                                        │
│  ┌───────────────────────┐   ┌───────────────────────┐   ┌──────────────────────────┐  │
│  │      Auth Module      │   │     Orders Module     │   │     Vehicles Module      │  │
│  │  /api/auth/{login,    │   │  /api/orders/         │   │  /api/vehicles/          │  │
│  │   register, me}       │   │  /api/orders/<id>     │   │  /api/vehicles/fleet     │  │
│  └───────────────────────┘   └───────────┬───────────┘   └──────────────────────────┘  │
│                                          │                                             │
│                       ┌──────────────────┴──────────────────┐                          │
│                       ▼                                     ▼                          │
│         ┌───────────────────────────┐         ┌───────────────────────────┐            │
│         │   Smart Dispatch Service  │         │   PyTorch ML Health Engine│            │
│         │  - Vehicle Selector       │         │  - Sensor Inference       │            │
│         │  - Anti-Empty Trucking    │         │  - Weights: weights.pt    │            │
│         │  - ETA Calculation        │         │  - Threshold Violations   │            │
│         └─────────────┬─────────────┘         └─────────────┬─────────────┘            │
│                       │                                     │                          │
│                       └──────────────────┬──────────────────┘                          │
│                                          ▼                                             │
│                             ┌─────────────────────────┐                                │
│                             │   SQLAlchemy ORM Layer  │                                │
│                             └────────────┬────────────┘                                │
│                                          ▼                                             │
│                             ┌─────────────────────────┐                                │
│                             │   SQLite DB (haulit.db) │                                │
│                             └─────────────────────────┘                                │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

##  Repository Directory Structure

```text
Haulit/
├── frontend/                         # Next.js 15 Frontend Application
│   ├── public/                       # Static public assets
│   │   ├── assets/                   # Brand logo & high-resolution carousel slides
│   │   │   ├── haulit.png            # Official HAULIT logo
│   │   │   ├── c1.png                # Hero slide 1
│   │   │   ├── c2.png                # Hero slide 2
│   │   │   └── c3.png                # Hero slide 3
│   │   ├── favicon.svg               # Application icon
│   │   └── icons.svg                 # Vector iconography
│   ├── src/
│   │   ├── components/               # Modular UI components
│   │   │   ├── Navbar.tsx            # Navigation bar with auth & route detection
│   │   │   ├── HeroCarousel.tsx      # Neomorphic 3-second auto-cycle carousel
│   │   │   └── AuthModal.tsx         # Login & Register modal dialog
│   │   ├── lib/
│   │   │   └── api.ts                # Fully-typed API client & TypeScript interfaces
│   │   ├── pages/                    # Next.js Pages Router
│   │   │   ├── _app.tsx              # Application wrapper, global layout & styling
│   │   │   ├── _document.tsx         # HTML document shell, Google Fonts & Material Symbols
│   │   │   ├── index.tsx             # Landing hero page
│   │   │   ├── order.tsx             # Consignment creation with smart dispatch tiers
│   │   │   ├── track.tsx             # Real-time shipment tracking with health telemetry
│   │   │   ├── dashboard.tsx         # Driver telemetry simulator & status progression
│   │   │   └── fleet.tsx             # Fleet overview & vehicle capacity indicators
│   │   └── styles/
│   │       └── globals.css           # Tailwind CSS v4 theme, shadows & animations
│   ├── next.config.ts                # Next.js config & API proxy rewrites
│   ├── postcss.config.mjs            # PostCSS plugin for Tailwind v4
│   ├── tsconfig.json                 # TypeScript configuration
│   ├── vercel.json                   # Vercel deployment configuration
│   └── package.json                  # Frontend dependencies
│
├── backend/                          # Python Flask Backend Application
│   ├── auth/                         # Authentication & user identity
│   │   ├── __init__.py
│   │   └── routes.py                 # Registration, login, and profile endpoints
│   ├── orders/                       # Order lifecycle management
│   │   ├── __init__.py
│   │   └── routes.py                 # Order creation, lookup, sensor ingestion, status advance
│   ├── vehicles/                     # Fleet operations
│   │   ├── __init__.py
│   │   └── routes.py                 # Fleet overview, vehicle listings, updates
│   ├── services/                     # Business logic services
│   │   ├── __init__.py
│   │   ├── vehicle_selector.py       # Nearest vehicle & payload capacity algorithm
│   │   ├── eta.py                    # Distance & travel duration estimator
│   │   └── anti_empty_truck.py       # Return-leg load reassignment logic
│   ├── ml/                           # Machine learning subsystem
│   │   ├── __init__.py
│   │   ├── health_model.py           # PyTorch neural network & rule-based scoring
│   │   └── weights.pt                # Pre-trained model weights
│   ├── app.py                        # Flask server entry point & CORS configuration
│   ├── config.py                     # App configuration (JWT, database URI, secrets)
│   ├── extensions.py                 # SQLAlchemy & JWT manager instances
│   ├── models.py                     # Database schemas (User, Vehicle, Order, etc.)
│   ├── requirements.txt              # Python library dependencies
│   ├── seed.py                       # Initial fleet & user database seeder
│   └── haulit.db                     # SQLite database file
│
├── .gitignore                        # Global ignore patterns
└── README.md                         # Comprehensive documentation
```

---

##  Tech Stack & Libraries

### Frontend
- **Framework**: [Next.js 15.2](https://nextjs.org/) (Pages Router)
- **Library**: [React 19.0](https://react.dev/)
- **Language**: [TypeScript 5](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4.0](https://tailwindcss.com/) with PostCSS
- **Design System**: Neomorphic Soft-UI with custom inner/outer dual shadows
- **Fonts & Icons**: Google [Hanken Grotesk](https://fonts.google.com/specimen/Hanken+Grotesk) + [Material Symbols Outlined](https://fonts.google.com/icons)

### Backend
- **Framework**: [Flask 3.0](https://flask.palletsprojects.com/)
- **Language**: [Python 3.11+](https://www.python.org/)
- **ORM & DB**: [Flask-SQLAlchemy](https://flask-sqlalchemy.palletsprojects.com/) + SQLite
- **Security**: [Flask-JWT-Extended](https://flask-jwt-extended.readthedocs.io/) + bcrypt
- **Machine Learning**: [PyTorch 2.0+](https://pytorch.org/)

---

##  Getting Started

### Prerequisites
Make sure you have the following installed on your machine:
- **Node.js** (v18.17+ or v20+ recommended) & **npm** (v9+)
- **Python** (v3.10 or v3.11 recommended) & **pip**
- **Git**

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/harshilguptahgs2007-ux/Haulit.git
cd Haulit
```

---

### Step 2: Backend Setup & Launch

1. Open a terminal and navigate to the `backend/` folder:
   ```bash
   cd backend
   ```

2. Create and activate a virtual environment:
   ```bash
   # Windows (PowerShell)
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # Linux / macOS
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

4. *(Optional)* Seed the database with sample trucks and test users:
   ```bash
   python seed.py
   ```
   > **Seed Accounts Created:**
   > - Demo User: `demo@haulit.in` | Password: `password123`
   > - Manager: `manager@gmail.com` | Password: `password123`

5. Start the Flask API server:
   ```bash
   python app.py
   ```
   The backend will be live at **`http://localhost:5000`**.

---

### Step 3: Frontend Setup & Launch

1. Open a second terminal window and navigate to the `frontend/` folder:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Next.js development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to **`http://localhost:3000`**.

---

##  Complete API Reference

###  Authentication Endpoints

#### `POST /api/auth/register`
Register a new customer account.
- **Request Body:**
  ```json
  {
    "name": "Rahul Sharma",
    "email": "rahul@example.com",
    "password": "strongpassword123"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "name": "Rahul Sharma",
      "email": "rahul@example.com",
      "created_at": "2026-09-05T18:00:00.000000Z"
    }
  }
  ```

#### `POST /api/auth/login`
Authenticate an existing account.
- **Request Body:**
  ```json
  {
    "email": "rahul@example.com",
    "password": "strongpassword123"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "name": "Rahul Sharma",
      "email": "rahul@example.com"
    }
  }
  ```

#### `GET /api/auth/me`
Retrieve details of the currently authenticated user.
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):** Current `User` object.

---

###  Orders Endpoints

#### `POST /api/orders/`
Create and automatically dispatch a new shipment order.
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "pickup": "Mumbai",
    "pickup_lat": 19.0760,
    "pickup_lon": 72.8777,
    "delivery": "Delhi",
    "delivery_lat": 28.7041,
    "delivery_lon": 77.1025,
    "weight_kg": 450.0,
    "cargo_type": "standard"
  }
  ```
  *(Supported cargo types: `standard`, `fragile`, `hazmat`, `oversized`)*
- **Response (201 Created):**
  ```json
  {
    "order": {
      "id": 12,
      "track_id": "HLT-8924-IN",
      "status": "assigned",
      "pickup": "Mumbai",
      "delivery": "Delhi",
      "weight_kg": 450.0,
      "cargo_type": "standard",
      "eta": "2026-09-06T14:30:00.000Z",
      "vehicle": {
        "id": 2,
        "name": "Tata 407 (MH-04-AB-1234)",
        "capacity_kg": 1500.0,
        "avg_speed_kmh": 45.0,
        "current_location": "Mumbai",
        "status": "assigned"
      },
      "waypoints": [
        { "id": 1, "location": "Mumbai", "sequence": 0, "arrived_at": null },
        { "id": 2, "location": "In Transit", "sequence": 1, "arrived_at": null },
        { "id": 3, "location": "Delhi", "sequence": 2, "arrived_at": null }
      ]
    }
  }
  ```

#### `GET /api/orders/<track_id>`
Fetch comprehensive live order details by tracking ID.
- **Response (200 OK):** Full `HaulitOrder` payload with vehicle, waypoints, latest health score, and latest sensor telemetry.

#### `GET /api/orders/my`
List all active and past orders placed by the authenticated user.
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):** Array of `HaulitOrder` objects.

#### `PUT /api/orders/<track_id>/status`
Advance or update an order's lifecycle status.
- **Request Body:**
  ```json
  { "status": "in_transit" }
  ```
  *(Allowed values: `pending`, `assigned`, `picked_up`, `in_transit`, `out_for_delivery`, `delivered`, `cancelled`)*
- **Response (200 OK):** Updated `HaulitOrder` object.

#### `POST /api/orders/<track_id>/sensor`
Ingest real-time IoT sensor telemetry and trigger ML luggage health evaluation.
- **Request Body:**
  ```json
  {
    "vibration": 1.45,
    "temperature_c": 24.5,
    "moisture_pct": 32.0
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "sensor": {
      "id": 108,
      "timestamp": "2026-09-05T20:30:00.000Z",
      "vibration": 1.45,
      "temperature_c": 24.5,
      "moisture_pct": 32.0
    },
    "health": {
      "score": 92.4,
      "risk_level": "good",
      "detail": {
        "violations": [],
        "thresholds_used": { "max_vibration": 2.5, "max_temp": 45.0, "max_moisture": 60.0 },
        "raw_model_score": 0.924
      }
    }
  }
  ```

---

###  Vehicles & Fleet Endpoints

#### `GET /api/vehicles/fleet`
Retrieve aggregate fleet status metrics and all vehicles with their active orders.
- **Response (200 OK):**
  ```json
  {
    "summary": {
      "total": 8,
      "idle": 4,
      "assigned": 2,
      "in_transit": 2
    },
    "vehicles": [
      {
        "id": 1,
        "name": "Tata Ace (MH-01-AX-9901)",
        "capacity_kg": 250.0,
        "avg_speed_kmh": 40.0,
        "current_location": "Mumbai",
        "status": "in_transit",
        "active_order": {
          "track_id": "HLT-4105-IN",
          "pickup": "Mumbai",
          "delivery": "Pune",
          "weight_kg": 180.0,
          "cargo_type": "standard",
          "status": "in_transit",
          "eta": "2026-09-05T23:00:00Z"
        }
      }
    ]
  }
  ```

---

##  IoT Telemetry & AI Health Engine

The cargo health scoring system evaluates continuous sensor telemetry against physical safety envelopes determined by the consignment's cargo class:

$$\text{Health Score} = \max\left(0, 100 - \sum \text{Penalties}\right)$$

### Cargo Safety Envelopes

| Cargo Class | Max Vibration ($g$) | Temp Range ($^\circ\text{C}$) | Max Moisture ($\%$) | Severity Multiplier |
| :--- | :---: | :---: | :---: | :---: |
| **Standard** | $2.5\,g$ | $0^\circ\text{C} \text{ to } 50^\circ\text{C}$ | $75\%$ | $1.0\times$ |
| **Fragile** | $0.8\,g$ | $10^\circ\text{C} \text{ to } 35^\circ\text{C}$ | $50\%$ | $2.2\times$ |
| **Hazmat** | $1.2\,g$ | $-5^\circ\text{C} \text{ to } 30^\circ\text{C}$ | $40\%$ | $2.5\times$ |
| **Oversized** | $3.5\,g$ | $-10^\circ\text{C} \text{ to } 60^\circ\text{C}$ | $85\%$ | $0.8\times$ |

If any telemetry stream exceeds safe limits, violations are flagged immediately (e.g., *"Excessive vibration for fragile cargo"* or *"Temperature exceeded cold-chain ceiling"*).

---

##  Design System & Neomorphic Styling

HAULIT uses a soft-shadow **Neomorphic** visual language designed with Tailwind CSS v4 variables:

```css
/* Dual Light/Dark Shadows on Surface Background #f0f0f3 */
.neo-shadow {
  box-shadow: 8px 8px 16px #aeaec0, -8px -8px 16px #ffffff;
}

/* Subtle Elevations for Buttons and Badges */
.neo-shadow-sm {
  box-shadow: 4px 4px 8px #aeaec0, -4px -4px 8px #ffffff;
}

/* Inset Depressions for Input Fields & Active Controls */
.neo-shadow-inner {
  box-shadow: inset 6px 6px 12px #aeaec0, inset -6px -6px 12px #ffffff;
}
```

---

##  Deployment Guide

### Deploy Frontend to Vercel
1. Push your changes to GitHub.
2. Sign in to [Vercel](https://vercel.com/) and click **"New Project"**.
3. Import the `Haulit` repository.
4. Set the **Root Directory** to `frontend`.
5. Set the Environment Variable:
   - `NEXT_PUBLIC_API_URL`: Your hosted backend URL (e.g., `https://api.haulit.in`).
6. Click **Deploy**. Vercel will automatically build and publish the Next.js app.

### Deploy Backend to Render / Railway
1. Create a new Web Service on [Render](https://render.com/) or [Railway](https://railway.app/).
2. Point the service to the `backend/` directory of your repository.
3. Set the build command: `pip install -r requirements.txt`.
4. Set the start command: `gunicorn app:app` or `python app.py`.
5. Add environment variables:
   - `SECRET_KEY`: A secure random string.
   - `JWT_SECRET_KEY`: A secure random string.
   - `PORT`: `5000`.

---

## Contributing

Contributions, bug reports, and suggestions are welcome!

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/amazing-feature`.
3. Commit your changes: `git commit -m "feat: add amazing feature"`.
4. Push to your branch: `git push origin feature/amazing-feature`.
5. Open a Pull Request.

---

##  License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

<div align="center">
  <sub>Built for Indian Logistics & Transportation.</sub>
</div>
