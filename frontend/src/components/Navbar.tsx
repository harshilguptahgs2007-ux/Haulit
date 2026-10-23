import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import AuthModal from './AuthModal'
import { api } from '../lib/api'

interface NavItem {
  to: string
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { to: '/',          label: 'Home'      },
  { to: '/pricing',   label: 'Pricing'   },
  { to: '/order',     label: 'Order'     },
  { to: '/track',     label: 'Track'     },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/fleet',     label: 'Fleet'     },
]

export default function Navbar(): React.ReactElement {
  const router = useRouter()
  const pathname = router.pathname
  const [showAuth, setShowAuth] = useState(false)
  const [userName, setUserName] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    async function syncAuth() {
      if (typeof window === 'undefined') return
      const token = localStorage.getItem('haulit_token')
      let stored = localStorage.getItem('haulit_user_name')

      if (token) {
        if (!stored) {
          try {
            const me = await api.auth.me()
            if (me && me.name) {
              stored = me.name
              localStorage.setItem('haulit_user_name', me.name)
            }
          } catch {
            localStorage.removeItem('haulit_token')
            localStorage.removeItem('haulit_user_name')
            setUserName(null)
            return
          }
        }
        setUserName(stored)
      } else {
        setUserName(null)
      }
    }

    syncAuth()
    window.addEventListener('haulit_auth_change', syncAuth)
    window.addEventListener('storage', syncAuth)
    return () => {
      window.removeEventListener('haulit_auth_change', syncAuth)
      window.removeEventListener('storage', syncAuth)
    }
  }, [])

  function handleAuthSuccess(token: string, name: string) {
    localStorage.setItem('haulit_token', token)
    localStorage.setItem('haulit_user_name', name)
    setUserName(name)
    setShowAuth(false)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('haulit_auth_change'))
    }
  }

  function handleLogout() {
    localStorage.removeItem('haulit_token')
    localStorage.removeItem('haulit_user_name')
    setUserName(null)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('haulit_auth_change'))
    }
  }

  return (
    <>
      <nav className="fixed top-0 w-full z-50 bg-[var(--color-surface-bg)] border-b border-[var(--color-surface-container-highest)] neo-shadow-sm transition-all duration-300">
        <div className="max-w-[var(--spacing-container-max-width)] mx-auto flex items-center justify-between px-[var(--spacing-gutter)] py-4">

          <Link href="/" className="flex items-center gap-3">
            <div className="w-11 h-11 neo-shadow-sm flex flex-col relative justify-center items-center rounded-full overflow-hidden">
              <img
                className="absolute w-[4.5rem] mt-0.5 ml-[0.5px] max-w-none"
                src="/assets/haulit.png"
                alt="HAULIT Logo"
              />
            </div>
            <span className="text-4xl font-black text-[var(--color-primary)] uppercase tracking-tighter leading-none">
              HAULIT
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-4 bg-[var(--color-surface-bg)] px-6 py-2 rounded-full neo-shadow-inner">
            {NAV_ITEMS.map(({ to, label }) => {
              const isActive = to === '/' ? pathname === '/' : pathname.startsWith(to)
              return (
                <Link
                  key={to}
                  href={to}
                  className={
                    isActive
                      ? 'text-[var(--color-primary)] font-bold text-[var(--text-label-md)] tracking-widest uppercase px-4 py-2 rounded-full bg-[var(--color-surface-bg)] neo-shadow-sm transition-all'
                      : 'text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors text-[var(--text-label-md)] tracking-widest uppercase px-4 py-2 rounded-full hover:bg-[var(--color-surface-bg)] hover:neo-shadow-sm'
                  }
                >
                  {label}
                </Link>
              )
            })}
          </div>

          <div className="flex items-center gap-4">
            {mounted && userName ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-[var(--color-surface-bg)] px-3.5 py-2 rounded-full neo-shadow text-xs font-bold text-[var(--color-primary)]">
                  <span className="material-symbols-outlined text-[var(--color-primary)] text-sm">account_circle</span>
                  <span className="truncate max-w-[120px]">
                    {userName}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-xs tracking-wider uppercase text-[var(--color-secondary)] hover:text-red-500 transition-colors px-2 py-1 font-semibold"
                  title="Logout"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="text-xs tracking-widest uppercase text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors px-4 py-2 font-bold rounded-full neo-shadow hover:neo-shadow-sm active:neo-shadow-inner"
              >
                Login
              </button>
            )}
            <Link
              href="/order"
              className="bg-[var(--color-surface-bg)] text-[var(--color-primary)] font-bold text-[var(--text-label-md)] tracking-widest uppercase px-6 py-2.5 rounded-full neo-shadow hover:neo-shadow-sm active:neo-shadow-inner transition-all duration-200"
            >
              Ship Now
            </Link>
          </div>
        </div>
      </nav>

      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onSuccess={handleAuthSuccess}
        />
      )}
    </>
  )
}
