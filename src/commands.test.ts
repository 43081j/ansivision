import type { CODE } from '@ansi-tools/parser';
import { isCursorCommand, isEraseCommand } from './commands.js';
import { suite, assert, test } from 'vitest';

suite('isCursorCommand', () => {
  test.each([
    { type: 'CSI', command: 'H', raw: '', params: [], pos: 0 },
    { type: 'CSI', command: 'A', raw: '', params: [], pos: 0 },
    { type: 'CSI', command: 'B', raw: '', params: [], pos: 0 },
    { type: 'CSI', command: 'C', raw: '', params: [], pos: 0 },
    { type: 'CSI', command: 'D', raw: '', params: [], pos: 0 },
    { type: 'CSI', command: 'E', raw: '', params: [], pos: 0 },
    { type: 'CSI', command: 'F', raw: '', params: [], pos: 0 },
    { type: 'CSI', command: 'G', raw: '', params: [], pos: 0 },
    { type: 'CSI', command: 'T', raw: '', params: [], pos: 0 },
    { type: 'CSI', command: 'S', raw: '', params: [], pos: 0 },
    { type: 'ESC', command: '7', raw: '', params: [], pos: 0 },
    { type: 'ESC', command: '8', raw: '', params: [], pos: 0 },
    { type: 'DEC', command: 'l', raw: '', params: [], pos: 0 },
    { type: 'DEC', command: 'h', raw: '', params: [], pos: 0 },
  ] as CODE[])('should return true for cursor command %o', (code) => {
    assert.isTrue(isCursorCommand(code));
  });

  test.each([
    // erase in display
    { type: 'CSI', command: 'J', raw: '', params: [], pos: 0 },
    // erase in line
    { type: 'CSI', command: 'K', raw: '', params: [], pos: 0 },
    // style
    { type: 'CSI', command: 'm', raw: '', params: [], pos: 0 },
    // full reset
    { type: 'ESC', command: 'c', raw: '', params: [], pos: 0 },
    // index (scroll)
    { type: 'ESC', command: 'D', raw: '', params: [], pos: 0 },
    // unknown DEC
    { type: 'DEC', command: 'p', raw: '', params: [], pos: 0 },
    // plain text
    { type: 'TEXT', raw: 'hello', pos: 0 },
  ] as CODE[])('should return false for non-cursor command %o', (code) => {
    assert.isFalse(isCursorCommand(code));
  });
});

suite('isEraseCommand', () => {
  test.each([
    { type: 'CSI', command: 'J', raw: '', params: [], pos: 0 },
    { type: 'CSI', command: 'K', raw: '', params: [], pos: 0 },
    { type: 'ESC', command: 'c', raw: '', params: [], pos: 0 },
  ] as CODE[])('should return true for erase command %o', (code) => {
    assert.isTrue(isEraseCommand(code));
  });

  test.each([
    // cursor home
    { type: 'CSI', command: 'H', raw: '', params: [], pos: 0 },
    // style
    { type: 'CSI', command: 'm', raw: '', params: [], pos: 0 },
    // save cursor
    { type: 'ESC', command: '7', raw: '', params: [], pos: 0 },
    // DEC private mode
    { type: 'DEC', command: 'h', raw: '', params: [], pos: 0 },
    // plain text
    { type: 'TEXT', raw: 'hello', pos: 0 },
  ] as CODE[])('should return false for non-erase command %o', (code) => {
    assert.isFalse(isEraseCommand(code));
  });
});
