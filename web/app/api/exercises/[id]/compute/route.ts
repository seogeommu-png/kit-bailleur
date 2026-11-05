/**
 * POST /api/exercises/:id/compute
 * ─────────────────────────────────
 * Lance le calcul des charges pour un exercice.
 * Utilise le service role pour lire/écrire librement.
 *
 * Body JSON optionnel : { forceRecompute?: boolean }
 * Retourne : ExerciseResult (JSON)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { computeOrLoadExercise } from '@/lib/compute'




export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServiceClient()




  // Vérifier l'authentification (via cookie de session)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }




  let forceRecompute = false
  try {
    const body = await request.json()
    forceRecompute = body?.forceRecompute === true
  } catch {
    // Body vide — OK
  }




  try {
    const result = await computeOrLoadExercise(supabase, params.id, {
      forceRecompute,
    })
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur de calcul'
    const status = message.includes('introuvable') ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}



