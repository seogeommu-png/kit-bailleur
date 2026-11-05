/**
 * Page de décompte d'un exercice
 * ─────────────────────────────────
 * Server Component : charge les données depuis Supabase,
 * lance le calcul si nécessaire, affiche le récapitulatif.
 */
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { computeOrLoadExercise } from '@/lib/compute'
import { notFound } from 'next/navigation'
import type { ExerciseResult, TenancyResult } from '@/lib/compute'
import { ComputeButton } from './ComputeButton'


interface PageProps {
  params: { id: string }
}


export default async function ExercisePage({ params }: PageProps) {
  const supabase = createServiceClient()


  // Charger les métadonnées de l'exercice
  const { data: exercise } = await supabase
    .from('exercises')
    .select('*, buildings(*)')
    .eq('id', params.id)
    .single()


  if (!exercise) notFound()


  // Tenter de charger le résultat mis en cache
  let result: ExerciseResult | null = null
  try {
    result = await computeOrLoadExercise(supabase, params.id)
  } catch {
    // Pas encore calculable — l'utilisateur devra cliquer
  }


  const building = exercise.buildings as { name: string; address: string; owner_name: string }


  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* En-tête */}
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold text-gray-900">
          Décompte de charges — {exercise.year}
        </h1>
        <p className="text-gray-600 mt-1">{building.name} · {building.address}</p>
        <p className="text-sm text-gray-400">Propriétaire : {building.owner_name}</p>
      </div>


      {/* Bouton de calcul */}
      <div className="flex gap-3 items-center">
        <ComputeButton exerciseId={params.id} />
        {result && (
          <span className="text-sm text-green-600">
            ✓ Calculé le {new Date(result.calculatedAt).toLocaleDateString('fr-FR')}
          </span>
        )}
      </div>


      {/* Résultat */}
      {result && (
        <>
          {/* Alertes */}
          {result.hasBlockingIssues && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h2 className="font-semibold text-red-800 mb-2">Incohérences détectées</h2>
              <ul className="text-sm text-red-700 space-y-1">
                {result.controls
                  .filter(c => c.blocking)
                  .map((c, i) => <li key={i}>⚠ {c.message}</li>)}
              </ul>
            </div>
          )}


          {/* Synthèse immeuble */}
          <section className="bg-gray-50 rounded-lg p-6 space-y-3">
