import { createClient } from '@supabase/supabase-js'

// JeanScore Supabase project (publishable/anon key — safe for the browser).
const SUPABASE_URL = 'https://ozsissvmrniwmgxsgzdh.supabase.co'
const SUPABASE_KEY = 'sb_publishable_gke_OLA7RhoTCuunJrJzoA_a9vX4GUp'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
