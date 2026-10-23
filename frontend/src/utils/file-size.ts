const UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const

export function formatFileSize(bytes: number, locale: string): string {
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < UNITS.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: UNITS[unitIndex],
    unitDisplay: 'short',
    maximumFractionDigits: unitIndex === 0 ? 0 : 1,
  }).format(value)
}
