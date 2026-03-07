/**
 * Shared types — no external dependencies
 */

// User type for Supabase Auth
export interface AppUser {
  id: string;
  email?: string;
  phone?: string;
  fullName?: string;
}
