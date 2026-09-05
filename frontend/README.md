# 🚚 HAULIT — Frontend Application (Next.js 15)

<div align="center">

[![Next.js](https://img.shields.io/badge/Next.js-15.2-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-38bdf8?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

</div>

This is the standalone Next.js frontend for **HAULIT**, featuring a soft-shadow neomorphic design, real-time shipment tracking, luggage health indicators, and an interactive driver sensor simulation console.

---

## 🏗️ Architecture

- **Routing Architecture**: Next.js Pages Router (`src/pages/`)
- **Styling**: Tailwind CSS v4 with `@theme` design tokens and Neomorphic CSS classes
- **Icons & Fonts**: Google Material Symbols Outlined + Hanken Grotesk
- **API Communication**: Typed client ([`src/lib/api.ts`](src/lib/api.ts)) with `NEXT_PUBLIC_API_URL` environment override and Next.js proxy rewrites

---

## 📁 Directory Layout

```text
frontend/
├── public/
│   ├── assets/               # Brand logo (haulit.png) & high-res carousel slides (c1, c2, c3)
│   ├── favicon.svg           # Brand favicon
│   └── icons.svg             # SVG symbol sheets
├── src/
│   ├── components/           # Reusable components
│   │   ├── Navbar.tsx        # Responsive navigation with authentication state
│   │   ├── HeroCarousel.tsx  # 3000ms automated crossfade image carousel
│   │   └── AuthModal.tsx     # Login and registration modal dialog
│   ├── lib/
│   │   └── api.ts            # Type-safe API client (Orders, Vehicles, Auth)
│   ├── pages/                # Application routes
│   │   ├── _app.tsx          # App shell, Navbar & Neomorphic Footer
│   │   ├── _document.tsx     # HTML shell, Google Fonts & Icons
│   │   ├── index.tsx         # Hero landing page
│   │   ├── order.tsx         # Consignment booking & smart dispatch
│   │   ├── track.tsx         # Real-time shipment tracking with luggage health gauge
│   │   ├── dashboard.tsx     # Driver sensor simulator & status control panel
│   │   └── fleet.tsx         # Fleet metrics & vehicle capacity indicators
│   └── styles/
│       └── globals.css       # Tailwind v4 theme, shadows & animations
├── next.config.ts            # Next.js config & API proxy rewrites
├── postcss.config.mjs        # PostCSS configuration for Tailwind v4
├── tsconfig.json             # TypeScript configuration
├── vercel.json               # Vercel deployment configuration
└── package.json              # Dependencies & npm scripts
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the application.

### 3. Production Build
```bash
npm run build
npm run start
```

---

## ⚙️ Environment Variables

Create a `.env.local` file to point to a custom backend:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```
If not specified, requests default to `http://localhost:5000`.

---

## 🎨 Design System

The app utilizes custom neomorphic utilities:
- `.neo-shadow`: Raised soft surface
- `.neo-shadow-sm`: Subtle component elevation
- `.neo-shadow-inner`: Inset input and status badge depression
- `.connecting-animation`: Radiating radar animation
