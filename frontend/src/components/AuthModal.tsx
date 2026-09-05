'use client'

import React, { useState } from 'react'
import { api } from '../lib/api'

interface AuthModalProps {
  onClose: () => void
  onSuccess: (token: string, name: string) => void
}

type Tab = 'login' | 'register'

export default function AuthModal({ onClose, onSuccess }: AuthModalProps): React.ReactElement {
  const [tab, setTab]           = useState<Tab>('login')
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = tab === 'login'
        ? await api.auth.login(email, password)
        : await api.auth.register(name, email, password)
      localStorage.setItem('haulit_token', res.token)
      onSuccess(res.token, res.user.name)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(11,28,48,0.35)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-surface-bg)] rounded-2xl p-8 w-full max-w-md mx-4 neo-shadow relative"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full neo-shadow-sm text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>

        <div className="flex gap-1 mb-8 bg-[var(--color-surface-bg)] p-1 rounded-full neo-shadow-inner w-fit mx-auto">
          {(['login', 'register'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError('') }}
              className={`px-6 py-2 rounded-full text-[var(--text-label-md)] tracking-widest uppercase font-bold transition-all duration-200 ${
                tab === t
                  ? 'neo-shadow text-[var(--color-primary)]'
                  : 'text-[var(--color-secondary)]'
              }`}
            >
              {t === 'login' ? 'Login' : 'Register'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {tab === 'register' && (
            <div>
              <label className="block text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Rahul Sharma"
                required
                className="w-full bg-[var(--color-surface-bg)] border-none neo-shadow-inner focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 rounded-lg px-4 py-3 text-[var(--text-body-md)] text-[var(--color-on-surface)] transition-all"
              />
            </div>
          )}

          <div>
            <label className="block text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full bg-[var(--color-surface-bg)] border-none neo-shadow-inner focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 rounded-lg px-4 py-3 text-[var(--text-body-md)] text-[var(--color-on-surface)] transition-all"
            />
          </div>

          <div>
            <label className="block text-[var(--text-label-md)] tracking-widest uppercase text-[var(--color-on-surface-variant)] mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-[var(--color-surface-bg)] border-none neo-shadow-inner focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 rounded-lg px-4 py-3 text-[var(--text-body-md)] text-[var(--color-on-surface)] transition-all"
            />
          </div>

          {error && (
            <p className="text-[var(--color-error)] text-[var(--text-label-md)] text-center neo-shadow-inner rounded-lg px-4 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--color-surface-bg)] text-[var(--color-primary)] text-[var(--text-label-md)] tracking-widest uppercase py-4 rounded-lg neo-shadow hover:neo-shadow-sm active:neo-shadow-inner transition-all duration-200 font-bold disabled:opacity-50"
          >
            {loading ? 'Please wait…' : tab === 'login' ? 'Login' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
