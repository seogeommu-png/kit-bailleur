import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import AddApartmentModal from './components/AddApartmentModal'
import AddExerciseModal from './components/AddExerciseModal'
import AddDeliveryModal from './components/AddDeliveryModal'

// ─── Types locaux ────────────────────────────────────────────────────
interface Apartment {
  id: string
  label: string
  ref: string | null
  floor: string | null
  surface_m2: number
}

interface FuelDelivery {
  id: string
  invoice_date: string
  supplier: string
  invoice_ref: string | null
  quantity: number
  unit_price: number | null
  total_ttc: number
}

interface FuelPeriod {
  id: string
  fuel_name: string
  pcs_kwh_per_unit: number
  pcs_source: string
  period_start: string | null
  period_end: string | null
  opening_stock: number
  closing_stock: number
  fuel_deliveries: FuelDelivery[]
}

interface Exercise {
  id: string
  year: number
  status: string
}

// ─── Helpers ─────────────────────────────────────────────────────────
function fmt(n: number, decimals = 2) {
  return n.toLocaleString('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// ─── Composants UI ───────────────────────────────────────────────────
function SectionHeader({
  title,
  action,
}: {
  title: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
        {title}
      </h2>
      {action}
    </div>
  )
}


// ─── Tableau des logements ────────────────────────────────────────────
function ApartmentsTable({ apartments }: { apartments: Apartment[] }) {
  if (apartments.length === 0) {
    return (
      <div className="border border-dashed border-gray-300 rounded-lg px-6 py-8 text-center">
        <p className="text-sm text-gray-400">Aucun logement enregistré.</p>
      </div>
    )
  }

  const totalSurface = apartments.reduce((s, a) => s + Number(a.surface_m2), 0)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left pb-2 pr-4 font-medium text-gray-400 text-xs uppercase tracking-wide">Logement</th>
            <th className="text-left pb-2 pr-4 font-medium text-gray-400 text-xs uppercase tracking-wide">Ref.</th>
            <th className="text-left pb-2 pr-4 font-medium text-gray-400 text-xs uppercase tracking-wide">Étage</th>
            <th className="text-right pb-2 font-medium text-gray-400 text-xs uppercase tracking-wide">Surface (m²)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {apartments.map((a) => (
            <tr key={a.id} className="hover:bg-gray-50">
              <td className="py-2.5 pr-4 font-medium text-gray-900">{a.label}</td>
              <td className="py-2.5 pr-4 text-gray-500">{a.ref ?? '—'}</td>
              <td className="py-2.5 pr-4 text-gray-500">{a.floor ?? '—'}</td>
              <td className="py-2.5 text-right font-mono text-gray-700">
                {fmt(Number(a.surface_m2), 0)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-300">
            <td className="pt-2.5 pr-4 text-xs font-semibold text-gray-500 uppercase" colSpan={3}>
              Total — {apartments.length} logement{apartments.length > 1 ? 's' : ''}
            </td>
            <td className="pt-2.5 text-right font-mono font-semibold text-gray-900">
              {fmt(totalSurface, 0)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─── Statuts exercice ─────────────────────────────────────────────────
const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft:    { label: 'Brouillon', color: 'bg-gray-100 text-gray-600' },
  computed: { label: 'Calculé',   color: 'bg-blue-50 text-blue-700' },
  sent:     { label: 'Envoyé',    color: 'bg-green-50 text-green-700' },
}

// ─── Section combustible ──────────────────────────────────────────────
function FuelSection({
  periods,
  exerciseYear,
  buildingId,
}: {
  periods: FuelPeriod[]
  exerciseYear: number | null
  buildingId: string
}) {
  if (periods.length === 0) {
    return (
      <div className="border border-dashed border-gray-300 rounded-lg px-6 py-8 text-center">
        <p className="text-sm text-gray-500">Aucune période combustible configurée.</p>
        <p className="text-xs text-gray-400 mt-1">
          Créez d'abord un exercice, puis ajoutez une période pour démarrer les calculs.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {exerciseYear && (
        <p className="text-xs text-gray-400">
          Exercice {exerciseYear} · PCS réglementaire granulés bois :{' '}
          <strong className="text-gray-600">5 106 kWh/t</strong>{' '}
          <span className="text-gray-300">(Arrêté 27/08/2012)</span>
        </p>
      )}
      {periods.map((p) => {
        const totalTtc = p.fuel_deliveries.reduce((s, d) => s + Number(d.total_ttc), 0)
        const totalQte = p.fuel_deliveries.reduce((s, d) => s + Number(d.quantity), 0)

        return (
          <div key={p.id} className="border border-gray-200 rounded-xl overflow-hidden">
            {/* En-tête */}
            <div className="bg-gray-50 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg">🪵</span>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{p.fuel_name}</p>
                  <p className="text-xs text-gray-400">
                    {p.period_start
                      ? `${fmtDate(p.period_start)} → ${fmtDate(p.period_end)}`
                      : 'Période non définie'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">
                  PCS {fmt(Number(p.pcs_kwh_per_unit), 0)} kWh/t
                </span>
                <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                  {p.pcs_source}
                </span>
              </div>
            </div>

            {/* Stocks */}
            <div className="px-5 py-3 grid grid-cols-2 gap-4 border-b border-gray-100">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Stock ouverture</p>
                <p className="text-sm font-mono text-gray-700">{fmt(Number(p.opening_stock), 2)} t</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Stock fermeture</p>
                <p className="text-sm font-mono text-gray-700">{fmt(Number(p.closing_stock), 2)} t</p>
              </div>
            </div>

            {/* Livraisons */}
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Livraisons ({p.fuel_deliveries.length})
                </p>
                <AddDeliveryModal
                  fuelPeriodId={p.id}
                  buildingId={buildingId}
                  fuelName={p.fuel_name}
                />
              </div>

              {p.fuel_deliveries.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left pb-2 pr-3 font-medium text-gray-400 text-xs">Date</th>
                        <th className="text-left pb-2 pr-3 font-medium text-gray-400 text-xs">Fournisseur</th>
                        <th className="text-left pb-2 pr-3 font-medium text-gray-400 text-xs">N° facture</th>
                        <th className="text-right pb-2 pr-3 font-medium text-gray-400 text-xs">Qté (t)</th>
                        <th className="text-right pb-2 pr-3 font-medium text-gray-400 text-xs">€/t</th>
                        <th className="text-right pb-2 font-medium text-gray-400 text-xs">Total TTC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {p.fuel_deliveries.map((d) => (
                        <tr key={d.id} className="hover:bg-gray-50">
                          <td className="py-2 pr-3 text-gray-600">{fmtDate(d.invoice_date)}</td>
                          <td className="py-2 pr-3 text-gray-700">{d.supplier}</td>
                          <td className="py-2 pr-3 text-gray-400">{d.invoice_ref ?? '—'}</td>
                          <td className="py-2 pr-3 text-right font-mono">{fmt(Number(d.quantity), 2)}</td>
                          <td className="py-2 pr-3 text-right font-mono text-gray-500">
                            {d.unit_price ? fmt(Number(d.unit_price), 2) : '—'}
                          </td>
                          <td className="py-2 text-right font-mono font-medium text-gray-900">
                            {fmt(Number(d.total_ttc), 2)} €
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-200">
                        <td colSpan={3} className="pt-2 text-xs text-gray-400 font-semibold uppercase">Total</td>
                        <td className="pt-2 text-right font-mono font-semibold text-gray-700 pr-3">
                          {fmt(totalQte, 2)} t
                        </td>
                        <td />
                        <td className="pt-2 text-right font-mono font-bold text-gray-900">
                          {fmt(totalTtc, 2)} €
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">Aucune livraison enregistrée.</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────
export default async function BuildingPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()

  // 1. Immeuble
  const { data: building, error: buildingErr } = await supabase
    .from('buildings')
    .select('id, name, address, owner_name, total_surface_m2, ecs_kwh_per_m3')
    .eq('id', params.id)
    .single()

  if (buildingErr || !building) notFound()

  // 2. Logements + exercices en parallèle
  const [{ data: apartments }, { data: exercises }] = await Promise.all([
    supabase
      .from('apartments')
      .select('id, label, ref, floor, surface_m2')
      .eq('building_id', params.id)
      .order('label'),

    supabase
      .from('exercises')
      .select('id, year, status')
      .eq('building_id', params.id)
      .order('year', { ascending: false }),
  ])

  const exerciseList = (exercises ?? []) as Exercise[]
  const latestExercise = exerciseList[0] ?? null

  // 3. Périodes combustible de l'exercice le plus récent
  let fuelPeriods: FuelPeriod[] = []
  if (latestExercise) {
    const { data: fp } = await supabase
      .from('fuel_periods')
      .select(
        `id, fuel_name, pcs_kwh_per_unit, pcs_source,
         period_start, period_end, opening_stock, closing_stock,
         fuel_deliveries (
           id, invoice_date, supplier, invoice_ref, quantity, unit_price, total_ttc
         )`
      )
      .eq('exercise_id', latestExercise.id)
      .order('period_index')

    fuelPeriods = (fp ?? []) as FuelPeriod[]
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <Link
          href="/buildings"
          className="text-gray-400 hover:text-gray-600 text-sm transition-colors"
        >
          ← Mes immeubles
        </Link>
        <span className="text-gray-200">/</span>
        <span className="text-sm font-medium text-gray-800">{building.name}</span>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* ── Fiche immeuble ── */}
        <section className="bg-white rounded-xl border border-gray-200 px-6 py-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{building.name}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{building.address}</p>
            </div>
            <button className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors">
              Modifier
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Propriétaire</p>
              <p className="text-sm font-medium text-gray-800">{building.owner_name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Surface totale</p>
              <p className="text-sm font-medium text-gray-800">
                {fmt(Number(building.total_surface_m2), 0)} m²
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">ECS standard</p>
              <p className="text-sm font-medium text-gray-800">
                {fmt(Number(building.ecs_kwh_per_m3), 0)} kWh/m³
                <span className="text-xs text-gray-400 ml-1 font-normal">DTU 60.11</span>
              </p>
            </div>
          </div>
        </section>

        {/* ── Exercices ── */}
        <section className="bg-white rounded-xl border border-gray-200 px-6 py-5">
          <SectionHeader
            title="Exercices"
            action={
              <AddExerciseModal
                buildingId={building.id}
                totalSurfaceSnapshot={Number(building.total_surface_m2)}
                existingYears={exerciseList.map(e => e.year)}
              />
            }
          />
          {exerciseList.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {exerciseList.map((e) => {
                const s = STATUS_LABEL[e.status] ?? STATUS_LABEL.draft
                return (
                  <Link
                    key={e.id}
                    href={`/buildings/${building.id}/exercises/${e.id}`}
                    className="flex items-center gap-2 border border-gray-200 hover:border-blue-300 hover:bg-blue-50 rounded-lg px-4 py-2.5 transition-all"
                  >
                    <span className="font-semibold text-gray-800">{e.year}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${s.color}`}>
                      {s.label}
                    </span>
                  </Link>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">
              Aucun exercice. Créez-en un pour commencer les calculs.
            </p>
          )}
        </section>

        {/* ── Logements ── */}
        <section className="bg-white rounded-xl border border-gray-200 px-6 py-5">
          <SectionHeader
            title="Logements"
            action={<AddApartmentModal buildingId={building.id} />}
          />
          <ApartmentsTable apartments={(apartments ?? []) as Apartment[]} />
        </section>

        {/* ── Combustible ── */}
        <section className="bg-white rounded-xl border border-gray-200 px-6 py-5">
          <SectionHeader title="Combustible" />
          <FuelSection
            periods={fuelPeriods}
            exerciseYear={latestExercise?.year ?? null}
            buildingId={building.id}
          />
        </section>

      </main>
    </div>
  )
}
