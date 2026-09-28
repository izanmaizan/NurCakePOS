import { useWindowDimensions } from "react-native";

/**
 * Hook terpusat untuk deteksi orientasi dan ukuran layar.
 * Gunakan ini di semua komponen yang perlu responsif terhadap rotasi.
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isTablet = width >= 768;
  // Wide = tampilan side-panel (landscape phone ATAU tablet)
  const isWide = isLandscape || isTablet;
  return { width, height, isLandscape, isTablet, isWide };
}
