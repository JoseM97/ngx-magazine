import {
  BURST_MAX_FONT,
  BURST_MAX_WIDTH,
  BURST_MIN_FONT,
  countBurstLines,
  fitBurstFontSize,
} from './burst-fit';

describe('burst-fit', () => {
  it('should use the maximum size for a very short text', () => {
    expect(fitBurstFontSize('HI')).toBe(BURST_MAX_FONT);
  });

  it('should return the maximum size for empty text', () => {
    expect(fitBurstFontSize('   ')).toBe(BURST_MAX_FONT);
  });

  it('should shrink as the text gets longer', () => {
    const short = fitBurstFontSize('Viajes');
    const medium = fitBurstFontSize('Viajes por Europa');
    const long = fitBurstFontSize('Especial viajes por toda Europa en verano');

    expect(short).toBeGreaterThanOrEqual(medium);
    expect(medium).toBeGreaterThanOrEqual(long);
    expect(long).toBeLessThan(short);
  });

  it('should never go below the minimum size', () => {
    expect(fitBurstFontSize('x'.repeat(500))).toBe(BURST_MIN_FONT);
  });

  it('should keep the longest word within the available width', () => {
    const text = 'Arquitectura moderna';
    const size = fitBurstFontSize(text);
    const longest = 'ARQUITECTURA'.length;

    // Estimación del ancho con la misma anchura por letra que el cálculo.
    expect(longest * size * 0.66).toBeLessThanOrEqual(BURST_MAX_WIDTH + 0.001);
  });

  it('should count wrapped lines', () => {
    expect(countBurstLines('AB CD', 10)).toBe(1);
    expect(countBurstLines('AB CD', 4)).toBe(2);
    expect(countBurstLines('ABCDEFGHIJ', 4)).toBe(3);
    expect(countBurstLines('', 4)).toBe(1);
  });
});