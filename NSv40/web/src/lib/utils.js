import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
	return twMerge(clsx(inputs));
}
/**
 * Formate un nombre de lectures en format compact : 12400 → "12.4k", 1200000 → "1.2M"
 */
export function formatPlays(count) {
  if (!count || count === 0) return '0';
  if (count < 1000) return String(count);
  if (count < 1000000) return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
}
