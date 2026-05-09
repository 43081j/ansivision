import { Renderer } from './renderer.js';
import { suite, assert, test } from 'vitest';
import type { CODE } from '@ansi-tools/parser';

const text = (raw: string): CODE => ({ type: 'TEXT', raw, pos: 0 });

const cursorMoveX = (n: number): CODE => ({
  type: 'CSI',
  command: n >= 0 ? 'C' : 'D',
  raw: '',
  params: [Math.abs(n).toString()],
  pos: 0,
});

const cursorMoveY = (n: number): CODE => ({
  type: 'CSI',
  command: n >= 0 ? 'B' : 'A',
  raw: '',
  params: [Math.abs(n).toString()],
  pos: 0,
});

const saveCursor = (): CODE => ({
  type: 'ESC',
  command: '8',
  raw: '',
  params: [],
  pos: 0,
});
const restoreCursor = (): CODE => ({
  type: 'ESC',
  command: '7',
  raw: '',
  params: [],
  pos: 0,
});
const cursorHide = (): CODE => ({
  type: 'ESC',
  command: '?25l',
  raw: '',
  params: [],
  pos: 0,
});
const cursorShow = (): CODE => ({
  type: 'ESC',
  command: '?25h',
  raw: '',
  params: [],
  pos: 0,
});

type EraseMode = 'toEnd' | 'toStart' | 'all';
const ERASE_FLAG: Record<EraseMode, string> = {
  toEnd: '0',
  toStart: '1',
  all: '2',
};

const eraseScreen = (mode: EraseMode): CODE => ({
  type: 'CSI',
  command: 'J',
  raw: '',
  params: [ERASE_FLAG[mode]],
  pos: 0,
});
const eraseLine = (mode: EraseMode): CODE => ({
  type: 'CSI',
  command: 'K',
  raw: '',
  params: [ERASE_FLAG[mode]],
  pos: 0,
});
const scrollUp = (n: number): CODE => ({
  type: 'CSI',
  command: 'S',
  raw: '',
  params: [n.toString()],
  pos: 0,
});
const scrollDown = (n: number): CODE => ({
  type: 'CSI',
  command: 'T',
  raw: '',
  params: [n.toString()],
  pos: 0,
});

const cursorNextLine = (n: number): CODE => ({
  type: 'CSI',
  command: 'E',
  raw: '',
  params: [n.toString()],
  pos: 0,
});
const cursorPrevLine = (n: number): CODE => ({
  type: 'CSI',
  command: 'F',
  raw: '',
  params: [n.toString()],
  pos: 0,
});
const cursorColumn = (x: number): CODE => ({
  type: 'CSI',
  command: 'G',
  raw: '',
  params: [(x + 1).toString()],
  pos: 0,
});

const cursorTo = (x?: number, y?: number): CODE => ({
  type: 'CSI',
  command: 'H',
  raw: '',
  params: [
    x === undefined ? '' : (x + 1).toString(),
    y === undefined ? '' : (y + 1).toString(),
  ],
  pos: 0,
});

