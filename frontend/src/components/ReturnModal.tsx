import React, { useState } from 'react'
import { api, type HaulitOrder, type ReturnResponse } from '../lib/api'

interface ReturnModalProps {
  order: HaulitOrder
  onClose: () => void
  onSuccess: (updatedOrder: HaulitOrder) => void
}

export default function ReturnModal({ order, onClose, onSuccess }: ReturnModalProps): React.ReactElement {
  const [reason, setReason] = useState<'customer_cancellation' | 'company_fault'>('customer_cancellation')
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ReturnResponse | null>(null)

  const price = order.price && order.price > 0 ? order.price : 0
  const refundRate = reason === 'company_fault' ? 0.90 : 0.50
  const calculatedRefund = (price * refundRate).toFixed(2)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!agreed) {
      setError('You must agree to the Return Policy conditions to proceed.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await api.orders.requestReturn(order.track_id, {
        reason,
        policy_agreed: true,
      })
      setResult(res)
      onSuccess(res.order)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to process return request')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(11,28,48,0.45)', backdropFilter: 'blur(8px)' }}
    >
      <div className="bg-[var(--color-surface-bg)] rounded-3xl p-6 sm:p-8 w-full max-w-xl mx-auto neo-shadow border border-[var(--color-surface-container-highest)] my-8">
        {result ? (
          <div className="text-center space-y-6 py-4">
            <div className="w-20 h-20 rounded-full mx-auto bg-[var(--color-surface-bg)] neo-shadow flex items-center justify-center text-emerald-500">
              <span className="material-symbols-outlined text-4xl">assignment_turned_in</span>
            </div>
            <div>
              <h3 className="text-[var(--text-headline-md)] font-black text-[var(--color-on-surface)]">
                Return Processed
              </h3>
              <p className="text-[var(--text-body-md)] text-[var(--color-secondary)] mt-1">
                Your order cancellation & refund have been recorded.
              </p>
            </div>

            <div className="neo-shadow-inner rounded-2xl p-5 text-left space-y-3">
              <div className="flex justify-between items-center text-sm border-b border-[var(--color-surface-container-highest)] pb-2">
                <span className="text-[var(--color-on-surface-variant)] uppercase tracking-wider font-semibold text-xs">Tracking ID</span>
                <span className="font-mono font-bold text-[var(--color-primary)]">{result.order.track_id}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-[var(--color-surface-container-highest)] pb-2">
                <span className="text-[var(--color-on-surface-variant)] uppercase tracking-wider font-semibold text-xs">Return Type</span>
                <span className="font-semibold text-[var(--color-on-surface)]">{result.refund.label}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-[var(--color-surface-container-highest)] pb-2">
                <span className="text-[var(--color-on-surface-variant)] uppercase tracking-wider font-semibold text-xs">Refund Percentage</span>
                <span className="font-bold text-emerald-600">{result.refund.refund_percentage}%</span>
              </div>
              <div className="flex justify-between items-center text-base pt-1">
                <span className="font-bold text-[var(--color-on-surface)]">Refund Amount:</span>
                <span className="font-black text-xl text-emerald-600">₹{result.refund.formatted_refund}</span>
              </div>
              <p className="text-xs text-[var(--color-error)] font-medium mt-2 bg-red-50 p-2.5 rounded-lg border border-red-200">
                Notice: {result.refund.damage_disclaimer}.
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-[var(--color-surface-bg)] text-[var(--color-primary)] text-[var(--text-label-md)] tracking-widest uppercase py-4 rounded-xl neo-shadow hover:neo-shadow-sm active:neo-shadow-inner transition-all duration-200 font-bold"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--color-surface-container-highest)] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--color-surface-bg)] neo-shadow flex items-center justify-center text-[var(--color-primary)]">
                  <span className="material-symbols-outlined text-xl">undo</span>
                </div>
                <div>
                  <h3 className="text-[var(--text-headline-md)] font-extrabold text-[var(--color-on-surface)]">
                    Return / Cancel Order
                  </h3>
                  <p className="text-xs text-[var(--color-secondary)]">Track ID: <span className="font-mono font-bold text-[var(--color-primary)]">{order.track_id}</span></p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full neo-shadow flex items-center justify-center text-[var(--color-secondary)] hover:text-[var(--color-primary)]"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="neo-shadow-inner rounded-2xl p-5 bg-[var(--color-surface-bg)] space-y-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--color-primary)] text-sm">gavel</span>
                <span className="text-[var(--text-label-md)] tracking-widest uppercase font-bold text-[var(--color-on-surface)]">
                  Haulit Return & Cancellation Policy
                </span>
              </div>
              <p className="text-xs leading-relaxed text-[var(--color-on-surface-variant)] text-justify">
                Orders can be cancelled or returned under the following strict conditions. If a return or cancellation
                is initiated by the customer, a <strong>50% refund</strong> of the total booking payment will be issued.
                If the cancellation or return occurs due to company or logistics fault (such as vehicle breakdown, unexpected
                operational delays, or dispatch errors), a <strong>90% refund</strong> will be returned. Please note that{' '}
                <strong className="text-[var(--color-error)]">no damage payment or compensation is provided by Haulit under any circumstances</strong>.
                By accepting, you agree to these binding terms.
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-[var(--text-label-md)] tracking-widest uppercase font-bold text-[var(--color-on-surface)] block">
                Select Return Reason
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  onClick={() => setReason('customer_cancellation')}
                  className={`p-4 rounded-xl cursor-pointer transition-all border ${
                    reason === 'customer_cancellation'
                      ? 'neo-shadow-inner border-[var(--color-primary)]/40 bg-[var(--color-surface-bg)]'
                      : 'neo-shadow border-transparent bg-[var(--color-surface-bg)] hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="radio"
                      name="returnReason"
                      checked={reason === 'customer_cancellation'}
                      onChange={() => setReason('customer_cancellation')}
                      className="accent-[var(--color-primary)]"
                    />
                    <span className="font-bold text-sm text-[var(--color-on-surface)]">Customer Cancels</span>
                  </div>
                  <p className="text-xs text-[var(--color-secondary)] ml-5">
                    50% payment return as per policy.
                  </p>
                  <div className="mt-2 text-xs font-bold text-[var(--color-primary)] ml-5">
                    Refund: 50%
                  </div>
                </label>

                <label
                  onClick={() => setReason('company_fault')}
                  className={`p-4 rounded-xl cursor-pointer transition-all border ${
                    reason === 'company_fault'
                      ? 'neo-shadow-inner border-emerald-500/40 bg-[var(--color-surface-bg)]'
                      : 'neo-shadow border-transparent bg-[var(--color-surface-bg)] hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="radio"
                      name="returnReason"
                      checked={reason === 'company_fault'}
                      onChange={() => setReason('company_fault')}
                      className="accent-emerald-600"
                    />
                    <span className="font-bold text-sm text-[var(--color-on-surface)]">Company Fault</span>
                  </div>
                  <p className="text-xs text-[var(--color-secondary)] ml-5">
                    Vehicle breakdown or logistics delay: 90% return.
                  </p>
                  <div className="mt-2 text-xs font-bold text-emerald-600 ml-5">
                    Refund: 90%
                  </div>
                </label>
              </div>
            </div>

            <div className="bg-[var(--color-surface-bg)] neo-shadow rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-[var(--color-on-surface-variant)] uppercase tracking-wider">Estimated Refund</p>
                <p className="text-xs text-[var(--color-secondary)]">Based on order value ₹{price > 0 ? price.toFixed(2) : '0.00'}/-</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-emerald-600">₹{calculatedRefund}/-</span>
                <p className="text-[10px] text-[var(--color-error)] font-semibold mt-0.5">No damage payment from Haulit</p>
              </div>
            </div>

            <div className="neo-shadow-inner rounded-xl p-4 flex items-start gap-3">
              <input
                id="agree-checkbox"
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                className="mt-1 h-4 w-4 rounded accent-[var(--color-primary)] cursor-pointer"
              />
              <label htmlFor="agree-checkbox" className="text-xs text-[var(--color-on-surface)] cursor-pointer select-none leading-relaxed">
                I have read and agree to the <strong>Haulit Return & Cancellation Policy</strong>:
                if customer cancels, <strong>50% payment return</strong>; if company&apos;s fault, <strong>90% return</strong>;
                and I acknowledge that <strong>no damage payment is provided by Haulit</strong>.
              </label>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-[var(--color-error)] text-xs font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">error</span>
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 bg-[var(--color-surface-bg)] text-[var(--color-secondary)] text-[var(--text-label-md)] tracking-widest uppercase py-3.5 rounded-xl neo-shadow hover:neo-shadow-sm active:neo-shadow-inner transition-all duration-200 font-bold"
              >
                Go Back
              </button>
              <button
                type="submit"
                disabled={!agreed || loading}
                className="flex-1 bg-[var(--color-surface-bg)] text-[var(--color-error)] text-[var(--text-label-md)] tracking-widest uppercase py-3.5 rounded-xl neo-shadow hover:neo-shadow-sm active:neo-shadow-inner transition-all duration-200 font-bold disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">{loading ? 'sync' : 'assignment_return'}</span>
                <span>{loading ? 'Processing…' : 'Confirm Return'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
