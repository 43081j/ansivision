export type Color = number | readonly [r: number, g: number, b: number];

export interface Style {
  readonly bold: boolean;
  readonly dim: boolean;
  readonly italic: boolean;
  readonly underline: boolean;
  readonly blink: boolean;
  readonly inverse: boolean;
  readonly hidden: boolean;
  readonly strikethrough: boolean;
  readonly foreground: Color | null;
  readonly background: Color | null;
}

export const computeColorKey = (color: Color | null): string => {
  if (color === null) {
    return '_';
  }
  if (typeof color === 'number') {
    return `p${color}`;
  }
  return `r${color[0]},${color[1]},${color[2]}`;
};

export const computeStyleKey = (style: Style): string => {
  return (
    (style.bold ? '1' : '0') +
    (style.dim ? '1' : '0') +
    (style.italic ? '1' : '0') +
    (style.underline ? '1' : '0') +
    (style.blink ? '1' : '0') +
    (style.inverse ? '1' : '0') +
    (style.hidden ? '1' : '0') +
    (style.strikethrough ? '1' : '0') +
    `|${computeColorKey(style.foreground)}|${computeColorKey(style.background)}`
  );
};

export const readExtendedColor = (
  params: string[],
  index: number,
): [Color | null, number] => {
  const mode = params[index + 1];

  // palette colours
  if (mode === '5') {
    const value = params[index + 2];
    if (value === undefined) {
      return [null, 0];
    }
    return [parseInt(value, 10), 2];
  }

  // rgb colours
  if (mode === '2') {
    // + 2 is the colour space, which we don't need
    const r = params[index + 3];
    const g = params[index + 4];
    const b = params[index + 5];
    if (r === undefined || g === undefined || b === undefined) {
      return [null, 0];
    }
    return [[parseInt(r, 10), parseInt(g, 10), parseInt(b, 10)], 5];
  }

  return [null, 0];
};

const colorToParams = (color: Color, background: boolean): string[] => {
  if (typeof color === 'number') {
    if (color < 8) {
      return [String((background ? 40 : 30) + color)];
    }
    if (color < 16) {
      return [String((background ? 100 : 90) + color - 8)];
    }
    return [background ? '48' : '38', '5', String(color)];
  }
  return [
    background ? '48' : '38',
    '2',
    '0',
    String(color[0]),
    String(color[1]),
    String(color[2]),
  ];
};

export const styleToParams = (style: Style): string[] => {
  const params: string[] = [];

  if (style.bold) params.push('1');
  if (style.dim) params.push('2');
  if (style.italic) params.push('3');
  if (style.underline) params.push('4');
  if (style.blink) params.push('5');
  if (style.inverse) params.push('7');
  if (style.hidden) params.push('8');
  if (style.strikethrough) params.push('9');
  if (style.foreground !== null) {
    params.push(...colorToParams(style.foreground, false));
  }
  if (style.background !== null) {
    params.push(...colorToParams(style.background, true));
  }

  return params;
};

export const styleToSequence = (style: Style): string => {
  return `\x1b[${['0', ...styleToParams(style)].join(';')}m`;
};

export const createStyleCollection = (
  length: number,
  style: Style,
): Style[] => {
  const col = new Array<Style>(length);
  col.fill(style);
  return col;
};

export const DEFAULT_STYLE: Style = Object.freeze({
  bold: false,
  dim: false,
  italic: false,
  underline: false,
  blink: false,
  inverse: false,
  hidden: false,
  strikethrough: false,
  foreground: null,
  background: null,
});

export const DEFAULT_STYLE_KEY = computeStyleKey(DEFAULT_STYLE);

type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

export function computeStyleForParams(
  currentStyle: Style,
  params: string[],
): Style {
  if (params.length === 0) {
    return DEFAULT_STYLE;
  }

  const next: Mutable<Style> = { ...currentStyle };

  for (let i = 0; i < params.length; i++) {
    const param = params[i];
    const code = param ? parseInt(param, 10) : 0;

    switch (code) {
      case 0:
        Object.assign(next, DEFAULT_STYLE);
        break;
      case 1:
        next.bold = true;
        break;
      case 2:
        next.dim = true;
        break;
      case 3:
        next.italic = true;
        break;
      case 4:
        next.underline = true;
        break;
      case 5:
        next.blink = true;
        break;
      case 7:
        next.inverse = true;
        break;
      case 8:
        next.hidden = true;
        break;
      case 9:
        next.strikethrough = true;
        break;
      case 22:
        next.bold = false;
        next.dim = false;
        break;
      case 23:
        next.italic = false;
        break;
      case 24:
        next.underline = false;
        break;
      case 25:
        next.blink = false;
        break;
      case 27:
        next.inverse = false;
        break;
      case 28:
        next.hidden = false;
        break;
      case 29:
        next.strikethrough = false;
        break;
      case 38: {
        const [color, consumed] = readExtendedColor(params, i);
        if (consumed > 0) {
          next.foreground = color;
          i += consumed;
        }
        break;
      }
      case 39:
        next.foreground = null;
        break;
      case 48: {
        const [color, consumed] = readExtendedColor(params, i);
        if (consumed > 0) {
          next.background = color;
          i += consumed;
        }
        break;
      }
      case 49:
        next.background = null;
        break;
      default:
        if (code >= 30 && code <= 37) {
          next.foreground = code - 30;
        } else if (code >= 40 && code <= 47) {
          next.background = code - 40;
        } else if (code >= 90 && code <= 97) {
          next.foreground = code - 90 + 8;
        } else if (code >= 100 && code <= 107) {
          next.background = code - 100 + 8;
        }
        break;
    }
  }

  return next;
}

export interface StyledFrameOptions {
  /**
   * Maximum number of columns to render. Lines longer than this are clipped.
   */
  columns?: number;
  /**
   * Maximum number of rows to render. Rows beyond this are clipped.
   */
  rows?: number;
  /**
   * Column to start rendering from. Only applies when {@link columns} is set.
   */
  scrollX?: number;
  /**
   * Row to start rendering from. Only applies when {@link rows} is set.
   */
  scrollY?: number;
}

export function computeStyledFrame(
  frame: string,
  styles: Style[][],
  options?: StyledFrameOptions,
): string {
  const lineBuffers = frame.split('\n');
  let result = '';
  let currentStyle: Style = DEFAULT_STYLE;

  const rowStart = options?.rows !== undefined ? (options.scrollY ?? 0) : 0;
  const rowEnd =
    options?.rows !== undefined
      ? Math.min(lineBuffers.length, rowStart + options.rows)
      : lineBuffers.length;
  const colStart = options?.columns !== undefined ? (options.scrollX ?? 0) : 0;

  for (let line = rowStart; line < rowEnd; line++) {
    if (line > rowStart) {
      result += '\n';
    }

    const lineBuffer = lineBuffers[line]!;
    const colEnd =
      options?.columns !== undefined
        ? Math.min(lineBuffer.length, colStart + options.columns)
        : lineBuffer.length;

    for (let col = colStart; col < colEnd; col++) {
      const style = styles[line]?.[col] ?? DEFAULT_STYLE;

      if (style !== currentStyle) {
        result += styleToSequence(style);
        currentStyle = style;
      }

      result += lineBuffer[col];
    }
  }

  if (currentStyle !== DEFAULT_STYLE) {
    result += '\x1b[0m';
  }

  return result;
}
