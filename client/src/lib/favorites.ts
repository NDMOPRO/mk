/**
 * Favorites Service — Supabase-backed favorites with localStorage fallback
 * Persists user favorites in Supabase `favorites` table when logged in,
 * falls back to localStorage for anonymous users.
 */

import { supabase } from "./supabase";

const LOCAL_STORAGE_KEY = "mk_favorites";

// ─── Supabase Operations ───

export async function fetchFavorites(userId: string): Promise<number[]> {
  try {
    const { data, error } = await supabase
      .from("favorites")
      .select("property_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Failed to fetch favorites from Supabase:", error.message);
      return getLocalFavorites();
    }

    return data?.map((row: { property_id: number }) => row.property_id) || [];
  } catch {
    return getLocalFavorites();
  }
}

export async function addFavorite(userId: string, propertyId: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("favorites")
      .upsert(
        { user_id: userId, property_id: propertyId },
        { onConflict: "user_id,property_id" }
      );

    if (error) {
      console.warn("Failed to add favorite:", error.message);
      addLocalFavorite(propertyId);
      return false;
    }
    return true;
  } catch {
    addLocalFavorite(propertyId);
    return false;
  }
}

export async function removeFavorite(userId: string, propertyId: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", userId)
      .eq("property_id", propertyId);

    if (error) {
      console.warn("Failed to remove favorite:", error.message);
      removeLocalFavorite(propertyId);
      return false;
    }
    return true;
  } catch {
    removeLocalFavorite(propertyId);
    return false;
  }
}

// ─── localStorage Fallback ───

export function getLocalFavorites(): number[] {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function addLocalFavorite(propertyId: number): void {
  const favs = getLocalFavorites();
  if (!favs.includes(propertyId)) {
    favs.unshift(propertyId);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(favs));
  }
}

export function removeLocalFavorite(propertyId: number): void {
  const favs = getLocalFavorites().filter((id) => id !== propertyId);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(favs));
}

// ─── Sync local favorites to Supabase when user logs in ───

export async function syncLocalToSupabase(userId: string): Promise<void> {
  const localFavs = getLocalFavorites();
  if (localFavs.length === 0) return;

  try {
    const rows = localFavs.map((propertyId) => ({
      user_id: userId,
      property_id: propertyId,
    }));

    await supabase
      .from("favorites")
      .upsert(rows, { onConflict: "user_id,property_id" });

    // Clear local storage after successful sync
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch (err) {
    console.warn("Failed to sync local favorites to Supabase:", err);
  }
}
