import { CODE, CONTROL_CODE, parse } from '@ansi-tools/parser';
import { isCursorCommand, isEraseCommand } from './commands.js';

export interface Frame {
  contents: string;
  title: string;
}

export class Renderer implements Iterable<string> {
  #buffer: string[] = [];
  #cursorX: number = 0;
  #cursorY: number = 0;
  #frames: Frame[] = [];
  #savedCursor?: [number, number];
  #suppressNextPush: boolean = false;
  #syncMode: boolean = false;
  #currentFrame: number = 0;
  #skipUntilStringTerminator: boolean = false;
  #capturingTitle: boolean = false;
  #title: string = '';

  static fromString(input: string): Renderer {
    const ast = parse(input);
    const renderer = new Renderer();

    for (const code of ast) {
      renderer.write(code);
    }

    return renderer;
  }

  get currentFrame(): string {
    return this.frames[this.#currentFrame] ?? '';
  }

  get frames(): string[] {
    return this.frameObjects.map((frame) => frame.contents);
  }

  get currentTitle(): string {
    return this.frameObjects[this.#currentFrame]?.title ?? '';
  }

  get frameObjects(): Frame[] {
    return [
      ...this.#frames,
      { contents: this.#buffer.join('\n'), title: this.#title },
    ];
  }

  get cursor(): [x: number, y: number] {
    return [this.#cursorX, this.#cursorY];
  }

  get line(): string {
    return this.#buffer[this.#cursorY] || '';
  }

  stepFrame(delta: number): void {
    const newFrame = Math.max(
      0,
      Math.min(this.frames.length - 1, this.#currentFrame + delta),
    );
    this.#currentFrame = newFrame;
  }

  nextFrame(): void {
    this.stepFrame(1);
  }

  previousFrame(): void {
    this.stepFrame(-1);
  }

  goToFrame(index: number): void {
    this.#currentFrame = Math.max(0, Math.min(this.frames.length - 1, index));
  }

  #saveCursor(): void {
    this.#savedCursor = [this.#cursorX, this.#cursorY];
  }

  #restoreCursor(): void {
    if (this.#savedCursor) {
      this.#cursorTo(this.#savedCursor[0], this.#savedCursor[1]);
    }
  }

  #cursorUp(count: number): void {
    this.#cursorY = Math.max(0, this.#cursorY - count);
  }

  #cursorDown(count: number): void {
    this.#cursorY = Math.min(this.#buffer.length - 1, this.#cursorY + count);
  }

  #cursorDownAppend(): void {
    const newY = this.#cursorY + 1;
    while (this.#buffer.length <= newY) {
      this.#buffer.push('');
    }
    this.#cursorY = newY;
  }

