# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

GTKX is a framework for building GTK4 desktop applications using React and TypeScript. It bridges the GTK4 C library with React's component model through FFI, enabling developers to write native Linux desktop applications using familiar React patterns.

## Package Structure

This is a pnpm monorepo:

- **`packages/native`**: Rust-based Neon module providing FFI bindings to GTK
- **`packages/gir`**: GIR (GObject Introspection) XML parser for GTK API definitions
- **`packages/ffi`**: Generated TypeScript FFI bindings for GTK libraries
- **`packages/react`**: React integration layer with custom reconciler and JSX types
- **`packages/css`**: Emotion-style CSS-in-JS for styling GTK widgets
- **`website`**: Docusaurus documentation site
- **`examples/`**: Demo applications

## Build Commands

```bash
pnpm install
pnpm build                                   # Full build (uses turbo)
turbo build --force                          # Force rebuild (bypass cache)
cd examples/gtk4-demo && turbo start         # Run demo
pnpm knip                                    # Find unused code
pnpm test                                    # Run tests
```

**Important:** Always use `turbo` for build commands in this monorepo. If you encounter stale cache issues after modifying codegen or generated files, either:
1. Use `turbo build --force` to bypass the cache, or
2. Delete `*.tsbuildinfo` files: `find . -name '*.tsbuildinfo' -delete`

## Working with Generated Code

- **Never edit `src/generated/` directories** - they are regenerated on build
- To modify generated code, edit the generators:
  - `packages/ffi/src/codegen/ffi-generator.ts` for FFI bindings
  - `packages/react/src/codegen/jsx-generator.ts` for JSX types
- GIR files are synced to `/girs/` from `/usr/share/gir-1.0`

## Usage Examples

### Basic Application

```tsx
import { ApplicationWindow, Box, Button, Label, quit, render } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";

export const app = render(
    <ApplicationWindow title="My App" defaultWidth={400} defaultHeight={300} onCloseRequest={quit}>
        <Box valign={Gtk.Align.CENTER} halign={Gtk.Align.CENTER} spacing={12}>
            <Label.Root label="Hello, GTKX!" />
            <Button label="Click me" onClicked={() => console.log("Clicked!")} />
        </Box>
    </ApplicationWindow>,
    "com.example.myapp",
);
```

### Styling with CSS-in-JS

```tsx
import { css, cx, injectGlobal, keyframes } from "@gtkx/css";

injectGlobal`
    window { background: @theme_bg_color; }
`;

const fadeIn = keyframes`
    from { opacity: 0; }
    to { opacity: 1; }
`;

const buttonStyle = css`
    padding: 16px 32px;
    border-radius: 12px;
    font-weight: bold;
    animation: ${fadeIn} 0.3s ease-in;
`;

// Combine custom styles with GTK built-in classes
<Button cssClasses={[cx(buttonStyle, "suggested-action")]} label="Styled Button" />

// GTK built-in classes: suggested-action, destructive-action, flat, card,
// title-1 through title-4, heading, dim-label, monospace, accent
```

### State Management with React Hooks

```tsx
const Counter = () => {
    const [count, setCount] = useState(0);
    return (
        <Button label={`Clicked ${count} times`} onClicked={() => setCount(c => c + 1)} />
    );
};
```

### Widgets with Named Slots

Some widgets use `.Root` with slot children for complex layouts:

```tsx
<HeaderBar.Root>
    <HeaderBar.TitleWidget>
        <Label.Root label="App Title" />
    </HeaderBar.TitleWidget>
</HeaderBar.Root>

<Frame.Root>
    <Frame.LabelWidget>
        <Label.Root label="Section Title" />
    </Frame.LabelWidget>
    <Frame.Child>
        <Box>Content here</Box>
    </Frame.Child>
</Frame.Root>

<CenterBox.Root hexpand>
    <CenterBox.StartWidget><Button label="Left" /></CenterBox.StartWidget>
    <CenterBox.CenterWidget><Label.Root label="Center" /></CenterBox.CenterWidget>
    <CenterBox.EndWidget><Button label="Right" /></CenterBox.EndWidget>
</CenterBox.Root>

<Paned.Root wideHandle vexpand>
    <Paned.StartChild><Box>Left pane</Box></Paned.StartChild>
    <Paned.EndChild><Box>Right pane</Box></Paned.EndChild>
</Paned.Root>

<Expander.Root label="Click to expand">
    <Expander.Child>
        <Box>Hidden content</Box>
    </Expander.Child>
</Expander.Root>
```

