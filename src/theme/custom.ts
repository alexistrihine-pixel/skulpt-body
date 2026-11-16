// "Personnalisé" palette: the user picks the accent, the background and the cards;
// every other dark-theme colour is derived from them.
import { hexToHsl, hslToHex, luminance, normalizeHex, shiftLightness, withAlpha } from './color';
import { palettes, type Palette } from './palettes';

export interface CustomColors {
    accent: string;
    background: string;
    card: string;
}

export const defaultCustomColors: CustomColors = {
    accent: '#b4f03c',
    background: '#0d0d0f',
    card: '#1a1a1d',
};

export const sanitizeCustomColors = (value: unknown): CustomColors => {
    const v = (value ?? {}) as Partial<Record<keyof CustomColors, unknown>>;
    const pick = (key: keyof CustomColors) =>
        (typeof v[key] === 'string' && normalizeHex(v[key] as string)) || defaultCustomColors[key];
    return { accent: pick('accent'), background: pick('background'), card: pick('card') };
};

export const buildCustomPalette = (colors: CustomColors): Palette => {
    const { accent, background, card } = colors;
    const bg = hexToHsl(background);
    const cardHsl = hexToHsl(card);
    // Surfaces step away from the card colour: lighter on a dark card, darker on a light one.
    const dir = cardHsl.l < 0.6 ? 1 : -1;
    const step = (delta: number) => shiftLightness(card, dir * delta);

    // Text greys keep Graphite's lightness, tinted with the background hue.
    const greySat = Math.min(bg.s, 0.12);
    const grey = (hex: string) => hslToHex({ h: bg.h, s: greySat, l: hexToHsl(hex).l });
    const base = palettes.graphite.neutral;

    const neutral: Palette['neutral'] = {
        50: grey(base[50]),
        100: grey(base[100]),
        200: grey(base[200]),
        300: grey(base[300]),
        400: grey(base[400]),
        500: grey(base[500]),
        600: grey(base[600]),
        700: step(0.13),
        800: step(0.05),
        900: card,
        925: hslToHex({ h: bg.h, s: (bg.s + cardHsl.s) / 2, l: (bg.l + cardHsl.l) / 2 }),
        950: background,
    };

    const acc = hexToHsl(accent);
    const lime = Object.fromEntries(
        Object.entries(palettes.graphite.lime).map(([k, hex]) => {
            const { l, s } = hexToHsl(hex);
            return [k, hslToHex({ h: acc.h, s: Math.min(s, Math.max(acc.s, 0.6)), l })];
        }),
    ) as Palette['lime'];

    const lightBackground = bg.l > 0.55;
    const onAccent = luminance(accent) > 0.18 ? '#0d0d0f' : '#ffffff';

    return {
        neutral,
        lime,
        typography: lightBackground ? '#111114' : grey('#f4f4f6'),
        border: step(0.08),
        accent,
        accentStrong: shiftLightness(accent, -0.06),
        accentMuted: withAlpha(accent, 0.16),
        accentSubtle: withAlpha(accent, 0.08),
        rowActive: step(0.03),
        fieldBackground: step(0.075),
        onAccent,
    };
};
