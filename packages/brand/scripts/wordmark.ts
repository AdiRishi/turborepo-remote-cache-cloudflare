/**
 * Geometry for the hand-drawn monoline wordmark.
 *
 * Units: x-height runs from y=6 to the baseline at y=16, ascenders reach y=1 and
 * descenders y=20. Every glyph keeps those outer edges at any stroke weight, so a
 * lighter word still sits on the same baseline and x-height as a heavier one.
 */

type Glyph = (x: number, stroke: number) => { width: number; d: string };

const round = (n: number) => Number(n.toFixed(3));
const SIN45 = Math.SQRT1_2;
const TOP = 6;
const BASE = 16;
const CY = 11;

const bowl = (x: number, s: number) => {
  const r = 5 - s / 2;
  return `M${round(x + s / 2)} ${CY}A${round(r)} ${round(r)} 0 1 0 ${round(x + 10 - s / 2)} ${CY}A${round(r)} ${round(r)} 0 1 0 ${round(x + s / 2)} ${CY}Z`;
};
const stem = (x: number, from: number, to: number) => `M${round(x)} ${from}V${to}`;
const arch = (left: number, right: number, s: number) => {
  const r = (right - left) / 2;
  const cy = TOP + s / 2 + r;
  return `M${round(left)} ${round(cy)}A${round(r)} ${round(r)} 0 0 1 ${round(right)} ${round(cy)}V${BASE}`;
};

const glyphs: Record<string, Glyph> = {
  a: (x, s) => ({ width: 10, d: bowl(x, s) + stem(x + 10 - s / 2, TOP, BASE) }),
  b: (x, s) => ({ width: 10, d: bowl(x, s) + stem(x + s / 2, 1, BASE) }),
  c: (x, s) => {
    const r = 5 - s / 2;
    const ex = round(x + 5 + r * SIN45);
    return {
      width: round(5 + r * SIN45 + s * 0.4),
      d: `M${ex} ${round(CY - r * SIN45)}A${round(r)} ${round(r)} 0 1 0 ${ex} ${round(CY + r * SIN45)}`,
    };
  },
  e: (x, s) => {
    const r = 5 - s / 2;
    return {
      width: 10,
      d: `M${round(x + s / 2)} ${CY}H${round(x + 10 - s / 2)}A${round(r)} ${round(r)} 0 1 0 ${round(x + 5 + r * SIN45)} ${round(CY + r * SIN45)}`,
    };
  },
  h: (x, s) => ({ width: 10, d: stem(x + s / 2, 1, BASE) + arch(x + s / 2, x + 10 - s / 2, s) }),
  m: (x, s) => ({
    width: 16,
    d: stem(x + s / 2, TOP, BASE) + arch(x + s / 2, x + 8, s) + arch(x + 8, x + 16 - s / 2, s),
  }),
  o: (x, s) => ({ width: 10, d: bowl(x, s) }),
  p: (x, s) => ({ width: 10, d: bowl(x, s) + stem(x + s / 2, TOP, 20) }),
  r: (x, s) => {
    const r = 5 - s / 2;
    return {
      width: 5.5,
      d: `${stem(x + s / 2, TOP, BASE)}M${round(x + s / 2)} ${CY}A${round(r)} ${round(r)} 0 0 1 ${round(x + 5)} ${round(TOP + s / 2)}H${round(x + 5.5)}`,
    };
  },
  t: (x, s) => ({
    width: 5.5,
    d: `${stem(x + 2.25, 3, BASE)}M${round(x)} ${round(TOP + s / 2)}H${round(x + 5.5)}`,
  }),
  u: (x, s) => {
    const r = 5 - s / 2;
    return {
      width: 10,
      d: `M${round(x + s / 2)} ${TOP}V${CY}A${round(r)} ${round(r)} 0 0 0 ${round(x + 10 - s / 2)} ${CY}${stem(x + 10 - s / 2, TOP, BASE)}`,
    };
  },
};

/** Optical gaps between glyph outer edges, tuned by eye. */
const KERN: Record<string, number> = {
  ac: 1.6,
  bo: 1.6,
  ca: 1.6,
  ch: 1.9,
  em: 2.2,
  ep: 1.9,
  he: 1.7,
  mo: 1.8,
  or: 1.8,
  ot: 1.2,
  po: 1.6,
  rb: 1.4,
  re: 0.9,
  te: 1.0,
  tu: 1.2,
  ur: 2.2,
};
const WORD_SPACE = 5.2;
const DEFAULT_GAP = 1.8;

export interface Word {
  text: string;
  stroke: number;
}

export interface SetWord {
  d: string;
  stroke: number;
}

/** Lays out words left to right from `start`; returns one path per word and the end x. */
export function setWords(words: readonly Word[], start = 0): { words: SetWord[]; width: number } {
  let x = start;
  const out: SetWord[] = [];
  words.forEach((word, wi) => {
    if (wi > 0) x += WORD_SPACE;
    let d = '';
    for (let i = 0; i < word.text.length; i++) {
      const ch = word.text.charAt(i);
      const glyph = glyphs[ch];
      if (!glyph) throw new Error(`No glyph for "${ch}"`);
      const g = glyph(x, word.stroke);
      d += g.d;
      x += g.width;
      if (i < word.text.length - 1) x += KERN[ch + word.text.charAt(i + 1)] ?? DEFAULT_GAP;
    }
    out.push({ d, stroke: word.stroke });
  });
  return { words: out, width: round(x) };
}
