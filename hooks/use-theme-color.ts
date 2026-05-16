import { Colors } from '@/constants/theme';

// All colors are dark-mode only — this hook always returns the single color value
export function useThemeColor(
  props: { light?: string; dark?: string },
  _colorName: string
): string {
  return props.dark ?? props.light ?? Colors.textPrimary;
}