### Form Inputs

```tsx
<Entry placeholderText="Type something..." />
<SearchEntry placeholderText="Search..." />
<PasswordEntry placeholderText="Password..." />

<CheckButton.Root label="Enable feature" active={checked} onToggled={() => setChecked(c => !c)} />

// Switch requires returning true from onStateSet to accept the state change
<Switch active={switchOn} onStateSet={(self, state) => { setSwitchOn(state); return true; }} />

// SpinButton with Adjustment (args: value, lower, upper, stepIncrement, pageIncrement, pageSize)
const adjustment = useMemo(() => new Gtk.Adjustment(50, 0, 100, 1, 10, 0), []);
<SpinButton adjustment={adjustment} onValueChanged={(self) => setValue(self.getValue())} />
<Scale hexpand drawValue adjustment={adjustment} onValueChanged={(self) => setValue(self.getValue())} />
```

### Lists and Collections

```tsx
<ListBox selectionMode={Gtk.SelectionMode.SINGLE}>
    <ListBoxRow><Label.Root label="Row 1" /></ListBoxRow>
    <ListBoxRow><Label.Root label="Row 2" /></ListBoxRow>
</ListBox>

<DropDown.Root
    itemLabel={(item) => item.label}
    onSelectionChanged={(item, index) => setSelected(item)}
>
    {options.map(opt => <DropDown.Item key={opt.id} item={opt} />)}
</DropDown.Root>

<ListView.Root renderItem={(item) => {
    if (!item) return new Gtk.Box(); // Setup phase
    return new Gtk.Label({ label: item.name });
}}>
    {items.map(item => <ListView.Item item={item} key={item.id} />)}
</ListView.Root>

<FlowBox maxChildrenPerLine={5} selectionMode={Gtk.SelectionMode.SINGLE}>
    {items.map(item => <FlowBoxChild key={item.id}>{/* content */}</FlowBoxChild>)}
</FlowBox>
```

### Async Dialogs (Promise-based)

```tsx
import { app } from "./index.js"; // Import the exported app instance

const showAlertDialog = async () => {
    const dialog = new Gtk.AlertDialog();
    dialog.setMessage("Confirm Action");
    dialog.setDetail("Are you sure you want to proceed?");
    dialog.setButtons(["Cancel", "OK"]);
    dialog.setCancelButton(0);
    dialog.setDefaultButton(1);

    try {
        const response = await dialog.choose(app.getActiveWindow());
        console.log(response === 1 ? "Confirmed" : "Cancelled");
    } catch {
        console.log("Dismissed");
    }
};

const openFile = async () => {
    const dialog = new Gtk.FileDialog();
    dialog.setTitle("Open File");
    try {
        const file = await dialog.open(app.getActiveWindow());
        console.log(file.getPath());
    } catch {
        console.log("Cancelled");
    }
};

const chooseColor = async () => {
    const dialog = new Gtk.ColorDialog();
    dialog.setWithAlpha(true);
    try {
        const rgba = await dialog.chooseRgba(app.getActiveWindow());
        console.log(`rgba(${rgba.red * 255}, ${rgba.green * 255}, ${rgba.blue * 255}, ${rgba.alpha})`);
    } catch {
        console.log("Cancelled");
    }
};
```

### AboutDialog (React Component)

```tsx
import { createPortal } from "@gtkx/react";

const [showAbout, setShowAbout] = useState(false);

<Button label="About" onClicked={() => setShowAbout(true)} />
{showAbout && createPortal(
    <AboutDialog
        programName="My App"
        version="1.0.0"
        comments="Description here"
        licenseType={Gtk.License.MIT_X11}
        authors={["Author Name"]}
        onCloseRequest={() => { setShowAbout(false); return false; }}
    />
)}
```

