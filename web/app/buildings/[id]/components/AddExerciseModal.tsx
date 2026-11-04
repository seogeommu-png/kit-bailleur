'use client'

import { useState, useTransition } from 'react'
import { addExercise } from '../actions'

interface Props {
  buildingId: string
  totalSurfaceSnapshot: number
  existingYears: number[]
}

export default function AddExerciseModal({ buildingId, totalSurfaceSnapshot, existingYears }: Props) {
  const currentYear = new Date().getFullYear()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await addExercise(buildingId, totalSurfaceSnapshot, formData)
      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
      }
    })
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setError(null) }}
        className="text-sm font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
      >
        + Exercice
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Nouvel exercice</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Année de l'exercice <span className="text-red-500">*</span>
                </label>
                <input
                  name="year"
                  type="number"
                  min="2000"
                  max="2100"
                  defaultValue={currentYear}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {existingYears.length > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    Exercices existants : {existingYears.join(', ')}
                  </p>
                )}
              </div>

              {/* Info surface snapshot */}
              <div className="bg-blue-50 rounded-lg px-3 py-2.5">
                <p className="text-xs text-blue-700">
                  <span className="font-medium">Surface totale instantanée :</span>{' '}
                  {totalSurfaceSnapshot.toLocaleString('fr-FR')} m²
                </p>
                <p className="text-xs text-blue-500 mt-0.5">
                  Cette valeur est figée au moment de la création de l'exercice.
                </p>
              </div>

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
                  {isPending ? 'Création…' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
