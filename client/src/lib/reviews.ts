/**
 * Reviews & Ratings Service
 * Persists reviews in Supabase when logged in, falls back to localStorage
 * No Manus AI dependencies — pure Supabase + localStorage
 */

import { supabase } from "./supabase";

export interface Review {
  id: string;
  propertyId: number;
  userId: string;
  userName: string;
  rating: number; // 1-5
  comment: string;
  createdAt: string;
}

// ─── Supabase Reviews ───

export async function fetchReviews(propertyId: number): Promise<Review[]> {
  try {
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false });

    if (error || !data) {
      // Fall back to local reviews
      return getLocalReviews(propertyId);
    }

    return data.map((r: any) => ({
      id: r.id,
      propertyId: r.property_id,
      userId: r.user_id,
      userName: r.user_name,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.created_at,
    }));
  } catch {
    return getLocalReviews(propertyId);
  }
}

export async function submitReview(review: Omit<Review, "id" | "createdAt">): Promise<boolean> {
  try {
    const { error } = await supabase.from("reviews").insert({
      property_id: review.propertyId,
      user_id: review.userId,
      user_name: review.userName,
      rating: review.rating,
      comment: review.comment,
    });

    if (error) {
      // Fall back to local storage
      addLocalReview(review);
      return true;
    }
    return true;
  } catch {
    addLocalReview(review);
    return true;
  }
}

export async function getAverageRating(propertyId: number): Promise<{ average: number; count: number }> {
  try {
    const { data, error } = await supabase
      .from("reviews")
      .select("rating")
      .eq("property_id", propertyId);

    if (error || !data || data.length === 0) {
      return getLocalAverageRating(propertyId);
    }

    const total = data.reduce((sum: number, r: any) => sum + r.rating, 0);
    return { average: total / data.length, count: data.length };
  } catch {
    return getLocalAverageRating(propertyId);
  }
}

// ─── Local Storage Fallback ───

const REVIEWS_KEY = "mk_reviews";

function getAllLocalReviews(): Review[] {
  try {
    const stored = localStorage.getItem(REVIEWS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function getLocalReviews(propertyId: number): Review[] {
  return getAllLocalReviews().filter((r) => r.propertyId === propertyId);
}

function addLocalReview(review: Omit<Review, "id" | "createdAt">): void {
  try {
    const reviews = getAllLocalReviews();
    reviews.unshift({
      ...review,
      id: `local-${Date.now()}`,
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
  } catch {
    // ignore
  }
}

function getLocalAverageRating(propertyId: number): { average: number; count: number } {
  const reviews = getLocalReviews(propertyId);
  if (reviews.length === 0) return { average: 0, count: 0 };
  const total = reviews.reduce((sum, r) => sum + r.rating, 0);
  return { average: total / reviews.length, count: reviews.length };
}

// ─── Demo Reviews (for properties without real reviews) ───

const DEMO_REVIEWERS = [
  "أحمد العتيبي", "سارة القحطاني", "محمد الشمري", "نورة الحربي",
  "خالد الدوسري", "فاطمة المطيري", "عبدالله الغامدي", "ريم السبيعي",
];

const DEMO_COMMENTS = [
  "شقة ممتازة ونظيفة جداً، الموقع مميز وقريب من كل الخدمات. أنصح بها بشدة.",
  "تجربة رائعة، المالك متعاون جداً والشقة مطابقة للوصف تماماً.",
  "الموقع ممتاز والشقة واسعة ومريحة. التكييف يعمل بشكل ممتاز.",
  "سكنت شهرين وكانت تجربة مميزة. الأثاث جديد والنظافة ممتازة.",
  "جيدة بشكل عام، لكن تحتاج بعض الصيانة البسيطة. الموقع ممتاز.",
  "أفضل شقة سكنت فيها، خدمة ممتازة وسرعة في الاستجابة.",
];

export function generateDemoReviews(propertyId: number): Review[] {
  // Use propertyId as seed for consistent reviews per property
  const count = 2 + (propertyId % 4); // 2-5 reviews
  const reviews: Review[] = [];

  for (let i = 0; i < count; i++) {
    const nameIdx = (propertyId + i) % DEMO_REVIEWERS.length;
    const commentIdx = (propertyId + i * 3) % DEMO_COMMENTS.length;
    const rating = 3 + ((propertyId + i) % 3); // 3-5 stars
    const daysAgo = 5 + i * 12 + (propertyId % 10);

    reviews.push({
      id: `demo-${propertyId}-${i}`,
      propertyId,
      userId: `demo-user-${nameIdx}`,
      userName: DEMO_REVIEWERS[nameIdx],
      rating,
      comment: DEMO_COMMENTS[commentIdx],
      createdAt: new Date(Date.now() - daysAgo * 86400000).toISOString(),
    });
  }

  return reviews;
}

export function getDemoAverageRating(propertyId: number): { average: number; count: number } {
  const reviews = generateDemoReviews(propertyId);
  const total = reviews.reduce((sum, r) => sum + r.rating, 0);
  return { average: total / reviews.length, count: reviews.length };
}