suite('Renderer', () => {
  suite('fromString', () => {
    test('parses plain text', () => {
      const renderer = Renderer.fromString('hello');
      assert.deepEqual(renderer.frames, ['hello']);
    });

    test('parses empty string', () => {
      const renderer = Renderer.fromString('');
      assert.deepEqual(renderer.frames, ['']);
    });

    test('parses text with newlines', () => {
      const renderer = Renderer.fromString('hello\nworld');
      assert.deepEqual(renderer.frames, ['hello\nworld']);
    });

    test('parses erase screen sequence', () => {
      const renderer = Renderer.fromString('hello\x1b[2J');
      assert.deepEqual(renderer.frames, ['hello', '']);
    });

    test('parses cursor movement sequence', () => {
      const renderer = Renderer.fromString('hello\x1b[3D!');
      assert.deepEqual(renderer.frames, ['he!lo']);
    });

    test('parses cursor position sequence', () => {
      const renderer = Renderer.fromString('hello\nworld\x1b[1;1H!');
      assert.deepEqual(renderer.frames, ['!ello\nworld']);
    });

    test('swallows title sequence', () => {
      const renderer = Renderer.fromString('a\x1bktitle text\x1b\\b');
      assert.deepEqual(renderer.frames, ['ab']);
    });

    test('swallows DCS payload', () => {
      const renderer = Renderer.fromString('a\x1bP1;2;3payload\x1b\\b');
      assert.deepEqual(renderer.frames, ['ab']);
    });

    test('swallows APC payload', () => {
      const renderer = Renderer.fromString('a\x1b_some apc data\x1b\\b');
      assert.deepEqual(renderer.frames, ['ab']);
    });

    test('does not affect text following a completed title sequence', () => {
      const renderer = Renderer.fromString(
        'before\x1bkignored\x1b\\after\nnext',
      );
      assert.deepEqual(renderer.frames, ['beforeafter\nnext']);
    });
  });

  suite('currentFrame', () => {
    test('defaults to the first frame', () => {
      const renderer = new Renderer();
      renderer.write(text('a'));
      renderer.write(eraseScreen('all'));
      renderer.write(text('b'));
      assert.equal(renderer.currentFrame, 'a');
    });

    test('reflects the active frame after navigation', () => {
      const renderer = new Renderer();
      renderer.write(text('a'));
      renderer.write(eraseScreen('all'));
      renderer.write(text('b'));
      renderer.nextFrame();
      assert.equal(renderer.currentFrame, 'b');
    });

    test('returns empty string when there are no frames', () => {
      const renderer = new Renderer();
      assert.equal(renderer.currentFrame, '');
    });
  });

  suite('frames', () => {
    test('includes the current buffer as the last frame', () => {
      const renderer = new Renderer();
      renderer.write(text('hello'));
      assert.deepEqual(renderer.frames, ['hello']);
    });

    test('accumulates frames as the buffer is erased', () => {
      const renderer = new Renderer();
      renderer.write(text('a'));
      renderer.write(eraseScreen('all'));
      renderer.write(text('b'));
      renderer.write(eraseScreen('all'));
      renderer.write(text('c'));
      assert.deepEqual(renderer.frames, ['a', 'b', 'c']);
    });
  });

  suite('cursor', () => {
    test('starts at the origin', () => {
      const renderer = new Renderer();
      assert.deepEqual(renderer.cursor, [0, 0]);
    });

    test('reflects position after writes', () => {
      const renderer = new Renderer();
      renderer.write(text('hello\nworld'));
      assert.deepEqual(renderer.cursor, [5, 1]);
    });
  });

  suite('line', () => {
    test('returns the line at the cursor', () => {
      const renderer = new Renderer();
      renderer.write(text('hello\nworld'));
      assert.equal(renderer.line, 'world');
    });

    test('reflects the line above after moving up', () => {
      const renderer = new Renderer();
      renderer.write(text('hello\nworld'));
      renderer.write(cursorMoveY(-1));
      assert.equal(renderer.line, 'hello');
    });

    test('returns empty string when the buffer is empty', () => {
      const renderer = new Renderer();
      assert.equal(renderer.line, '');
    });
  });

  suite('stepFrame', () => {
    test('moves forward by delta', () => {
      const renderer = new Renderer();
      renderer.write(text('a'));
      renderer.write(eraseScreen('all'));
      renderer.write(text('b'));
      renderer.write(eraseScreen('all'));
      renderer.write(text('c'));
      renderer.stepFrame(2);
      assert.equal(renderer.currentFrame, 'c');
    });

    test('moves backward by negative delta', () => {
      const renderer = new Renderer();
      renderer.write(text('a'));
      renderer.write(eraseScreen('all'));
      renderer.write(text('b'));
      renderer.nextFrame();
      renderer.stepFrame(-1);
      assert.equal(renderer.currentFrame, 'a');
    });

    test('clamps at the last frame', () => {
      const renderer = new Renderer();
      renderer.write(text('a'));
      renderer.write(eraseScreen('all'));
      renderer.write(text('b'));
      renderer.stepFrame(99);
      assert.equal(renderer.currentFrame, 'b');
    });

    test('clamps at the first frame', () => {
      const renderer = new Renderer();
      renderer.write(text('a'));
      renderer.write(eraseScreen('all'));
      renderer.write(text('b'));
      renderer.stepFrame(-99);
      assert.equal(renderer.currentFrame, 'a');
    });
  });

  suite('nextFrame', () => {
    test('advances to the next frame', () => {
      const renderer = new Renderer();
      renderer.write(text('a'));
      renderer.write(eraseScreen('all'));
      renderer.write(text('b'));
      renderer.nextFrame();
      assert.equal(renderer.currentFrame, 'b');
    });

    test('clamps at the last frame', () => {
      const renderer = new Renderer();
      renderer.write(text('a'));
      renderer.write(eraseScreen('all'));
      renderer.write(text('b'));
      renderer.nextFrame();
      renderer.nextFrame();
      assert.equal(renderer.currentFrame, 'b');
    });
  });

  suite('previousFrame', () => {
    test('moves to the previous frame', () => {
      const renderer = new Renderer();
      renderer.write(text('a'));
      renderer.write(eraseScreen('all'));
      renderer.write(text('b'));
      renderer.nextFrame();
      renderer.previousFrame();
      assert.equal(renderer.currentFrame, 'a');
    });

    test('clamps at the first frame', () => {
      const renderer = new Renderer();
      renderer.write(text('a'));
      renderer.write(eraseScreen('all'));
      renderer.write(text('b'));
      renderer.previousFrame();
      assert.equal(renderer.currentFrame, 'a');
    });
  });

  suite('goToFrame', () => {
    test('jumps to the specified frame', () => {
      const renderer = new Renderer();
      renderer.write(text('a'));
      renderer.write(eraseScreen('all'));
      renderer.write(text('b'));
      renderer.write(eraseScreen('all'));
      renderer.write(text('c'));
      renderer.goToFrame(1);
      assert.equal(renderer.currentFrame, 'b');
    });

    test('clamps at the last frame', () => {
      const renderer = new Renderer();
      renderer.write(text('a'));
      renderer.write(eraseScreen('all'));
      renderer.write(text('b'));
      renderer.goToFrame(99);
      assert.equal(renderer.currentFrame, 'b');
    });

    test('clamps at the first frame', () => {
      const renderer = new Renderer();
      renderer.write(text('a'));
      renderer.write(eraseScreen('all'));
      renderer.write(text('b'));
      renderer.goToFrame(-99);
      assert.equal(renderer.currentFrame, 'a');
    });
  });

  suite('write (text)', () => {
    test('can write text', () => {
      const renderer = new Renderer();
      renderer.write(text('hello'));
      assert.deepEqual(renderer.frames, ['hello']);
    });

    test('can write multiple lines', () => {
      const renderer = new Renderer();
      renderer.write(text('hello\nworld'));
      assert.deepEqual(renderer.frames, ['hello\nworld']);
    });

    test('carriage return moves cursor to start of line', () => {
      const renderer = new Renderer();
      renderer.write(text('hello\rJ'));
      assert.deepEqual(renderer.frames, ['Jello']);
      assert.deepEqual(renderer.cursor, [1, 0]);
    });

    test('carriage return without follow-up text leaves buffer intact', () => {
      const renderer = new Renderer();
      renderer.write(text('hello\r'));
      assert.deepEqual(renderer.frames, ['hello']);
      assert.deepEqual(renderer.cursor, [0, 0]);
    });

    test('backspace moves cursor back without erasing', () => {
      const renderer = new Renderer();
      renderer.write(text('hello\b'));
      assert.deepEqual(renderer.frames, ['hello']);
      assert.deepEqual(renderer.cursor, [4, 0]);
    });

    test('backspace then write overwrites the previous character', () => {
      const renderer = new Renderer();
      renderer.write(text('hello\b\bLP'));
      assert.deepEqual(renderer.frames, ['helLP']);
      assert.deepEqual(renderer.cursor, [5, 0]);
    });

    test('backspace at start of line is a no-op', () => {
      const renderer = new Renderer();
      renderer.write(text('\bhi'));
      assert.deepEqual(renderer.frames, ['hi']);
      assert.deepEqual(renderer.cursor, [2, 0]);
    });

    test('crlf moves cursor to start of next line', () => {
      const renderer = new Renderer();
      renderer.write(text('hello\r\nworld'));
      assert.deepEqual(renderer.frames, ['hello\nworld']);
      assert.deepEqual(renderer.cursor, [5, 1]);
    });

    test('lone newline preserves cursor column (no implicit cr)', () => {
      const renderer = new Renderer();
      renderer.write(text('hello\nworld'));
      assert.deepEqual(renderer.cursor, [5, 1]);
    });

    test('simulates typing with backspace corrections', () => {
      const renderer = new Renderer();
      renderer.write(text('x\by\bzoo'));
      assert.deepEqual(renderer.frames, ['zoo']);
      assert.deepEqual(renderer.cursor, [3, 0]);
    });

    test('overwrites with carriage return and partial text', () => {
      const renderer = new Renderer();
      renderer.write(text('hello world\rgoodbye'));
      assert.deepEqual(renderer.frames, ['goodbyeorld']);
      assert.deepEqual(renderer.cursor, [7, 0]);
    });
  });

  suite('write (erase)', () => {
    test('can erase screen', () => {
      const renderer = new Renderer();
      renderer.write(text('hello'));
      renderer.write(eraseScreen('all'));
      assert.deepEqual(renderer.frames, ['hello', '']);
    });

    test('can erase to end of screen', () => {
      const renderer = new Renderer();
      renderer.write(text('hello\nworld'));
      renderer.write(cursorMoveY(-1));
      renderer.write(eraseScreen('toEnd'));
      assert.deepEqual(renderer.frames, ['hello\nworld', 'hello']);
    });

    test('can erase to start of screen', () => {
      const renderer = new Renderer();
      renderer.write(text('hello\nworld'));
      renderer.write(cursorMoveY(-1));
      renderer.write(eraseScreen('toStart'));
      assert.deepEqual(renderer.frames, ['hello\nworld', '     \nworld']);
    });

    test('can erase line', () => {
      const renderer = new Renderer();
      renderer.write(text('hello'));
      renderer.write(eraseLine('all'));
      assert.deepEqual(renderer.frames, ['hello', '']);
    });

    test('can erase to end of line', () => {
      const renderer = new Renderer();
      renderer.write(text('hello james'));
      renderer.write(cursorMoveX(-' james'.length));
      renderer.write(eraseLine('toEnd'));
      assert.deepEqual(renderer.frames, ['hello james', 'hello']);
    });

    test('can erase to start of line', () => {
      const renderer = new Renderer();
      renderer.write(text('hello james'));
      renderer.write(cursorMoveX(-6));
      renderer.write(eraseLine('toStart'));
      assert.deepEqual(renderer.frames, ['hello james', '      james']);
    });
  });

  suite('write (cursor)', () => {
    test('cursor hide does nothing', () => {
      const renderer = new Renderer();
      renderer.write(cursorHide());
      assert.deepEqual(renderer.frames, ['']);
      assert.deepEqual(renderer.cursor, [0, 0]);
    });

    test('cursor show does nothing', () => {
      const renderer = new Renderer();
      renderer.write(cursorShow());
      assert.deepEqual(renderer.frames, ['']);
      assert.deepEqual(renderer.cursor, [0, 0]);
    });

    test('scroll up does nothing', () => {
      const renderer = new Renderer();
      renderer.write(text('hello'));
      renderer.write(scrollUp(1));
      assert.deepEqual(renderer.frames, ['hello']);
      assert.deepEqual(renderer.cursor, [5, 0]);
    });

    test('scroll down does nothing', () => {
      const renderer = new Renderer();
      renderer.write(text('hello'));
      renderer.write(scrollDown(1));
      assert.deepEqual(renderer.frames, ['hello']);
      assert.deepEqual(renderer.cursor, [5, 0]);
    });

    test('can move cursor to position', () => {
      const renderer = new Renderer();
      renderer.write(text('hello\nworld'));
      renderer.write(cursorTo(2, 0));
      assert.deepEqual(renderer.cursor, [2, 0]);
    });

    test('cursor to clamps y', () => {
      const renderer = new Renderer();
      renderer.write(text('hello\nworld'));
      renderer.write(cursorTo(0, 10));
      assert.deepEqual(renderer.cursor, [0, 1]);
    });

    test('cursor to clamps x', () => {
      const renderer = new Renderer();
      renderer.write(text('hi\nworld'));
      renderer.write(cursorTo(10, 0));
      assert.deepEqual(renderer.cursor, [2, 0]);
    });

    test('cursor to with only x param keeps y at 0', () => {
      const renderer = new Renderer();
      renderer.write(text('hello\nworld'));
      renderer.write(cursorMoveY(1));
      renderer.write(cursorTo(3));
      assert.deepEqual(renderer.cursor, [3, 0]);
    });

    test('cursor up moves up', () => {
      const renderer = new Renderer();
      renderer.write(text('a\nb\nc'));
      renderer.write(cursorMoveY(-1));
      assert.deepEqual(renderer.cursor, [1, 1]);
    });

    test('cursor up clamps at top', () => {
      const renderer = new Renderer();
      renderer.write(text('a\nb\nc'));
      renderer.write(cursorMoveY(-99));
      assert.deepEqual(renderer.cursor, [1, 0]);
    });

    test('cursor up at top is a no-op', () => {
      const renderer = new Renderer();
      renderer.write(text('a\nb\nc'));
      renderer.write(cursorMoveY(-2));
      renderer.write(cursorMoveY(-1));
      assert.deepEqual(renderer.cursor, [1, 0]);
    });

    test('cursor down moves down', () => {
      const renderer = new Renderer();
      renderer.write(text('a\nb\nc'));
      renderer.write(cursorMoveY(-2));
      renderer.write(cursorMoveY(1));
      assert.deepEqual(renderer.cursor, [1, 1]);
    });

    test('cursor down clamps at bottom', () => {
      const renderer = new Renderer();
      renderer.write(text('a\nb\nc'));
      renderer.write(cursorMoveY(-2));
      renderer.write(cursorMoveY(99));
      assert.deepEqual(renderer.cursor, [1, 2]);
    });

    test('cursor down at bottom is a no-op', () => {
      const renderer = new Renderer();
      renderer.write(text('a\nb\nc'));
      renderer.write(cursorMoveY(1));
      assert.deepEqual(renderer.cursor, [1, 2]);
    });

    test('cursor forward moves forward', () => {
      const renderer = new Renderer();
      renderer.write(text('hello'));
      renderer.write(cursorMoveX(-5));
      renderer.write(cursorMoveX(2));
      assert.deepEqual(renderer.cursor, [2, 0]);
    });

    test('cursor forward clamps at end of line', () => {
      const renderer = new Renderer();
      renderer.write(text('hello'));
      renderer.write(cursorMoveX(-5));
      renderer.write(cursorMoveX(99));
      assert.deepEqual(renderer.cursor, [5, 0]);
    });

    test('cursor forward at end of line is a no-op', () => {
      const renderer = new Renderer();
      renderer.write(text('hello'));
      renderer.write(cursorMoveX(1));
      assert.deepEqual(renderer.cursor, [5, 0]);
    });

    test('cursor backward moves backward', () => {
      const renderer = new Renderer();
      renderer.write(text('hello'));
      renderer.write(cursorMoveX(-2));
      assert.deepEqual(renderer.cursor, [3, 0]);
    });

    test('cursor backward clamps at start of line', () => {
      const renderer = new Renderer();
      renderer.write(text('hello'));
      renderer.write(cursorMoveX(-99));
      assert.deepEqual(renderer.cursor, [0, 0]);
    });

    test('cursor backward at start of line is a no-op', () => {
      const renderer = new Renderer();
      renderer.write(text('hello'));
      renderer.write(cursorMoveX(-5));
      renderer.write(cursorMoveX(-1));
      assert.deepEqual(renderer.cursor, [0, 0]);
    });

    test('cursor next line moves to start of line below', () => {
      const renderer = new Renderer();
      renderer.write(text('hello\nworld'));
      renderer.write(cursorMoveY(-1));
      renderer.write(cursorMoveX(2));
      renderer.write(cursorNextLine(1));
      assert.deepEqual(renderer.cursor, [0, 1]);
    });

    test('cursor next line clamps at bottom', () => {
      const renderer = new Renderer();
      renderer.write(text('a\nb\nc'));
      renderer.write(cursorMoveY(-2));
      renderer.write(cursorNextLine(99));
      assert.deepEqual(renderer.cursor, [0, 2]);
    });

    test('cursor next line at bottom is a no-op on row', () => {
      const renderer = new Renderer();
      renderer.write(text('hello'));
      renderer.write(cursorNextLine(1));
      assert.deepEqual(renderer.cursor, [0, 0]);
    });

    test('cursor prev line moves to start of line above', () => {
      const renderer = new Renderer();
      renderer.write(text('hello\nworld'));
      renderer.write(cursorPrevLine(1));
      assert.deepEqual(renderer.cursor, [0, 0]);
    });

    test('cursor prev line clamps at top', () => {
      const renderer = new Renderer();
      renderer.write(text('a\nb\nc'));
      renderer.write(cursorPrevLine(99));
      assert.deepEqual(renderer.cursor, [0, 0]);
    });

    test('cursor prev line at top is a no-op on row', () => {
      const renderer = new Renderer();
      renderer.write(text('hello'));
      renderer.write(cursorMoveX(-3));
      renderer.write(cursorPrevLine(1));
      assert.deepEqual(renderer.cursor, [0, 0]);
    });

    test('cursor column moves to column', () => {
      const renderer = new Renderer();
      renderer.write(text('hello'));
      renderer.write(cursorColumn(2));
      assert.deepEqual(renderer.cursor, [2, 0]);
    });

    test('cursor column clamps at end of line', () => {
      const renderer = new Renderer();
      renderer.write(text('hi'));
      renderer.write(cursorColumn(99));
      assert.deepEqual(renderer.cursor, [2, 0]);
    });

    test('cursor column to 0 goes to start of line', () => {
      const renderer = new Renderer();
      renderer.write(text('hello'));
      renderer.write(cursorColumn(0));
      assert.deepEqual(renderer.cursor, [0, 0]);
    });

    test('can save and restore cursor', () => {
      const renderer = new Renderer();
      renderer.write(text('hello\nworld'));
      renderer.write(cursorMoveX(-3));
      renderer.write(saveCursor());
      renderer.write(cursorMoveY(-1));
      renderer.write(cursorMoveX(1));
      assert.deepEqual(renderer.cursor, [3, 0]);
      renderer.write(restoreCursor());
      assert.deepEqual(renderer.cursor, [2, 1]);
    });
  });
});
