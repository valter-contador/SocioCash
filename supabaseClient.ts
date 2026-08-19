
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY não configuradas (.env.local).');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// CPF/CNPJ digitado -> e-mail sintético usado internamente pelo Supabase Auth.
export const loginIdToEmail = (digits: string): string => `${digits}@login.sociocash.internal`;
