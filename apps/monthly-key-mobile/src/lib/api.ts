/**
 * Monthly Key API Client
 * Connects to monthlykey.com tRPC endpoints
 * In React Native, calls the API directly (no CORS restrictions)
 */

const API_BASE = "https://monthlykey.com/api/trpc";

export interface ApiProperty {
  id: number;
  landlordId: number;
  titleEn: string;
  titleAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  propertyType: string;
  status: string;
  city: string;
  cityAr: string;
  district: string;
  districtAr: string;
  latitude: string | null;
  longitude: string | null;
  googleMapsUrl: string | null;
  bedrooms: number;
  bathrooms: number;
  sizeSqm: number;
  furnishedLevel: string;
  monthlyRent: string;
  securityDeposit: string | null;
  amenities: string[];
  minStayMonths: number;
  maxStayMonths: number;
  instantBook: boolean;
  photos: string[];
  isVerified: boolean;
  isFeatured: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult {
  items: ApiProperty[];
  total: number;
}

async function trpcQuery<T>(procedure: string, input?: object): Promise<T> {
  let url = \`\${API_BASE}/\${procedure}\`;
  if (input) {
    const encoded = encodeURIComponent(JSON.stringify({ json: input }));
    url += \`?input=\${encoded}\`;
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(\`API error: \${response.status}\`);
  const data = await response.json();
  return data.result.data.json;
}

export async function getFeaturedProperties(): Promise<ApiProperty[]> {
  return trpcQuery<ApiProperty[]>("property.featured");
}

export async function searchProperties(params: object): Promise<SearchResult> {
  return trpcQuery<SearchResult>("property.search", params);
}

export async function getPropertyById(id: number): Promise<ApiProperty | null> {
  return trpcQuery<ApiProperty | null>("property.getById", { id });
}

export function calculateBookingTotal(monthlyRent: number, durationMonths: number) {
  const insuranceRate = 10;
  const serviceFeeRate = 5;
  const vatRate = 15;
  const baseRentTotal = Math.round(monthlyRent * durationMonths);
  const insuranceAmount = Math.round(monthlyRent * (insuranceRate / 100));
  const serviceFeeAmount = Math.round(baseRentTotal * (serviceFeeRate / 100));
  const subtotal = baseRentTotal + insuranceAmount + serviceFeeAmount;
  const vatAmount = Math.round(subtotal * (vatRate / 100));
  const grandTotal = subtotal + vatAmount;
  return {
    baseRentTotal, insuranceAmount, serviceFeeAmount, subtotal, vatAmount, grandTotal,
    appliedRates: { insuranceRate, serviceFeeRate, vatRate },
    currency: "SAR",
  };
}
