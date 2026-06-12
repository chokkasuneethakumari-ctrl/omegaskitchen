// Omega's Kitchen design tokens — iOS-Native Clean, warm Terracotta/Ochre palette
export const C = {
  surface: "#FAFAFA",
  card: "#FFFFFF",
  surfaceTertiary: "#F2F2F7",
  text: "#1C1C1E",
  textSecondary: "#6E6E73",
  textTertiary: "#9A9AA0",
  brand: "#D35400",
  brandSecondary: "#E67E22",
  brandTint: "#FDEBD0",
  accent: "#D8A657",
  success: "#27AE60",
  successTint: "#E8F8EF",
  warning: "#F39C12",
  warningTint: "#FEF5E7",
  error: "#C0392B",
  errorTint: "#FBEAE8",
  info: "#34495E",
  border: "#E5E5EA",
  borderStrong: "#C7C7CC",
  inverse: "#1C1C1E",
  onInverse: "#FFFFFF",
};

export const F = {
  regular: "Geist-Regular",
  medium: "Geist-Medium",
  semibold: "Geist-SemiBold",
  bold: "Geist-Bold",
};

export const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const R = { sm: 6, md: 12, lg: 20, pill: 999 };

export const shadow = {
  shadowColor: "#000",
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};

export const formatPrice = (n: number | null | undefined) =>
  n == null ? "—" : `₹${Number(n).toFixed(0)}`;

export const STATUS_META: Record<
  string,
  { label: string; color: string; tint: string; icon: string }
> = {
  placed: { label: "In Queue", color: "#F39C12", tint: "#FEF5E7", icon: "time" },
  cooking: { label: "Cooking", color: "#D35400", tint: "#FDEBD0", icon: "flame" },
  ready: { label: "Ready", color: "#27AE60", tint: "#E8F8EF", icon: "checkmark-circle" },
  completed: { label: "Picked Up", color: "#6E6E73", tint: "#F2F2F7", icon: "bag-check" },
  cancelled: { label: "Cancelled", color: "#C0392B", tint: "#FBEAE8", icon: "close-circle" },
};

// Crisp, retina-grade food photography served from the Unsplash CDN (auto-format ->
// webp/avif), cached on-device by expo-image. Hosting remotely keeps the APK lean while
// the visuals stay sharp on high-density displays.
export const FOOD_IMAGES = [
  "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=1400&q=88&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=1400&q=88&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=1400&q=88&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=1400&q=88&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=1400&q=88&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=1400&q=88&auto=format&fit=crop",
];

// Welcome-hero poster — the video's own first frame, bundled locally so the first
// screen paints instantly with zero network dependency.
export const HERO_IMAGE = require("../assets/videos/hero-poster.jpg");

// Welcome-hero footage — a ~12s 1080×1920 loop of fresh prep, transcoded from the 4K
// master and bundled locally (~1.2 MB). Fully offline; HERO_IMAGE is its poster frame.
export const HERO_VIDEO = require("../assets/videos/hero.mp4");
