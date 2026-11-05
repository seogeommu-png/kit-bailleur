/**
 * Moteur de calcul des décomptes de charges
 * ──────────────────────────────────────────
 * Remplace le package externe "decompte-charges-engine".
 *
 * Références légales :
 *  - Art. R174-10 CCH : ventilation 70% / 30% combustible chauffage
 *  - Art. R174-11 CCH : charges fixes récupérables
 *  - Arrêté 27/08/2012 : PCS granulés bois = 5 106 kWh/tonne
 *  - DTU 60.11 / RE2020 : 55 kWh nécessaires par m³ d'ECS
 *  - Décret n°87-713 du 26 août 1987 : liste charges récupérables
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Constantes réglementaires ─────────────────────────────────────────────

/** PCS granulés bois réglementaire (Arrêté 27/08/2012) */
const PCS_KWH_PER_TONNE = 5106

/** Énergie nécessaire pour 1 m³ d'ECS — delta T = 47°C (DTU 60.11 / RE2020) */
const KWH_PER_M3_ECS = 55

// ─── Types publics ─────────────────────────────────────────────────────────

export interface ControlResult {
  message: string
  blocking: boolean
}

export interface TenancyResult {
  tenancyId: string | null
  apartmentId: string
  surfaceM2: number
  heatKwh: number
  ecsM3: number
  coldWaterM3: number
  heatingVariable: number
  heatingFixed: number
  ecs: number
  coldWater: number
  totalCharges: number
  provisions: number
  balance: number
  isVacant: boolean
}

export interface EcsResult {
  totalVolumeM3: number
  energyNeededKwh: number
  granulesForEcsTonnes: number
  ecsFuelCostTotal: number
  ecsFuelCostPerM3: number
  finalEcsPricePerM3: number
}

export interface HeatingResult {
  netHeatingFuelCost: number
  variablePart70: number
  pricePerKwhVariable: number
  fixedPart30: number
  totalFixedPart: number
  fixedCostPerM2: number
}

export interface ExerciseResult {
  exerciseId: string
  calculatedAt: string
  ecs: EcsResult
  heating: HeatingResult
  tenancies: TenancyResult[]
  sumAllTenancyCharges: number
  hasBlockingIssues: boolean
  controls: ControlResult[]
}

// ─── Données Supabase ───────────────────────────────────────────────────────

interface ExerciseRow {
  id: string
  year: number
  building_id: string
  granules_cost_ttc: number
  granules_tonnes: number
  electricity_cost_ttc: number
  maintenance_cost_ttc: number
  cold_water_cost_ttc: number
  cold_water_m3_total: number
  cold_water_price_per_m3: number
  ecs_m3_total: number
  result_cache: ExerciseResult | null
}

interface ApartmentRow {
  id: string
  name: string
  surface_m2: number
}

interface MeterReadingRow {
  apartment_id: string
  heat_kwh: number
  ecs_m3: number
  cold_water_m3: number
}

interface TenancyRow {
  id: string
  apartment_id: string
  provisions_paid: number
  is_vacant: boolean
}

// ─── Calcul principal ───────────────────────────────────────────────────────

