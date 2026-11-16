import { hexToHsl, hslToHex, normalizeHex } from './color';
import { buildCustomPalette, defaultCustomColors, sanitizeCustomColors } from './custom';

describe('normalizeHex', () => {
    it('accepts 3 and 6 digit codes with or without #', () => {
        expect(normalizeHex('#1A2B3C')).toBe('#1a2b3c');
        expect(normalizeHex('1a2b3c')).toBe('#1a2b3c');
        expect(normalizeHex('#abc')).toBe('#aabbcc');
    });

    it('rejects other lengths and characters', () => {
        expect(normalizeHex('#15254')).toBeNull();
        expect(normalizeHex('zzzzzz')).toBeNull();
        expect(normalizeHex('')).toBeNull();
    });
});

describe('hsl round trip', () => {
    it.each(['#b4f03c', '#0d0d0f', '#4cc2ff', '#ff8a3d', '#ffffff', '#000000'])('%s', (hex) => {
        expect(hslToHex(hexToHsl(hex))).toBe(hex);
    });
});

describe('buildCustomPalette', () => {
    it('keeps the chosen colours and derives the rest', () => {
        const palette = buildCustomPalette({
            accent: '#4cc2ff',
            background: '#0a0d12',
            card: '#131a24',
        });
        expect(palette.accent).toBe('#4cc2ff');
        expect(palette.neutral[950]).toBe('#0a0d12');
        expect(palette.neutral[900]).toBe('#131a24');
        expect(hexToHsl(palette.neutral[800]).l).toBeGreaterThan(hexToHsl('#131a24').l);
        expect(palette.onAccent).toBe('#0d0d0f');
    });

    it('uses white text on a dark accent', () => {
        expect(buildCustomPalette({ ...defaultCustomColors, accent: '#1d3a8a' }).onAccent).toBe(
            '#ffffff',
        );
    });

    it('falls back to defaults for bad stored values', () => {
        expect(sanitizeCustomColors({ accent: 'nope', background: '#123', card: 4 })).toEqual({
            accent: defaultCustomColors.accent,
            background: '#112233',
            card: defaultCustomColors.card,
        });
    });
});
