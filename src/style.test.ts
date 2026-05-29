import { suite, assert, test } from 'vitest';
import {
  type Style,
  computeColorKey,
  computeStyleKey,
  computeStyleForParams,
  createStyleCollection,
  readExtendedColor,
  DEFAULT_STYLE,
  DEFAULT_STYLE_KEY,
} from './style.js';

const style = (overrides: Partial<Style> = {}): Style => ({
  ...DEFAULT_STYLE,
  ...overrides,
});

suite('computeColorKey', () => {
  test('returns `_` for null', () => {
    assert.equal(computeColorKey(null), '_');
  });

  test('returns palette key for a numeric colour', () => {
    assert.equal(computeColorKey(9), 'p9');
    assert.equal(computeColorKey(200), 'p200');
  });

  test('returns rgb key for a tuple colour', () => {
    assert.equal(computeColorKey([10, 20, 30]), 'r10,20,30');
  });

  test('distinguishes palette index from rgb', () => {
    assert.notEqual(computeColorKey(5), computeColorKey([5, 5, 5]));
  });
});

suite('computeStyleKey', () => {
  test('produces the documented default key', () => {
    assert.equal(computeStyleKey(DEFAULT_STYLE), '00000000|_|_');
    assert.equal(DEFAULT_STYLE_KEY, '00000000|_|_');
  });

  test('encodes each boolean attribute positionally', () => {
    assert.equal(computeStyleKey(style({ bold: true })), '10000000|_|_');
    assert.equal(
      computeStyleKey(style({ strikethrough: true })),
      '00000001|_|_',
    );
  });

  test('encodes foreground and background', () => {
    assert.equal(
      computeStyleKey(style({ foreground: 1, background: [1, 2, 3] })),
      '00000000|p1|r1,2,3',
    );
  });

  test('equal styles produce equal keys', () => {
    assert.equal(
      computeStyleKey(style({ bold: true, foreground: 4 })),
      computeStyleKey(style({ bold: true, foreground: 4 })),
    );
  });

  test('differing styles produce differing keys', () => {
    assert.notEqual(
      computeStyleKey(style({ bold: true })),
      computeStyleKey(style({ italic: true })),
    );
  });
});

suite('readExtendedColor', () => {
  test('reads a palette colour (mode 5)', () => {
    assert.deepEqual(readExtendedColor(['38', '5', '200'], 0), [200, 2]);
  });

  test('reads an rgb colour (mode 2), skipping the colour space', () => {
    assert.deepEqual(readExtendedColor(['38', '2', '0', '10', '20', '30'], 0), [
      [10, 20, 30],
      5,
    ]);
  });

  test('honours the given index offset', () => {
    assert.deepEqual(readExtendedColor(['1', '38', '5', '9'], 1), [9, 2]);
  });

  test('returns null for an unknown mode', () => {
    assert.deepEqual(readExtendedColor(['38', '1'], 0), [null, 0]);
  });

  test('returns null when palette value is missing', () => {
    assert.deepEqual(readExtendedColor(['38', '5'], 0), [null, 0]);
  });

  test('returns null when an rgb component is missing', () => {
    assert.deepEqual(readExtendedColor(['38', '2', '0', '10', '20'], 0), [
      null,
      0,
    ]);
  });
});

suite('createStyleCollection', () => {
  test('fills with the given style reference', () => {
    const value = style({ bold: true });
    const col = createStyleCollection(3, value);
    assert.lengthOf(col, 3);
    assert.isTrue(col.every((entry) => entry === value));
  });

  test('returns an empty array for zero length', () => {
    assert.deepEqual(createStyleCollection(0, DEFAULT_STYLE), []);
  });
});