### Popovers and Menus

```tsx
<MenuButton.Root label="Open Menu">
    <MenuButton.Popover>
        <Popover.Root>
            <Popover.Child>
                <Box spacing={5}>
                    <Button label="Action 1" onClicked={() => {}} />
                    <Button label="Action 2" onClicked={() => {}} />
                </Box>
            </Popover.Child>
        </Popover.Root>
    </MenuButton.Popover>
</MenuButton.Root>
```

### Animations and Transitions

```tsx
<Revealer revealChild={revealed} transitionType={Gtk.RevealerTransitionType.SLIDE_DOWN}>
    <Label.Root label="Revealed content" />
</Revealer>
```

### Grid Layout

```tsx
<Grid.Root rowSpacing={10} columnSpacing={10}>
    <Grid.Child column={0} row={0}><Button label="Top Left" /></Grid.Child>
    <Grid.Child column={1} row={0}><Button label="Top Right" /></Grid.Child>
    <Grid.Child column={0} row={1} columnSpan={2}>
        <Button label="Spans 2 columns" hexpand />
    </Grid.Child>
</Grid.Root>
```

## Key Patterns

- **App instance**: Export `const app = render(...)` for access to `app.getActiveWindow()`
- **Event handlers**: Use `on{EventName}` pattern (e.g., `onClicked`, `onToggled`, `onCloseRequest`)
- **GTK enums**: Import from `@gtkx/ffi/gtk` (e.g., `Gtk.Align.CENTER`, `Gtk.Orientation.VERTICAL`)
- **Text children**: Automatically wrapped in `<Label>` widgets
- **Property names**: Use camelCase (GTK's snake_case is converted)
- **Switch handlers**: Must return `true` from `onStateSet`
- **Window close**: Return `false` from `onCloseRequest` to allow closing

### Common Widget Props

```tsx
// Layout
hexpand={true} vexpand={true}
halign={Gtk.Align.CENTER} valign={Gtk.Align.START}
marginStart={10} marginEnd={10} marginTop={10} marginBottom={10}

// Styling
cssClasses={["suggested-action", customStyle]}

// Box/Container
orientation={Gtk.Orientation.VERTICAL} spacing={12}

// Window
title="Window Title" defaultWidth={800} defaultHeight={600}
```

### Error Handling

Native GTK/GLib errors are thrown as `NativeError`, which wraps GLib's `GError`:

```tsx
import { NativeError } from "@gtkx/ffi";

try {
    keyFile.loadFromFile("/nonexistent", GLib.KeyFileFlags.NONE);
} catch (err) {
    if (err instanceof NativeError) {
        console.error(err.message);  // Human-readable error message
        console.error(err.domain);   // GLib error domain (GQuark)
        console.error(err.code);     // Error code within domain
    }
}
```

## Coding Guidelines

**Functional Programming:**
- Prefer functional programming over imperative/OOP
- Only use classes when encapsulation is absolutely necessary
- Prefer pure functions, immutable data, and composition

**Code Cleanliness:**
- Zero tolerance for unused variables, imports, or exports
- Run `pnpm knip` regularly to detect dead code
- Prefix intentionally unused parameters with `_`

**Modern TypeScript:**
- Use all ESNext features freely (Node.js 20+)
- Use `import` with `.js` extensions (ESM)
- Prefer `??` over `||`, use optional chaining (`?.`)
- Avoid `as` casts - use type guards and runtime checks instead
- Define named types rather than inline types

**File Naming:**
- All files use dash-case: `my-component.ts`
- Never use camelCase for filenames

**Documentation:**
- No inline comments - code should be self-documenting
- Use TSDoc only for public API that needs explanation

**Architecture:**
- Maximize code reuse through composition
- Keep functions small and focused
- No dependency injection unless absolutely necessary

**Documentation Files:**
- Never create README.md or other markdown files unless explicitly requested
