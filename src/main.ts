import { Renderer } from './renderer.js';
import { RenderStream } from './render-stream.js';

export async function renderString(input: string): Promise<Renderer> {
  return Renderer.fromString(input);
}

export async function renderStringToFrames(input: string): Promise<string[]> {
  const renderer = await renderString(input);
  return renderer.frames;
}

export { Renderer, RenderStream };
