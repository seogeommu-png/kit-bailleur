/**
 * Page de décompte d'un exercice
 * ─────────────────────────────────
 * Server Component : charge les données depuis Supabase,
 * lance le calcul si nécessaire, affiche le récapitulatif.
 */
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { computeOrLoadExercise } from 'decompte-charges-engine/dist/db/compute.js'
import { notFound } from 'next/navigation'
import type { ExerciseResult, TenancyResult } from 'decompte-charges-engine/dist/types.js'
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
            <h2 className="font-semibold text-gray-800">Synthèse immeuble</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <Stat label="Combustible ECS" value={fmt(result.ecs.ecsFuelCostTotal)} />
              <Stat label="Chauffage net" value={fmt(result.heating.netHeatingFuelCost)} />
              <Stat label="Part fixe totale" value={fmt(result.heating.totalFixedPart)} />
              <Stat label="Total charges" value={fmt(result.sumAllTenancyCharges)} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <Stat label="Prix kWh variable" value={`${result.heating.pricePerKwhVariable.toFixed(5)} €/kWh`} />
              <Stat label="Coût fixe/m²" value={`${result.heating.fixedCostPerM2.toFixed(4)} €/m²`} />
              <Stat label="Prix ECS/m³" value={`${result.ecs.finalEcsPricePerM3.toFixed(4)} €/m³`} />
            </div>
          </section>

          {/* Tableau par logement */}
          <section>
            <h2 className="font-semibold text-gray-800 mb-3">Récapitulatif par logement</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-700">
                    <th className="text-left p-2 border">Logement</th>
                    <th className="text-right p-2 border">Surface</th>
                    <th className="text-right p-2 border">kWh</th>
                    <th className="text-right p-2 border">ECS m³</th>
                    <th className="text-right p-2 border">Chauf. var.</th>
                    <th className="text-right p-2 border">Chauf. fixe</th>
                    <th className="text-right p-2 border">ECS</th>
                    <th className="text-right p-2 border">Eau froide</th>
                    <th className="text-right p-2 border font-bold">Total</th>
                    <th className="text-right p-2 border">Provisions</th>
                    <th className="text-right p-2 border font-bold">Solde</th>
                  </tr>
                </thead>
                <tbody>
                  {result.tenancies.map((t: TenancyResult) => (
                    <tr
                      key={t.tenancyId ?? t.apartmentId}
                      className={t.isVacant ? 'text-gray-400 italic' : ''}
                    >
                      <td className="p-2 border">
                        {t.isVacant ? '(vacant)' : t.tenancyId}
                      </td>
                      <td className="text-right p-2 border">{t.surfaceM2} m²</td>
                      <td className="text-right p-2 border">{t.heatKwh}</td>
                      <td className="text-right p-2 border">{t.ecsM3}</td>
                      <td className="text-right p-2 border">{fmt(t.heatingVariable)}</td>
                      <td className="text-right p-2 border">{fmt(t.heatingFixed)}</td>
                      <td className="text-right p-2 border">{fmt(t.ecs)}</td>
                      <td className="text-right p-2 border">{fmt(t.coldWater)}</td>
                      <td className="text-right p-2 border font-semibold">{fmt(t.totalCharges)}</td>
                      <td className="text-right p-2 border">{fmt(t.provisions)}</td>
                      <td className={`text-right p-2 border font-semibold ${
                        t.balance > 0 ? 'text-red-600' : t.balance < 0 ? 'text-green-600' : ''
                      }`}>
                        {fmt(t.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Avertissements non bloquants */}
          {result.controls.filter(c => !c.blocking).length > 0 && (
            <section className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-4">
              <p className="font-medium mb-1">Avertissements</p>
              <ul className="space-y-1">
                {result.controls
                  .filter(c => !c.blocking)
                  .map((c, i) => <li key={i}>ℹ {c.message}</li>)}
              </ul>
            </section>
          )}

          {/* Pied légal */}
          <p className="text-xs text-gray-400 border-t pt-4">
            Décompte établi conformément à l'Art. R174-10 et R174-11 CCH, à l'Arrêté du 27/08/2012
            (PCS granulés 5 106 kWh/t) et au Décret n°87-713 du 26 août 1987.
            Les justificatifs sont tenus à disposition 6 mois (Art. 23 Loi 89-462).
          </p>
        </>
      )}
    </main>
  )
}

// ─── Composants utilitaires ───────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-500 text-xs">{label}</p>
      <p className="font-medium text-gray-900">{value}</p>
    </div>
  )
}

function fmt(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}
