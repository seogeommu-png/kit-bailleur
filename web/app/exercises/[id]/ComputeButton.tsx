'use client'

/**
 * Bouton de déclenchement du calcul — Client Component
 * Appelle POST /api/exercises/:id/compute puis recharge la page.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ComputeButton({ exerciseId }: { exerciseId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCompute(force = false) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/exercises/${exerciseId}/compute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRecompute: force }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erreur serveur')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          onClick={() => handleCompute(false)}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium
                     hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Calcul en cours…' : 'Calculer les charges'}
        </button>
        <button
          onClick={() => handleCompute(true)}
          disabled={loading}
          title="Recalculer en ignorant le cache"
          className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm
                     hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ↺
        </button>
      </div>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
