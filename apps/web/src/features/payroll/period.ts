/** Último día natural de un periodo «YYYY-MM» (fecha de devengo por defecto de la nómina). */
export function lastDayOfPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number);
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${period}-${String(day).padStart(2, '0')}`;
}
