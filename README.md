<p align="center">
  <img src="https://raw.githubusercontent.com/eugeniodepalo/gtkx/HEAD/logo.svg" alt="GTKX Logo" width="128" height="128">
</p>

<h1 align="center">GTKX</h1>

<p align="center">
  <strong>Build native GTK4 desktop apps with React</strong>
</p>

<p align="center">
  <a href="https://eugeniodepalo.github.io/gtkx">Documentation</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#examples">Examples</a> ·
  <a href="#contributing">Contributing</a>
</p>

---

GTKX lets you build native Linux desktop applications using React and TypeScript. Write familiar React code that renders as native GTK4 widgets—no Electron, no web views.

## Features

- **React** — Hooks, state, props, and components you already know
- **HMR** — Edit code and see changes instantly via Vite
- **Native** — Direct FFI bindings to GTK4 via Rust and libffi
- **CLI** — `npx @gtkx/cli@latest create` scaffolds a ready-to-go project
- **CSS-in-JS** — Emotion-style `css` template literals for GTK styling
- **Testing** — Testing Library-style `screen`, `userEvent`, and queries

## Quick Start

```bash
npx @gtkx/cli@latest create my-app
cd my-app
npm run dev
```

Edit your code and see changes instantly—no restart needed.

### Example

```tsx
import { render, GtkApplicationWindow, GtkBox, GtkButton, quit } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";
import { useState } from "react";

const App = () => {
  const [count, setCount] = useState(0);

  return (
    <GtkApplicationWindow title="Counter" onCloseRequest={quit}>
      <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
        {`Count: ${count}`}
        <GtkButton label="Increment" onClicked={() => setCount((c) => c + 1)} />
      </GtkBox>
    </GtkApplicationWindow>
  );
};

render(<App />, "org.example.Counter");
```

## Styling

```tsx
import { css } from "@gtkx/css";
import { GtkButton } from "@gtkx/react";

const primary = css`
  padding: 16px 32px;
  border-radius: 24px;
  background: linear-gradient(135deg, #3584e4, #9141ac);
  color: white;
`;

<GtkButton label="Click me" cssClasses={[primary]} />;
```

## Testing

```tsx
import { cleanup, render, screen, userEvent } from "@gtkx/testing";
import * as Gtk from "@gtkx/ffi/gtk";

afterEach(() => cleanup());

test("increments count", async () => {
  await render(<App />);

  const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
    name: "Increment",
  });

  await userEvent.click(button);

  await screen.findByText("Count: 1");
});
```

## Requirements

- Node.js 20+ (Deno support experimental)
- GTK4 Runtime (`gtk4` on Fedora, `libgtk-4-1` on Ubuntu)

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

- [Report a bug](https://github.com/eugeniodepalo/gtkx/issues/new?template=bug_report.md)
- [Request a feature](https://github.com/eugeniodepalo/gtkx/issues/new?template=feature_request.md)

## License

[MPL-2.0](LICENSE)
