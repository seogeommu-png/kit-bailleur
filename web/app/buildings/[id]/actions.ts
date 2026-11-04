'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ─── Logement ────────────────────────────────────────────────────────
export async function addApartment(buildingId: string, formData: FormData) {
  const supabase = createClient()

  const label = (formData.get('label') as string).trim()
  const ref = (formData.get('ref') as string).trim() || null
  const floor = (formData.get('floor') as string).trim() || null
  const surface_m2 = parseFloat(formData.get('surface_m2') as string)

  if (!label || isNaN(surface_m2) || surface_m2 <= 0) {
    return { error: 'Nom et surface sont obligatoires.' }
  }

  const { error } = await supabase.from('apartments').insert({
    building_id: buildingId,
    label,
    ref,
    floor,
    surface_m2,
  })

  if (error) return { error: error.message }

  revalidatePath(`/buildings/${buildingId}`)
  return { success: true }
}

// ─── Exercice ────────────────────────────────────────────────────────
export async function addExercise(
  buildingId: string,
  totalSurfaceSnapshot: number,
  formData: FormData
) {
  const supabase = createClient()

  const year = parseInt(formData.get('year') as string)

  if (isNaN(year) || year < 2000 || year > 2100) {
    return { error: 'Année invalide.' }
  }

  // Vérifier doublons
  const { data: existing } = await supabase
    .from('exercises')
    .select('id')
    .eq('building_id', buildingId)
    .eq('year', year)
    .maybeSingle()

  if (existing) {
    return { error: `Un exercice ${year} existe déjà pour cet immeuble.` }
  }

  const { error } = await supabase.from('exercises').insert({
    building_id: buildingId,
    year,
    status: 'draft',
    total_surface_m2_snapshot: totalSurfaceSnapshot,
  })

  if (error) return { error: error.message }

  revalidatePath(`/buildings/${buildingId}`)
  return { success: true }
}

// ─── Livraison combustible ────────────────────────────────────────────
export async function addFuelDelivery(
  fuelPeriodId: string,
  buildingId: string,
  formData: FormData
) {
  const supabase = createClient()

  const invoice_date = formData.get('invoice_date') as string
  const supplier = (formData.get('supplier') as string).trim()
  const invoice_ref = (formData.get('invoice_ref') as string).trim() || null
  const quantity = parseFloat(formData.get('quantity') as string)
  const total_ttc = parseFloat(formData.get('total_ttc') as string)

  if (!invoice_date || !supplier || isNaN(quantity) || quantity <= 0 || isNaN(total_ttc) || total_ttc <= 0) {
    return { error: 'Tous les champs obligatoires doivent être renseignés.' }
  }

  // unit_price = total_ttc / quantity (arrondi à 4 décimales)
  const unit_price = Math.round((total_ttc / quantity) * 10000) / 10000

  const { error } = await supabase.from('fuel_deliveries').insert({
    fuel_period_id: fuelPeriodId,
    invoice_date,
    supplier,
    invoice_ref,
    quantity,
    total_ttc,
    unit_price,
  })

  if (error) return { error: error.message }

  revalidatePath(`/buildings/${buildingId}`)
  return { success: true }
}
