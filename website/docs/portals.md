---
sidebar_position: 6
sidebar_label: Portals
---

# Portals

Portals let you render React children into a different part of the GTK widget tree. This is essential for dialogs, popovers, and overlay content that should render outside their parent container.

## Basic Usage

```tsx
import { createPortal, Box, Label } from "@gtkx/react";
import { Orientation } from "@gtkx/ffi/gtk";

const MyComponent = () => (
  <Box orientation={Orientation.VERTICAL} spacing={8}>
    <Label.Root label="This is in the box" />

    {createPortal(
      <Label.Root label="This renders at the root level" />
    )}
  </Box>
);
```

## API

```typescript
createPortal(
  children: ReactNode,
  container?: Widget,
  key?: string | null
): ReactPortal
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `children` | `ReactNode` | The React elements to render |
| `container` | `Widget` | Optional. The GTK widget to render into. Defaults to application root |
| `key` | `string \| null` | Optional. React key for the portal |

## Root-Level Portals

When called without a container, `createPortal` renders at the application root level. This is the most common use case for dialogs:

```tsx
import { createPortal, ApplicationWindow, Button, AboutDialog, quit } from "@gtkx/react";
import { useState } from "react";

const App = () => {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <ApplicationWindow title="My App" onCloseRequest={quit}>
      <Button label="Show Dialog" onClicked={() => setShowDialog(true)} />

      {showDialog && createPortal(
        <AboutDialog
          programName="My App"
          onCloseRequest={() => {
            setShowDialog(false);
            return false;
          }}
        />
      )}
    </ApplicationWindow>
  );
};
```

The dialog renders as a sibling to the main window, not nested inside it.

## Container Portals

You can also render into a specific widget container using refs:

```tsx
import { createPortal, createRef, Box, Label, Button } from "@gtkx/react";
import type { Box as BoxType } from "@gtkx/ffi/gtk";
import { Orientation } from "@gtkx/ffi/gtk";
import { useState } from "react";

const App = () => {
  const targetRef = createRef<BoxType>();
  const [showInTarget, setShowInTarget] = useState(false);

  return (
    <Box orientation={Orientation.VERTICAL} spacing={12}>
      <Button
        label="Toggle Portal"
        onClicked={() => setShowInTarget(!showInTarget)}
      />

      <Box orientation={Orientation.HORIZONTAL} spacing={12}>
        <Box orientation={Orientation.VERTICAL} spacing={8} ref={targetRef} cssClasses={["card"]} hexpand>
          <Label.Root label="Target container" />
          {/* Portal content appears here */}
        </Box>

        <Box orientation={Orientation.VERTICAL} spacing={8} cssClasses={["card"]} hexpand>
          <Label.Root label="Source container" />
          {showInTarget && createPortal(
            <Label.Root label="I'm rendered in the target!" />,
            targetRef.current ?? undefined
          )}
        </Box>
      </Box>
    </Box>
  );
};
```

## How Portals Work

1. **Without container**: Content attaches to `Gtk.Application.getDefault()`, rendering at the top level of the application
2. **With container**: Content attaches to the specified widget as a child
3. **React events bubble**: Events still bubble through the React tree, not the GTK tree
4. **Context preserved**: React context passes through portals normally

## Use Cases

### Dialogs

The primary use case — render dialogs outside the main window hierarchy:

```tsx
{showConfirm && createPortal(
  <Dialog title="Confirm" modal>
    <Button label="OK" onClicked={handleConfirm} />
  </Dialog>
)}
```

### Popovers

Render content that overlays other widgets:

```tsx
{showPopover && createPortal(
  <Popover.Root pointing={buttonRef.current}>
    <Popover.Child>
      <Label.Root label="Popover content" />
    </Popover.Child>
  </Popover.Root>
)}
```

### Dynamic Content Injection

Move content between containers based on state:

```tsx
const [inSidebar, setInSidebar] = useState(true);

const content = <Label.Root label="Movable content" />;

// Renders in sidebar or main area based on state
{inSidebar
  ? createPortal(content, sidebarRef.current)
  : createPortal(content, mainRef.current)
}
```

## Portal vs Slot

Don't confuse portals with slots:

- **Slots** (`Widget.SlotName`) — Place content in a widget's named property (e.g., `setChild()`)
- **Portals** (`createPortal`) — Render content in a different widget container

```tsx
// Slot: Places content in Expander's "child" property
<Expander.Root>
  <Expander.Child>
    <Content />
  </Expander.Child>
</Expander.Root>

// Portal: Renders content in a completely different container
{createPortal(<Content />, otherContainer)}
```

## Tips

1. **Always conditionally render portal content** — Don't create portals for content that shouldn't exist yet
2. **Clean up on unmount** — Portal content is automatically removed when the portal unmounts
3. **Use keys for lists of portals** — If rendering multiple portals dynamically, provide unique keys
4. **State lives in React** — Even though content renders elsewhere in GTK, state management follows React's rules
