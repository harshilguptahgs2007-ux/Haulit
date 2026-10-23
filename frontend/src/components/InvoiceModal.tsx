import React, { useEffect, useState } from 'react'
import { api, type InvoiceData } from '../lib/api'

interface InvoiceModalProps {
  trackId: string
  initialData?: InvoiceData | null
  onClose: () => void
}

export default function InvoiceModal({ trackId, initialData, onClose }: InvoiceModalProps): React.ReactElement {
  const [invoice, setInvoice] = useState<InvoiceData | null>(initialData || null)
  const [loading, setLoading] = useState<boolean>(!initialData)
  const [error, setError] = useState<string>('')
  const [copied, setCopied] = useState<boolean>(false)

  useEffect(() => {
    if (initialData) return

    let isMounted = true
    setLoading(true)
    setError('')

    api.orders
      .getInvoice(trackId)
      .then((data) => {
        if (isMounted) {
          setInvoice(data)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load invoice')
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [trackId, initialData])

  function handlePrint() {
    window.print()
  }

  function handleCopyTrackUrl() {
    if (!invoice) return
    const url = typeof window !== 'undefined'
      ? `${window.location.origin}/track?id=${invoice.track_id}`
      : invoice.booking_qr_payload
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      {/* Print Specific CSS */}
      <style jsx global>{`
        @media print {
          /* Hide everything except the invoice sheet */
          body * {
            visibility: hidden !important;
          }
          #haulit-printable-invoice,
          #haulit-printable-invoice * {
            visibility: visible !important;
          }
          #haulit-printable-invoice {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 16px !important;
            background: #ffffff !important;
            color: #0b1c30 !important;
            box-shadow: none !important;
            border: 1px solid #999999 !important;
            border-radius: 0 !important;
            font-size: 11pt !important;
          }
          .no-print {
            display: none !important;
          }
          /* Ensure crisp table lines on paper */
          table, th, td {
            border-color: #333333 !important;
          }
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 overflow-y-auto no-print"
        style={{ background: 'rgba(11,28,48,0.6)', backdropFilter: 'blur(8px)' }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <div className="relative w-full max-w-4xl bg-[var(--color-surface-bg)] rounded-3xl neo-shadow border border-[var(--color-surface-container-highest)] my-auto overflow-hidden animate-[fadeIn_.3s_ease]">
          
          {/* Top Modal Controls (Screen Only) */}
          <div className="no-print flex items-center justify-between px-6 py-4 border-b border-[var(--color-surface-container-highest)] bg-[var(--color-surface)]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[var(--color-primary)] text-2xl">
                receipt_long
              </span>
              <span className="font-extrabold text-[var(--color-on-surface)] text-sm uppercase tracking-wider">
                Official B2B Invoice · Truck Company
              </span>
            </div>

            <div className="flex items-center gap-2">
              {invoice && (
                <>
                  <button
                    onClick={handleCopyTrackUrl}
                    title="Copy tracking link"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[var(--color-secondary)] neo-shadow hover:neo-shadow-sm active:neo-shadow-inner transition-all bg-[var(--color-surface-bg)]"
                  >
                    <span className="material-symbols-outlined text-sm">
                      {copied ? 'check' : 'link'}
                    </span>
                    <span>{copied ? 'Copied' : 'Share'}</span>
                  </button>

                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-[var(--color-primary)] hover:opacity-90 active:scale-95 transition-all neo-shadow"
                  >
                    <span className="material-symbols-outlined text-sm">print</span>
                    <span>Print / Save PDF</span>
                  </button>
                </>
              )}

              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-secondary)] hover:text-[var(--color-on-surface)] neo-shadow hover:neo-shadow-sm active:neo-shadow-inner bg-[var(--color-surface-bg)] ml-1"
                aria-label="Close invoice"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-4 sm:p-8 max-h-[85vh] overflow-y-auto">
            {loading && (
              <div className="py-24 text-center space-y-4">
                <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm font-bold text-[var(--color-secondary)]">
                  Generating verified B2B invoice for {trackId}...
                </p>
              </div>
            )}

            {error && (
              <div className="py-16 text-center space-y-4">
                <div className="w-16 h-16 rounded-full mx-auto bg-red-100 text-[var(--color-error)] flex items-center justify-center neo-shadow">
                  <span className="material-symbols-outlined text-3xl">error</span>
                </div>
                <div>
                  <h4 className="font-bold text-[var(--color-on-surface)]">Unable to load invoice</h4>
                  <p className="text-xs text-[var(--color-error)] mt-1">{error}</p>
                </div>
                <button
                  onClick={() => {
                    setLoading(true)
                    setError('')
                    api.orders.getInvoice(trackId).then(setInvoice).catch((e) => setError(e.message)).finally(() => setLoading(false))
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--color-primary)] text-white neo-shadow"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Printable Invoice Sheet */}
            {invoice && (
              <div
                id="haulit-printable-invoice"
                className="bg-white text-[#0b1c30] p-6 sm:p-10 rounded-2xl border border-gray-300 shadow-sm space-y-6 text-xs sm:text-sm font-sans"
              >
                {/* ── HEADER ──────────────────────────────────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6 border-b-2 border-gray-800">
                  {/* Left: HaulIt Logistics Issuer Info */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center text-white font-black text-lg">
                        H
                      </div>
                      <h2 className="text-xl sm:text-2xl font-black tracking-wider text-[var(--color-primary)] uppercase">
                        {invoice.issuer.name}
                      </h2>
                    </div>
                    <p className="text-[11px] text-gray-700 font-semibold pt-1">
                      Legal business name: <span className="font-normal">{invoice.issuer.legal_business_name}</span>
                    </p>
                    <p className="text-[11px] text-gray-600">
                      Address: <span className="font-normal">{invoice.issuer.address}</span>
                    </p>
                    <div className="flex flex-wrap gap-x-4 text-[11px] text-gray-600 pt-0.5">
                      <p>GSTIN: <span className="font-mono font-bold text-gray-800">{invoice.issuer.gstin}</span></p>
                      <p>Phone: <span className="font-medium text-gray-800">{invoice.issuer.phone}</span></p>
                      <p>Email: <span className="font-medium text-gray-800">{invoice.issuer.email}</span></p>
                    </div>
                  </div>

                  {/* Right: Invoice Metadata */}
                  <div className="md:text-right flex flex-col justify-between border-t md:border-t-0 pt-3 md:pt-0 border-gray-200">
                    <div>
                      <div className="inline-block px-3 py-1 rounded bg-gray-900 text-white font-black text-sm uppercase tracking-widest mb-2">
                        INVOICE
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-600">
                          Invoice No.:{' '}
                          <span className="font-mono font-bold text-gray-900 text-sm">
                            {invoice.invoice_no}
                          </span>
                        </p>
                        <p className="text-xs text-gray-600">
                          Invoice Date:{' '}
                          <span className="font-semibold text-gray-900">
                            {invoice.invoice_date}
                          </span>
                        </p>
                        <p className="text-xs text-gray-600">
                          Booking / Order ID:{' '}
                          <span className="font-mono font-bold text-[var(--color-primary)]">
                            {invoice.track_id}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── BILL TO & SHIPMENT DETAILS ────────────────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Box 1: BILL TO (Customer = Truck Company) */}
                  <div className="border border-gray-300 rounded-xl p-4 bg-gray-50/50 space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-wider text-[var(--color-primary)] border-b border-gray-200 pb-1">
                      BILL TO
                    </p>
                    <p className="text-sm font-bold text-gray-900">
                      Truck Company: <span className="text-[var(--color-primary)]">{invoice.bill_to.truck_company}</span>
                    </p>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      Billing Address: <span className="text-gray-900 font-medium">{invoice.bill_to.billing_address}</span>
                    </p>
                    {invoice.bill_to.gstin && (
                      <p className="text-xs text-gray-600 font-mono">
                        GSTIN: <span className="font-bold text-gray-800">{invoice.bill_to.gstin}</span>
                      </p>
                    )}
                    {invoice.bill_to.phone && (
                      <p className="text-xs text-gray-600">
                        Phone: <span className="text-gray-800">{invoice.bill_to.phone}</span>
                      </p>
                    )}
                  </div>

                  {/* Box 2: SHIPMENT DETAILS */}
                  <div className="border border-gray-300 rounded-xl p-4 bg-gray-50/50 space-y-1.5">
                    <p className="text-[11px] font-black uppercase tracking-wider text-gray-800 border-b border-gray-200 pb-1">
                      SHIPMENT DETAILS
                    </p>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                      <div>
                        <span className="text-gray-500 block text-[10px] uppercase font-bold">Pickup</span>
                        <span className="font-semibold text-gray-900">{invoice.shipment.pickup}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[10px] uppercase font-bold">Delivery</span>
                        <span className="font-semibold text-gray-900">{invoice.shipment.delivery}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[10px] uppercase font-bold">Pickup Date</span>
                        <span className="font-semibold text-gray-900">{invoice.shipment.pickup_date}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[10px] uppercase font-bold">Expected Delivery</span>
                        <span className="font-semibold text-gray-900">{invoice.shipment.expected_delivery}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[10px] uppercase font-bold">Goods Nature</span>
                        <span className="font-bold text-gray-900 capitalize">{invoice.shipment.goods_nature}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[10px] uppercase font-bold">Weight</span>
                        <span className="font-semibold font-mono text-gray-900">{invoice.shipment.weight}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── CHARGES TABLE ────────────────────────────────────────── */}
                <div className="space-y-2">
                  <p className="text-xs font-black uppercase tracking-wider text-gray-900">
                    CHARGES
                  </p>
                  <div className="border border-gray-300 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-100 border-b border-gray-300 text-gray-700 font-bold">
                          <th className="py-2.5 px-4 w-16">S. No.</th>
                          <th className="py-2.5 px-4">Description</th>
                          <th className="py-2.5 px-4 text-right w-36">Rate (₹)</th>
                          <th className="py-2.5 px-4 text-right w-36">Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {invoice.charges.map((charge) => (
                          <tr key={charge.s_no} className="hover:bg-gray-50/50">
                            <td className="py-2.5 px-4 font-mono text-gray-600">{charge.s_no}</td>
                            <td className="py-2.5 px-4 font-medium text-gray-900">
                              {charge.description}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono text-gray-700">
                              {charge.formatted_rate}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-semibold text-gray-900">
                              {charge.formatted_amount}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-100 border-t-2 border-gray-300 font-bold">
                          <td colSpan={2} className="py-3 px-4 text-gray-700 uppercase tracking-wider text-[11px]">
                            Total Amount (Inclusive of applicable freight & service fees)
                          </td>
                          <td colSpan={2} className="py-3 px-4 text-right font-mono text-base font-black text-[var(--color-primary)]">
                            {invoice.summary.formatted_total}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-gray-600 px-1">
                    <span>Payment Status: <strong className="text-emerald-700 uppercase font-mono">{invoice.summary.payment_status}</strong></span>
                    <span>GST treatment: Freight Reverse Charge / Forward as per B2B declaration</span>
                  </div>
                </div>

                {/* ── VEHICLE & DRIVER DETAILS + TERMS & NOTES ─────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {/* Left: Vehicle & Driver Details */}
                  <div className="border border-gray-300 rounded-xl p-4 bg-gray-50/50 space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-wider text-gray-800 border-b border-gray-200 pb-1">
                      VEHICLE & DRIVER DETAILS
                    </p>
                    <div className="space-y-1 text-xs">
                      <p className="text-gray-700">
                        Truck Type: <span className="font-bold text-gray-900 uppercase">{invoice.vehicle_and_driver.category}</span>
                      </p>
                      <p className="text-gray-700">
                        Vehicle Number:{' '}
                        <span className="font-mono font-black text-gray-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                          {invoice.vehicle_and_driver.vehicle_number}
                        </span>
                      </p>
                      <p className="text-gray-700">
                        Logistics Partner:{' '}
                        <span className="font-bold text-[var(--color-primary)]">
                          {invoice.vehicle_and_driver.logistics_partner}
                        </span>
                      </p>
                      <p className="text-gray-500 text-[11px]">
                        Fleet Model: {invoice.vehicle_and_driver.vehicle_name}
                      </p>
                    </div>
                  </div>

                  {/* Right: Terms & Notes */}
                  <div className="border border-gray-300 rounded-xl p-4 bg-gray-50/50 space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-wider text-gray-800 border-b border-gray-200 pb-1">
                      TERMS & NOTES
                    </p>
                    <ol className="list-none space-y-1 text-[11px] text-gray-600 leading-normal">
                      {invoice.terms_and_notes.map((term, idx) => (
                        <li key={idx} className="flex items-start gap-1">
                          <span>{term}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>

                {/* ── FOOTER & SIGN-OFF ────────────────────────────────────── */}
                <div className="pt-6 border-t-2 border-gray-800 space-y-4">
                  <div className="text-center space-y-1">
                    <p className="text-sm font-extrabold text-[var(--color-primary)]">
                      Thank you for choosing HaulIt!
                    </p>
                    <p className="text-[11px] text-gray-500 italic">
                      Moving businesses. Supporting individuals. Building smarter logistics.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-6 pt-3">
                    {/* Authorized Signatory Line */}
                    <div className="space-y-4">
                      <div className="h-12 flex items-end">
                        <div className="w-48 border-b-2 border-dashed border-gray-700 pb-1">
                          <span className="text-[10px] font-mono text-gray-400 select-none">
                            [HaulIt Digital Sign / Stamp]
                          </span>
                        </div>
                      </div>
                      <p className="text-xs font-bold text-gray-800">
                        Authorized Signatory: __________________________
                      </p>
                    </div>

                    {/* Booking QR Code */}
                    <div className="flex items-center sm:justify-end gap-3">
                      <div className="text-right">
                        <p className="text-xs font-black text-gray-900">Booking QR</p>
                        <p className="text-[10px] text-gray-500 font-mono">Scan to verify live dispatch</p>
                        <p className="text-[10px] text-[var(--color-primary)] font-bold font-mono">
                          {invoice.track_id}
                        </p>
                      </div>
                      {/* Dynamic QR Code Image */}
                      <div className="p-1.5 bg-white border border-gray-400 rounded-lg shadow-sm flex items-center justify-center">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=96x96&margin=0&data=${encodeURIComponent(
                            invoice.booking_qr_payload
                          )}`}
                          alt={`QR for ${invoice.track_id}`}
                          width={80}
                          height={80}
                          className="rounded"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Bottom Action Bar (Screen Only) */}
          {invoice && (
            <div className="no-print flex items-center justify-between px-6 py-4 border-t border-[var(--color-surface-container-highest)] bg-[var(--color-surface)]">
              <span className="text-xs text-[var(--color-secondary)]">
                B2B recipient: <strong className="text-[var(--color-on-surface)]">{invoice.bill_to.truck_company}</strong>
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-[var(--color-secondary)] hover:text-[var(--color-on-surface)] neo-shadow hover:neo-shadow-sm active:neo-shadow-inner bg-[var(--color-surface-bg)]"
                >
                  Close
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold text-white bg-[var(--color-primary)] hover:opacity-90 active:scale-95 transition-all neo-shadow"
                >
                  <span className="material-symbols-outlined text-sm">print</span>
                  <span>Print / Save PDF</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
