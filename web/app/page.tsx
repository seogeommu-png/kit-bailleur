import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = createClient()
  const { data: buildings } = await supabase
    .from('buildings')
    .select('id')
    .order('created_at')
    .limit(1)

  if (buildings && buildings.length > 0) {
    redirect(`/buildings/${buildings[0].id}`)
  }

  redirect('/buildings')
}
