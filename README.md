<p align="center">
  <img src="images/logo.webp" alt="ansivision" width="480" />
</p>

# ansivision

Renders terminal output (i.e. strings containing ANSI codes) into a "rendered"
representation, containing each visual frame which would have been displayed.

##  Why?

When working with terminal applications, it can be useful to visualize the output
as it would appear in a terminal, especially when testing. This library provides
a way to render ANSI strings into their visual representation, allowing you to
assert on the rendered output in tests or visualize it in other contexts.

A few examples of use cases include:

- Testing the output of a CLI by comparing the rendered frames to
  snapshots (as opposed to testing raw ANSI strings which can be difficult
  to read and maintain).
- Visualizing the output of a terminal application in a web interface or other
  non-terminal environment.
- Debugging terminal applications by inspecting the rendered output.

## Installation

```bash
npm install ansivision
```

## Usage

```ts
import { renderString } from "ansivision";

const input = "\x1b[31mHello\x1b[0m World";
const rendered = await renderString(input);

for (const frame of rendered) {
  // will render frame 1 which is "Hello World"
  console.log(frame);
}
```

## Usage in tests

Using `renderStringToFrames` to assert on the visual output of a child
process with vitest:

```ts
import { test, expect } from "vitest";
import { renderStringToFrames } from "ansivision";
import { x } from "tinyexec";

test("renders expected output", async () => {
  const result = await x('my-command', []);

  const frames = await renderStringToFrames(result.stdout);

  expect(frames).toMatchSnapshot();
});
```

> [!NOTE]
> Many terminal applications will detect if they are running in a non-interactive environment (e.g. a child process) and disable ANSI codes. To ensure that the output contains ANSI codes, you may need to set the `FORCE_COLOR` environment variable to `true` or use a tool to emulate a terminal environment.

## License

MIT
