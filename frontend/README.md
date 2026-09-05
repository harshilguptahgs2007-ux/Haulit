# Haulit Frontend (Next.js)

Standalone Next.js frontend with Tailwind CSS v4 and neomorphic design.

## Features
- **Framework**: Next.js 15 (Pages Router)
- **Styling**: Tailwind CSS v4 (@theme), Neomorphic shadows (.neo-shadow, .neo-shadow-sm, .neo-shadow-inner)
- **Pages**:
  - /: Home with Hero Carousel and copy
  - /order: Order creation with city coordinates and smart dispatch
  - /track: Real-time order tracking with luggage health gauge and sensor telemetry
  - /dashboard: Real-time sensor simulation (vibration, temp, moisture) and status controls
  - /fleet: Live vehicle status, capacity bars, and assignment overview
- **API Client**: Configurable via NEXT_PUBLIC_API_URL (defaults to http://localhost:5000)
- **Deployment**: Vercel-ready (ercel.json included)

## Setup & Run
`ash
npm install
npm run dev
`
Open [http://localhost:3000](http://localhost:3000).

## Production Build
`ash
npm run build
npm run start
`
