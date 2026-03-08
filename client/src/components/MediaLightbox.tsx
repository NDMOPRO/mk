import { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut, Play, ImageIcon, Grid3X3, Heart, Share2, EyeOff } from "lucide-react";

interface MediaItem {
  url: string;
  type: "image" | "video";
}

/** Property info passed to the lightbox for the left sidebar */
export interface LightboxPropertyInfo {
  title?: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sizeSqm?: number | null;
  monthlyRent?: number | null;
  lang?: "ar" | "en";
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onShare?: () => void;
  onWhatsApp?: () => void;
}

interface MediaLightboxProps {
  items: MediaItem[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
  /** Optional property info for the enhanced sidebar layout */
  propertyInfo?: LightboxPropertyInfo;
}

export function MediaLightbox({ items, initialIndex = 0, open, onClose, propertyInfo }: MediaLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [viewMode, setViewMode] = useState<"slideshow" | "grid">("slideshow");
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setZoom(1);
      setViewMode("slideshow");
    }
  }, [open, initialIndex]);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (i + 1) % items.length);
    setZoom(1);
  }, [items.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i - 1 + items.length) % items.length);
    setZoom(1);
  }, [items.length]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(z + 0.25, 3));
      if (e.key === "-") setZoom((z) => Math.max(z - 0.25, 0.5));
      if (e.key === "g") setViewMode((m) => m === "grid" ? "slideshow" : "grid");
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, goNext, goPrev, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  if (!open || items.length === 0) return null;

  const current = items[currentIndex];
  const isVideo = current.type === "video";
  const lang = propertyInfo?.lang || "ar";
  const isRTL = lang === "ar";

  // Side thumbnails: show up to 3, last one gets "+N" overlay
  const sideThumbCount = 3;
  const sideItems = items.slice(0, sideThumbCount);
  const remainingCount = items.length - sideThumbCount;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onClick={onClose}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#0f1729]/95 backdrop-blur-md" />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 sm:px-6 py-3 z-20" onClick={(e) => e.stopPropagation()}>
        <div dir="ltr" className="flex items-center gap-3">
          <span className="text-white/80 text-sm font-medium bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-sm">
            {currentIndex + 1} / {items.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Close */}
          <button
            onClick={onClose}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title={lang === "ar" ? "إغلاق" : "Close"}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Grid view */}
      {viewMode === "grid" ? (
        <div
          className="relative z-10 w-full h-full pt-16 pb-4 px-4 sm:px-8 overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-w-7xl mx-auto">
            {items.map((item, idx) => (
              <button
                key={idx}
                onClick={() => { setCurrentIndex(idx); setViewMode("slideshow"); setZoom(1); }}
                className={`relative aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all hover:scale-[1.02] hover:shadow-lg ${
                  idx === currentIndex ? "border-[#3ECFC0] shadow-lg shadow-[#3ECFC0]/20" : "border-transparent"
                }`}
              >
                {item.type === "video" ? (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                    <Play className="w-8 h-8 text-white" />
                  </div>
                ) : (
                  <img src={item.url} alt="" className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.3'; }} />
                )}
                <div className="absolute bottom-1.5 end-1.5 text-[10px] text-white/70 bg-black/40 px-1.5 py-0.5 rounded">
                  {idx + 1}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Slideshow view — the main enhanced layout */
        <div
          className="relative z-10 flex items-center justify-center w-full h-full px-4 sm:px-6 lg:px-8 pt-14 pb-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-stretch gap-4 lg:gap-6 w-full max-w-7xl h-[calc(100vh-120px)] max-h-[700px]">

            {/* Left sidebar — property info (hidden on mobile) */}
            {propertyInfo && (
              <div className="hidden lg:flex flex-col justify-center w-[260px] xl:w-[300px] shrink-0 text-white space-y-5">
                {/* Title */}
                {propertyInfo.title && (
                  <h2 className="text-2xl xl:text-3xl font-bold font-heading leading-tight text-white/95">
                    {propertyInfo.title}
                  </h2>
                )}

                {/* Stats */}
                <div className="space-y-2.5 text-white/75 text-base">
                  {propertyInfo.bedrooms != null && (
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{propertyInfo.bedrooms}</span>
                      <span>{lang === "ar" ? "غرف نوم" : "Bedrooms"}</span>
                    </div>
                  )}
                  {propertyInfo.bathrooms != null && (
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{propertyInfo.bathrooms}</span>
                      <span>{lang === "ar" ? "حمام" : "Bathrooms"}</span>
                    </div>
                  )}
                  {propertyInfo.sizeSqm != null && (
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{propertyInfo.sizeSqm}</span>
                      <span>{lang === "ar" ? "م²" : "sqm"}</span>
                    </div>
                  )}
                </div>

                {/* Price */}
                {propertyInfo.monthlyRent != null && (
                  <div className="text-[#3ECFC0] text-xl font-bold">
                    {Number(propertyInfo.monthlyRent).toLocaleString()} {lang === "ar" ? "ر.س/شهر" : "SAR/mo"}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-3 pt-2">
                  {propertyInfo.onShare && (
                    <button
                      onClick={propertyInfo.onShare}
                      className="h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 transition-all hover:scale-105"
                      title={lang === "ar" ? "مشاركة" : "Share"}
                    >
                      <Share2 className="h-5 w-5" />
                    </button>
                  )}
                  {propertyInfo.onToggleFavorite && (
                    <button
                      onClick={propertyInfo.onToggleFavorite}
                      className="h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all hover:scale-105"
                      title={lang === "ar" ? "المفضلة" : "Favorite"}
                    >
                      <Heart className={`h-5 w-5 ${propertyInfo.isFavorite ? "fill-red-500 text-red-500" : "text-white/80"}`} />
                    </button>
                  )}
                  {propertyInfo.onWhatsApp && (
                    <button
                      onClick={propertyInfo.onWhatsApp}
                      className="h-12 w-12 rounded-full bg-[#25D366] hover:bg-[#20bd5a] flex items-center justify-center text-white transition-all hover:scale-105"
                      title="WhatsApp"
                    >
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Center — main image */}
            <div
              className="relative flex-1 min-w-0 rounded-2xl overflow-hidden bg-black/30"
              onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
              onTouchEnd={(e) => {
                if (touchStartX.current === null) return;
                const dx = e.changedTouches[0].clientX - touchStartX.current;
                if (Math.abs(dx) > 50) {
                  if (isRTL ? dx > 0 : dx < 0) goNext();
                  else goPrev();
                }
                touchStartX.current = null;
              }}
            >
              {isVideo ? (
                <video
                  src={current.url}
                  controls
                  autoPlay
                  className="w-full h-full object-contain rounded-2xl"
                />
              ) : (
                <img loading="lazy"                   src={current.url}
                  alt={`${currentIndex + 1}`}
                  className="w-full h-full object-contain rounded-2xl transition-transform duration-200"
                  style={{ transform: `scale(${zoom})` }}
                  draggable={false}
                  onError={(e) => {
                    const el = e.currentTarget;
                    el.style.display = 'none';
                    const fb = el.parentElement?.querySelector('.lb-fallback') as HTMLElement;
                    if (fb) fb.style.display = 'flex';
                  }}
                />
              )}
              <div className="lb-fallback hidden items-center justify-center text-white/60 absolute inset-0" style={{ display: 'none' }}>
                <div className="text-center">
                  <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{lang === "ar" ? "الصورة غير متوفرة" : "Image unavailable"}</p>
                </div>
              </div>

              {/* Navigation arrows on main image */}
              {items.length > 1 && (
                <>
                  <button
                    onClick={goPrev}
                    className="absolute start-3 top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full bg-black/40 hover:bg-black/60 text-white transition-all hover:scale-110 backdrop-blur-sm"
                  >
                    {isRTL ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={goNext}
                    className="absolute end-3 top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full bg-black/40 hover:bg-black/60 text-white transition-all hover:scale-110 backdrop-blur-sm"
                  >
                    {isRTL ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </button>
                </>
              )}
            </div>

            {/* Right sidebar — stacked thumbnails (hidden on mobile) */}
            {items.length > 1 && (
              <div className="hidden md:flex flex-col gap-3 w-[180px] xl:w-[210px] shrink-0">
                {sideItems.map((item, idx) => {
                  const isLast = idx === sideThumbCount - 1 && remainingCount > 0;
                  return (
                    <button
                      key={idx}
                      onClick={() => { setCurrentIndex(idx); setZoom(1); }}
                      className={`relative flex-1 rounded-xl overflow-hidden border-2 transition-all hover:scale-[1.02] ${
                        idx === currentIndex
                          ? "border-[#3ECFC0] shadow-lg shadow-[#3ECFC0]/20"
                          : "border-white/10 hover:border-white/30"
                      }`}
                    >
                      {item.type === "video" ? (
                        <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                          <Play className="w-6 h-6 text-white" />
                        </div>
                      ) : (
                        <img
                          src={item.url}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.3'; }}
                        />
                      )}
                      {/* "+N" overlay on last thumbnail */}
                      {isLast && (
                        <div
                          className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); setViewMode("grid"); }}
                        >
                          <span className="text-white text-3xl xl:text-4xl font-bold">+{remainingCount}</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile bottom thumbnail strip */}
      {viewMode === "slideshow" && items.length > 1 && (
        <div
          className="md:hidden absolute bottom-3 left-0 right-0 z-20 flex gap-2 px-4 overflow-x-auto pb-1"
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item, idx) => (
            <button
              key={idx}
              onClick={() => { setCurrentIndex(idx); setZoom(1); }}
              className={`relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                idx === currentIndex ? "border-[#3ECFC0] scale-110" : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              {item.type === "video" ? (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                  <Play className="w-4 h-4 text-white" />
                </div>
              ) : (
                <img loading="lazy" src={item.url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.3'; }} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Helper: detect media type from URL */
export function getMediaType(url: string): "image" | "video" {
  const videoExts = [".mp4", ".webm", ".mov", ".avi", ".mkv"];
  const lower = url.toLowerCase();
  return videoExts.some((ext) => lower.includes(ext)) ? "video" : "image";
}

/** Helper: convert URL array to MediaItem array */
export function urlsToMediaItems(urls: string[]): MediaItem[] {
  return urls.map((url) => ({ url, type: getMediaType(url) }));
}