export async function computeOrLoadExercise(
  supabase: SupabaseClient,
  exerciseId: string,
  options?: { forceRecompute?: boolean },
): Promise<ExerciseResult> {
  // 1. Charger l'exercice
  const { data: exercise, error: exErr } = await supabase
    .from('exercises')
    .select('*')
    .eq('id', exerciseId)
    .single<ExerciseRow>()

  if (exErr || !exercise) {
    throw new Error(`Exercice ${exerciseId} introuvable`)
  }

  // 2. Retourner le cache si disponible et non forcé
  if (exercise.result_cache && !options?.forceRecompute) {
    return exercise.result_cache
  }

  // 3. Charger les logements et relevés
  const { data: apartments } = await supabase
    .from('apartments')
    .select('id, name, surface_m2')
    .eq('building_id', exercise.building_id)
    .returns<ApartmentRow[]>()

  const { data: readings } = await supabase
    .from('meter_readings')
    .select('apartment_id, heat_kwh, ecs_m3, cold_water_m3')
    .eq('exercise_id', exerciseId)
    .returns<MeterReadingRow[]>()

  const { data: tenancies } = await supabase
    .from('tenancies')
    .select('id, apartment_id, provisions_paid, is_vacant')
    .eq('exercise_id', exerciseId)
    .returns<TenancyRow[]>()

  const apts = apartments ?? []
  const rdgs = readings ?? []
  const tncs = tenancies ?? []

  // 4. Calcul ECS (Arrêté 27/08/2012 + DTU 60.11)
  const ecsVolumeTotal = exercise.ecs_m3_total
  const energyNeededKwh = ecsVolumeTotal * KWH_PER_M3_ECS
  const granulesForEcsTonnes = energyNeededKwh / PCS_KWH_PER_TONNE
  const ecsFuelCostTotal = granulesForEcsTonnes * (exercise.granules_cost_ttc / exercise.granules_tonnes)
  const ecsFuelCostPerM3 = ecsVolumeTotal > 0 ? ecsFuelCostTotal / ecsVolumeTotal : 0
  const finalEcsPricePerM3 = ecsFuelCostPerM3 + exercise.cold_water_price_per_m3

  // 5. Calcul chauffage (Art. R174-10 CCH)
  const netHeatingFuelCost = exercise.granules_cost_ttc - ecsFuelCostTotal
  const variablePart70 = netHeatingFuelCost * 0.70
  const fixedPart30 = netHeatingFuelCost * 0.30
  const totalFixedPart = fixedPart30 + exercise.electricity_cost_ttc + exercise.maintenance_cost_ttc

  const totalSurfaceM2 = apts.reduce((s, a) => s + a.surface_m2, 0)
  const fixedCostPerM2 = totalSurfaceM2 > 0 ? totalFixedPart / totalSurfaceM2 : 0

  const totalKwhImmeuble = rdgs.reduce((s, r) => s + (r.heat_kwh ?? 0), 0)
  const pricePerKwhVariable = totalKwhImmeuble > 0 ? variablePart70 / totalKwhImmeuble : 0

  // 6. Calcul par logement
  const tenancyResults: TenancyResult[] = apts.map(apt => {
    const reading = rdgs.find(r => r.apartment_id === apt.id)
    const tenancy = tncs.find(t => t.apartment_id === apt.id)

    const heatKwh = reading?.heat_kwh ?? 0
    const ecsM3 = reading?.ecs_m3 ?? 0
    const coldWaterM3 = reading?.cold_water_m3 ?? 0

    const heatingVariable = heatKwh * pricePerKwhVariable
    const heatingFixed = apt.surface_m2 * fixedCostPerM2
    const ecsCharge = ecsM3 * finalEcsPricePerM3
    const coldWaterCharge = coldWaterM3 * exercise.cold_water_price_per_m3

    const totalCharges = heatingVariable + heatingFixed + ecsCharge + coldWaterCharge
    const provisions = tenancy?.provisions_paid ?? 0
    const balance = totalCharges - provisions

    return {
      tenancyId: tenancy?.id ?? null,
      apartmentId: apt.id,
      surfaceM2: apt.surface_m2,
      heatKwh,
      ecsM3,
      coldWaterM3,
      heatingVariable,
      heatingFixed,
      ecs: ecsCharge,
      coldWater: coldWaterCharge,
      totalCharges,
      provisions,
      balance,
      isVacant: tenancy?.is_vacant ?? true,
    }
  })

  // 7. Vérifications d'incontestabilité
  const controls: ControlResult[] = []

  const sumEcsIndividuels = rdgs.reduce((s, r) => s + (r.ecs_m3 ?? 0), 0)

  if (Math.abs(sumEcsIndividuels - ecsVolumeTotal) > 0.01) {
    controls.push({
      message: `Écart ECS : somme compteurs (${sumEcsIndividuels.toFixed(2)} m³) ≠ total facturé (${ecsVolumeTotal.toFixed(2)} m³)`,
      blocking: false,
    })
  }

  const sumAllCharges = tenancyResults.reduce((s, t) => s + t.totalCharges, 0)
  const totalFournisseurs = exercise.granules_cost_ttc + exercise.electricity_cost_ttc +
    exercise.maintenance_cost_ttc + exercise.cold_water_cost_ttc
  if (Math.abs(sumAllCharges - totalFournisseurs) > 1) {
    controls.push({
      message: `Écart global : total logements (${sumAllCharges.toFixed(2)} €) ≠ total fournisseurs (${totalFournisseurs.toFixed(2)} €)`,
      blocking: false,
    })
  }

  const hasBlockingIssues = controls.some(c => c.blocking)

  const result: ExerciseResult = {
    exerciseId,
    calculatedAt: new Date().toISOString(),
    ecs: {
      totalVolumeM3: ecsVolumeTotal,
      energyNeededKwh,
      granulesForEcsTonnes,
      ecsFuelCostTotal,
      ecsFuelCostPerM3,
      finalEcsPricePerM3,
    },
    heating: {
      netHeatingFuelCost,
      variablePart70,
      pricePerKwhVariable,
      fixedPart30,
      totalFixedPart,
      fixedCostPerM2,
    },
    tenancies: tenancyResults,
    sumAllTenancyCharges: sumAllCharges,
    hasBlockingIssues,
    controls,
  }

  // 8. Mettre en cache le résultat
  await supabase
    .from('exercises')
    .update({ result_cache: result })
    .eq('id', exerciseId)

  return result
    }
