// Business-day helpers (skip Sat/Sun). Used by SLA logic.
export function addBusinessDays(start: Date, days: number): Date {
  const d = new Date(start);
  let added = 0;
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay(); // 0=Sun, 6=Sat
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

export function isBusinessHourUtc(d = new Date()): boolean {
  const dow = d.getUTCDay();
  return dow !== 0 && dow !== 6;
}
