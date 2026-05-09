<p align="center">
  <img src="images/logo.webp" alt="ansivision" width="480" />
</p>

# ansivision

Renders terminal output (i.e. strings containing ANSI codes) into a "rendered"
representation, containing each visual frame which would have been displayed.

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

## License

MIT