  #cursorTo(x: number, y: number): void {
    this.#cursorY = Math.max(0, Math.min(this.#buffer.length - 1, y));
    this.#cursorX = Math.max(0, Math.min(this.line.length, x));
  }

  #cursorForward(count: number): void {
    this.#cursorX = Math.min(this.line.length, this.#cursorX + count);
  }

  #cursorBackward(count: number): void {
    this.#cursorX = Math.max(0, this.#cursorX - count);
  }

  #writeChunk(part: string): void {
    if (!part) {
      return;
    }
    const bufferIndex = this.#cursorY;
    const existingLine = this.#buffer[bufferIndex];

    if (existingLine !== undefined) {
      const prefix = existingLine.slice(0, this.#cursorX);
      const suffix = existingLine.slice(this.#cursorX + part.length);
      this.#buffer[bufferIndex] = prefix + part + suffix;
      this.#cursorForward(part.length);
    } else {
      this.#buffer.push(part);
      this.#cursorTo(part.length, bufferIndex);
    }
  }

  #writeText(text: string): void {
    let chunk = '';

    for (let i = 0; i < text.length; i++) {
      const ch = text[i]!;

      if (ch === '\r' || ch === '\n' || ch === '\b') {
        this.#writeChunk(chunk);
        chunk = '';

        if (ch === '\r') {
          this.#cursorX = 0;
        } else if (ch === '\b') {
          this.#cursorBackward(1);
        } else {
          const newY = this.#cursorY + 1;
          while (this.#buffer.length <= newY) {
            this.#buffer.push('');
          }
          this.#cursorTo(this.#cursorX, newY);
        }
      } else {
        chunk += ch;
      }
    }

    this.#writeChunk(chunk);
  }

  #cursorByCommand(code: CONTROL_CODE): void {
    if (code.type === 'DEC' && (code.command === 'l' || code.command === 'h')) {
      if (code.params[0] === '2026') {
        if (code.command === 'h') {
          this.#syncMode = true;
        } else {
          this.#syncMode = false;
          this.#pushFrame();
        }
      }
      return;
    }
    if (code.type === 'CSI' && (code.command === 'T' || code.command === 'S')) {
      // Ignore scroll commands
      return;
    }
    if (code.type === 'ESC') {
      if (code.command === '7') {
        this.#saveCursor();
      } else if (code.command === '8') {
        this.#restoreCursor();
      } else if (code.command === 'D') {
        this.#cursorDownAppend();
      } else if (code.command === 'E') {
        this.#cursorX = 0;
        this.#cursorDownAppend();
      } else if (code.command === 'M') {
        this.#cursorUp(1);
      }
      return;
    }

    if (code.command === 'H') {
      this.#cursorTo(
        code.params[1] ? parseInt(code.params[1]) - 1 : 0,
        code.params[0] ? parseInt(code.params[0]) - 1 : 0,
      );
      return;
    }

    const multiplier = code.params[0] ? parseInt(code.params[0]) : 1;

    switch (code.command) {
      case 'A':
        this.#cursorUp(multiplier);
        break;
      case 'B':
        this.#cursorDown(multiplier);
        break;
      case 'C':
        this.#cursorForward(multiplier);
        break;
      case 'D':
        this.#cursorBackward(multiplier);
        break;
      case 'E':
        this.#cursorTo(0, this.#cursorY + multiplier);
        break;
      case 'F':
        this.#cursorTo(0, this.#cursorY - multiplier);
        break;
      case 'G':
        this.#cursorTo(multiplier - 1, this.#cursorY);
        break;
    }
  }

  #eraseAll(): void {
    this.#pushFrame();
    this.#buffer = [];
    this.#cursorTo(0, 0);
  }

  #pushFrame(): void {
    if (this.#suppressNextPush || this.#syncMode) {
      return;
    }
    this.#frames.push({
      contents: this.#buffer.join('\n'),
      title: this.#title,
    });
  }

  #eraseLine(): void {
    this.#pushFrame();
    this.#buffer[this.#cursorY] = '';
    this.#cursorTo(0, this.#cursorY);
  }

  #eraseToEndOfLine(): void {
    this.#pushFrame();
    const line = this.#buffer[this.#cursorY];

    if (line === undefined) {
      return;
    }

    this.#buffer[this.#cursorY] = line.slice(0, this.#cursorX);
  }

  #eraseToStartOfLine(): void {
    this.#pushFrame();
    const line = this.#buffer[this.#cursorY];

    if (line === undefined) {
      return;
    }

    const end = Math.min(this.#cursorX + 1, line.length);
    this.#buffer[this.#cursorY] = ' '.repeat(end) + line.slice(end);
  }

  #eraseToEnd(): void {
    this.#pushFrame();
    this.#suppressNextPush = true;
    this.#eraseToEndOfLine();
    this.#suppressNextPush = false;
    this.#buffer.splice(this.#cursorY + 1);
  }

  #eraseToStart(): void {
    this.#pushFrame();
    this.#suppressNextPush = true;
    this.#eraseToStartOfLine();
    this.#suppressNextPush = false;
    this.#buffer.splice(0, this.#cursorY);
    this.#cursorTo(this.#cursorX, 0);
  }

  #eraseByCommand(code: CONTROL_CODE): void {
    if (code.type === 'ESC' && code.command === 'c') {
      this.#eraseAll();
      return;
    }
    const flag = code.params[0] ? parseInt(code.params[0]) : 0;
    if (code.command === 'J') {
      switch (flag) {
        case 0:
          this.#eraseToEnd();
          break;
        case 1:
          this.#eraseToStart();
          break;
        case 2:
          this.#eraseAll();
          break;
      }
    } else if (code.command === 'K') {
      switch (flag) {
        case 0:
          this.#eraseToEndOfLine();
          break;
        case 1:
          this.#eraseToStartOfLine();
          break;
        case 2:
          this.#eraseLine();
          break;
      }
    }
  }

  write(code: CODE): void {
    if (this.#skipUntilStringTerminator) {
      if (code.type === 'ESC' && code.command === '\\') {
        this.#skipUntilStringTerminator = false;
        this.#capturingTitle = false;
      } else if (this.#capturingTitle && code.type === 'TEXT') {
        this.#title += code.raw;
      }
      return;
    }

    // Captures some special non-printed sequences
    // k = window title
    // P = device control string
    // X = start of string
    // ^ = privacy message
    // _ = application program command
    if (
      code.type === 'ESC' &&
      (code.command === 'k' ||
        code.command === 'P' ||
        code.command === 'X' ||
        code.command === '^' ||
        code.command === '_')
    ) {
      this.#skipUntilStringTerminator = true;
      if (code.command === 'k') {
        this.#capturingTitle = true;
        this.#title = '';
      }
      return;
    }

    if (isCursorCommand(code)) {
      this.#cursorByCommand(code);
    } else if (isEraseCommand(code)) {
      this.#eraseByCommand(code);
    } else if (code.type === 'TEXT') {
      this.#writeText(code.raw);
    }
  }

  [Symbol.iterator](): Iterator<string> {
    let index = 0;
    const frames = this.frames;

    return {
      next(): IteratorResult<string> {
        const frame = frames[index++];
        if (frame !== undefined) {
          return { value: frame, done: false };
        } else {
          return { value: '', done: true };
        }
      },
    };
  }
}
