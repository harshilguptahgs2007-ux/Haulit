# HAULIT Logistics

> **Simplifying local logistics across India. Reliable trucks, affordable rates.**

HAULIT is a modern full-stack logistics and shipment management platform connecting customers with local truck networks at fair, transparent rates.

---

##  Architecture & Project Structure

```text
Haulit/
│
├── frontend/                     # Next.js Frontend Application
│   ├── public/                   # Static assets (logo, carousel images, icons)
│   ├── src/
│   │   ├── components/           # Navbar, HeroCarousel, AuthModal
│   │   ├── lib/                  # Typed API Client (api.ts)
│   │   ├── pages/                # Next.js Pages Router (index, order, track, dashboard, fleet)
│   │   └── styles/               # Tailwind CSS v4 & Neomorphic styles (globals.css)
│   ├── next.config.ts            # API proxy rewrites
│   ├── postcss.config.mjs        # Tailwind v4 PostCSS configuration
│   ├── tsconfig.json             # TypeScript configuration
│   ├── vercel.json               # Vercel deployment configuration
│   └── package.json
│
└── backend/                      # Python Flask Backend
    ├── auth/                     # Authentication & JWT routes (/api/auth)
    ├── orders/                   # Order creation, status & sensor routes (/api/orders)
    ├── vehicles/                 # Fleet & vehicle management routes (/api/vehicles)
    ├── services/                 # Smart vehicle selector, ETA, and anti-empty truck services
    ├── ml/                       # AI luggage health model & weights
    ├── models.py                 # SQLAlchemy DB models (User, Vehicle, Order, Waypoint, Sensor, Health)
    ├── app.py                    # Flask application entry point
    └── requirements.txt          # Python dependencies
```

---

##  Getting Started

### 1. Backend Setup (Flask API)

Navigate to the `backend` folder:
```bash
cd backend
```

Create a virtual environment (optional but recommended):
```bash
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate
```

Install dependencies:
```bash
pip install -r requirements.txt
```

Run database seed (if starting fresh):
```bash
python seed.py
```

Start the Flask backend server (runs on `http://localhost:5000`):
```bash
python app.py
```

---

### 2. Frontend Setup (Next.js)

In a separate terminal, navigate to the `frontend` folder:
```bash
cd frontend
```

Install dependencies:
```bash
npm install
```

Start the Next.js development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

##  Features

- **Landing Experience**: Neomorphic hero card with responsive 3000ms crossfade carousel.
- **Order Placement**: City coordinates auto-matching, consignment weight calculation, and smart dispatch truck tiers (Tata Ace, Tata 407, Eicher, Ashok Leyland, Volvo FH).
- **Live Shipment Tracking**: Real-time 1s polling, 6-stage journey timeline with timestamps, luggage health gauge (0-100), AI risk level alerts, and sensor telemetry (vibration, temperature, moisture).
- **Driver / Sensor Simulation Dashboard**: Interactive sliders, 5s automated sensor jitter loop, order status progression, and live telemetry log.
- **Fleet Management**: Live overview of all fleet vehicles, capacity progress bars, status filtering (All, Idle, Assigned, In Transit), and active order tracking.
- **Authentication**: JWT authentication with user registration, login, and secure local session handling.
