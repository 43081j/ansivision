import { renderString, renderStringToFrames } from './main.js';
import { Renderer } from './renderer.js';
import { suite, assert, test } from 'vitest';

suite('main', () => {
  suite('renderString', () => {
    test('returns a Renderer', async () => {
      const renderer = await renderString('hello');
      assert.instanceOf(renderer, Renderer);
    });

    test('parses plain text', async () => {
      const renderer = await renderString('hello');
      assert.deepEqual(renderer.frames, ['hello']);
    });

    test('parses ansi escape sequences', async () => {
      const renderer = await renderString('hello\x1b[2J');
      assert.deepEqual(renderer.frames, ['hello', '']);
    });

    test('handles an empty string', async () => {
      const renderer = await renderString('');
      assert.deepEqual(renderer.frames, ['']);
    });
  });

  suite('renderStringToFrames', () => {
    test('returns frames for plain text', async () => {
      const frames = await renderStringToFrames('hello');
      assert.deepEqual(frames, ['hello']);
    });

    test('returns frames split by erase sequences', async () => {
      const frames = await renderStringToFrames('a\x1b[2Jb\x1b[2Jc');
      assert.deepEqual(frames, ['a', 'b', 'c']);
    });

    test('returns a single empty frame for an empty string', async () => {
      const frames = await renderStringToFrames('');
      assert.deepEqual(frames, ['']);
    });
  });
});
