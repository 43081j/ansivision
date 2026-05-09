import { RenderStream } from './render-stream.js';
import { suite, assert, test } from 'vitest';

suite('RenderStream', () => {
  test('should render ANSI codes to a Renderer', () => {
    const renderStream = new RenderStream();
    renderStream.write('\x1b[31m'); // Set text color to red
    renderStream.write('Hello, World!');
    renderStream.write('\x1b[0m'); // Reset styles

    const renderer = renderStream.renderer;
    assert.deepEqual(renderer.frames, ['Hello, World!']);
  });
});
