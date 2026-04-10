/**
 * Supabase Client
 * anon key はフロントエンド公開用キー（Supabase公式推奨）
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hvvsdqigktcbtakzcmnm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2dnNkcWlna3RjYnRha3pjbW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3ODY0ODAsImV4cCI6MjA5MTM2MjQ4MH0.IIF_mTz3LySmYFcs455LIwfWrkuHINtdhPfDjGkMUYo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
