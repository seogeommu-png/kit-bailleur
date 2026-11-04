'use client'

import { useState, useTransition } from 'react'
import { addFuelDelivery } from '../actions'

interface Props {
  fuelPeriodId: string
  buildingId: string
  fuelName: string
}

export default function AddDeliveryModal({ fuelPeriodId, buildingId, fuelName }: Props) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [totalTtc, setTotalTtc] = useState('')
  const [quantity, setQuantity] = useState('')

  // Prix unitaire calculé à la volée pour l'aperçu
  const unitPricePreview = (() => {
    const q = parseFloat(quantity)
    const t = parseFloat(totalTtc)
    if (q > 0 && t > 0) return (t / q).toFixed(4)
    return null
  })()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await addFuelDelivery(fuelPeriodId, buildingId, formData)
      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
        setTotalTtc('')
        setQuantity('')
        ;(e.target as HTMLFormElement).reset()
      }
    })
  }

  // Date du jour au format YYYY-MM-DD pour le defaultValue
  const today = new Date().toISOString().slice(0, 10)

  return (
    <>
      <button
        onClick={() => { setOpen(true); setError(null) }}
        className="text-xs font-medium text-blue-600 hover:text-blue-700 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors border border-blue-200"
      >
        + Livraison
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-gray-900">Nouvelle livraison</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-5">Combustible : {fuelName}</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {/* Date facture */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date facture <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="invoice_date"
                    type="date"
                    defaultValue={today}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* N° facture */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    N° facture
                  </label>
                  <input
                    name="invoice_ref"
                    placeholder="optionnel"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Fournisseur */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fournisseur <span className="text-red-500">*</span>
                </label>
                <input
                  name="supplier"
                  required
                  placeholder="ex. Poêle & Granulés SARL"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Quantité */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantité (tonnes) <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="quantity"
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    placeholder="ex. 6.000"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Total TTC */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total TTC (€) <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="total_ttc"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="ex. 2 340.00"
                    value={totalTtc}
                    onChange={e => setTotalTtc(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Aperçu prix unitaire */}
              {unitPricePreview && (
                <div className="bg-gray-50 rounded-lg px-3 py-2 flex items-center justify-between">
                  <span className="text-xs text-gray-500">Prix unitaire calculé</span>
                  <span className="text-sm font-mono font-medium text-gray-800">
                    {parseFloat(unitPricePreview).toLocaleString('fr-FR', { minimumFractionDigits: 4 })} €/tonne
                  </span>
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors"
                >
                  {isPending ? 'Enregistrement…' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
