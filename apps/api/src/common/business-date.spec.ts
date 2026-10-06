import { todayInMexico } from './business-date';

describe('todayInMexico', () => {
  it('a mediodía UTC es el mismo día', () => {
    expect(todayInMexico(new Date('2026-10-05T18:00:00Z'))).toBe('2026-10-05');
  });

  it('cerca de medianoche UTC todavía es el día anterior en México', () => {
    // 02:30 UTC del 6 = 20:30 del 5 en CDMX (UTC-6, sin horario de verano).
    expect(todayInMexico(new Date('2026-10-06T02:30:00Z'))).toBe('2026-10-05');
  });

  it('pasa al día siguiente cuando en México ya es medianoche', () => {
    expect(todayInMexico(new Date('2026-10-06T06:00:00Z'))).toBe('2026-10-06');
  });
});
