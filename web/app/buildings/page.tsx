import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function BuildingsPage() {
  const supabase = createClient()
  const { data: buildings, error } = await supabase
    .from('buildings')
    .select('id, name, address, owner_name, total_surface_m2')
    .order('created_at')

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-red-600">Erreur de chargement : {error.message}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-900">Décompte de charges</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gestion locative — chauffage collectif</p>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium text-gray-800">Mes immeubles</h2>
          <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            + Ajouter un immeuble
          </button>
        </div>

        {buildings && buildings.length > 0 ? (
          <ul className="space-y-3">
            {buildings.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/buildings/${b.id}`}
                  className="block bg-white rounded-xl border border-gray-200 px-5 py-4 hover:border-blue-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{b.name}</p>
                      <p className="text-sm text-gray-500 mt-0.5">{b.address}</p>
                      <p className="text-xs text-gray-400 mt-1">Propriétaire : {b.owner_name}</p>
                    </div>
                    <span className="text-sm text-gray-400 font-mono whitespace-nowrap ml-4 mt-0.5">
                      {b.total_surface_m2} m²
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 px-8 py-12 text-center">
            <p className="text-gray-500 text-sm">Aucun immeuble enregistré.</p>
            <p className="text-gray-400 text-xs mt-1">Commencez par ajouter votre premier immeuble.</p>
          </div>
        )}
      </main>
    </div>
  )
}