suite('computeStyleForParams', () => {
  test('returns the default style reference for empty params', () => {
    assert.equal(
      computeStyleForParams(style({ bold: true }), []),
      DEFAULT_STYLE,
    );
  });

  test('treats `0` as a reset', () => {
    const result = computeStyleForParams(style({ bold: true, foreground: 1 }), [
      '0',
    ]);
    assert.deepEqual(result, DEFAULT_STYLE);
  });

  test('treats an empty-string param as `0`', () => {
    const result = computeStyleForParams(style({ italic: true }), ['']);
    assert.deepEqual(result, DEFAULT_STYLE);
  });

  test.each([
    { param: '1', key: 'bold' },
    { param: '2', key: 'dim' },
    { param: '3', key: 'italic' },
    { param: '4', key: 'underline' },
    { param: '5', key: 'blink' },
    { param: '7', key: 'inverse' },
    { param: '8', key: 'hidden' },
    { param: '9', key: 'strikethrough' },
  ] as const)('enables $key via param $param', ({ param, key }) => {
    const result = computeStyleForParams(DEFAULT_STYLE, [param]);
    assert.deepEqual(result, style({ [key]: true }));
  });

  test.each([
    { param: '22', key: 'bold' },
    { param: '23', key: 'italic' },
    { param: '24', key: 'underline' },
    { param: '25', key: 'blink' },
    { param: '27', key: 'inverse' },
    { param: '28', key: 'hidden' },
    { param: '29', key: 'strikethrough' },
  ] as const)('disables $key via param $param', ({ param, key }) => {
    const result = computeStyleForParams(style({ [key]: true }), [param]);
    assert.deepEqual(result, DEFAULT_STYLE);
  });

  test('param 22 clears both bold and dim', () => {
    const result = computeStyleForParams(style({ bold: true, dim: true }), [
      '22',
    ]);
    assert.deepEqual(result, DEFAULT_STYLE);
  });

  test('sets a basic foreground colour', () => {
    assert.deepEqual(
      computeStyleForParams(DEFAULT_STYLE, ['31']),
      style({ foreground: 1 }),
    );
  });

  test('sets a basic background colour', () => {
    assert.deepEqual(
      computeStyleForParams(DEFAULT_STYLE, ['41']),
      style({ background: 1 }),
    );
  });

  test('sets a bright foreground colour', () => {
    assert.deepEqual(
      computeStyleForParams(DEFAULT_STYLE, ['91']),
      style({ foreground: 9 }),
    );
  });

  test('sets a bright background colour', () => {
    assert.deepEqual(
      computeStyleForParams(DEFAULT_STYLE, ['101']),
      style({ background: 9 }),
    );
  });

  test('resets foreground with 39 and background with 49', () => {
    const start = style({ foreground: 1, background: 2 });
    assert.deepEqual(
      computeStyleForParams(start, ['39']),
      style({ background: 2 }),
    );
    assert.deepEqual(
      computeStyleForParams(start, ['49']),
      style({ foreground: 1 }),
    );
  });

  test('sets a 256-colour foreground', () => {
    assert.deepEqual(
      computeStyleForParams(DEFAULT_STYLE, ['38', '5', '200']),
      style({ foreground: 200 }),
    );
  });

  test('sets a truecolor background', () => {
    assert.deepEqual(
      computeStyleForParams(DEFAULT_STYLE, ['48', '2', '0', '10', '20', '30']),
      style({ background: [10, 20, 30] }),
    );
  });

  test('applies multiple params in order', () => {
    const result = computeStyleForParams(DEFAULT_STYLE, ['1', '31', '4']);
    assert.deepEqual(
      result,
      style({ bold: true, underline: true, foreground: 1 }),
    );
  });

  test('advances past consumed extended-colour params', () => {
    // bold, truecolor fg, then underline trailing the colour
    const result = computeStyleForParams(DEFAULT_STYLE, [
      '1',
      '38',
      '2',
      '0',
      '1',
      '2',
      '3',
      '4',
    ]);
    assert.deepEqual(
      result,
      style({ bold: true, underline: true, foreground: [1, 2, 3] }),
    );
  });

  test('ignores unknown params', () => {
    assert.deepEqual(
      computeStyleForParams(style({ bold: true }), ['99']),
      style({ bold: true }),
    );
  });

  test('does not mutate the input style', () => {
    const input = style({ bold: true });
    const snapshot = computeStyleKey(input);
    computeStyleForParams(input, ['31', '4']);
    assert.equal(computeStyleKey(input), snapshot);
  });
});
