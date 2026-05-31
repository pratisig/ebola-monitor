/**
 * Client Supabase — EBOLA-MONITOR v4.0
 * Utilisé pour lire et écrire les données de l'épidémie en cours
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Client public (lecture seule depuis le frontend)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Client admin (lecture/écriture depuis les API routes serveur)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);
