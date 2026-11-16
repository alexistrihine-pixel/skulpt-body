// Small colour helpers (hex <-> HSL) used by the custom palette and the colour picker.

export interface Hsl {
    /** 0-360 */
    h: number;
    /** 0-1 */
    s: number;
    /** 0-1 */
    l: number;
}

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

/** Accepts "#abc", "abc", "#aabbcc" or "aabbcc"; returns "#aabbcc" or null. */
export const normalizeHex = (input: string): string | null => {
    const raw = input.trim().replace(/^#/, '').toLowerCase();
    if (/^[0-9a-f]{3}$/.test(raw)) {
        return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`;
    }
    if (/^[0-9a-f]{6}$/.test(raw)) return `#${raw}`;
    return null;
};

export const hexToRgb = (hex: string): [number, number, number] => {
    const h = (normalizeHex(hex) ?? '#000000').slice(1);
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
};

export const rgbToHex = (r: number, g: number, b: number) =>
    `#${[r, g, b]
        .map((c) =>
            Math.round(clamp(c, 0, 255))
                .toString(16)
                .padStart(2, '0'),
        )
        .join('')}`;

export const hexToHsl = (hex: string): Hsl => {
    const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h: number;
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return { h: h * 60, s, l };
};

export const hslToHex = ({ h, s, l }: Hsl): string => {
    const hue = ((h % 360) + 360) % 360;
    const sat = clamp(s);
    const lig = clamp(l);
    const c = (1 - Math.abs(2 * lig - 1)) * sat;
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = lig - c / 2;
    const [r, g, b] =
        hue < 60
            ? [c, x, 0]
            : hue < 120
              ? [x, c, 0]
              : hue < 180
                ? [0, c, x]
                : hue < 240
                  ? [0, x, c]
                  : hue < 300
                    ? [x, 0, c]
                    : [c, 0, x];
    return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
};

/** Same hue and saturation, lightness shifted (clamped). */
export const shiftLightness = (hex: string, delta: number) => {
    const hsl = hexToHsl(hex);
    return hslToHex({ ...hsl, l: clamp(hsl.l + delta) });
};

export const withAlpha = (hex: string, alpha: number) => {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

export const luminance = (hex: string) => {
    const [r, g, b] = hexToRgb(hex);
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};
