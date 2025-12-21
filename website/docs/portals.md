---
sidebar_position: 6
sidebar_label: Portals
---

# Portals

Portals let you render React children into a different part of the GTK widget tree. This is essential for dialogs, additional windows, and content that should render outside their parent container.

## Basic Usage

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { createPortal, GtkBox, GtkLabel } from "@gtkx/react";

const MyComponent = () => (
  <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
    This is in the box
    {createPortal("This renders at the root level")}
  </GtkBox>
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

| Parameter   | Type             | Description                                                           |
| ----------- | ---------------- | --------------------------------------------------------------------- |
| `children`  | `ReactNode`      | The React elements to render                                          |
| `container` | `Widget`         | Optional. The GTK widget to render into. Defaults to application root |
| `key`       | `string \| null` | Optional. React key for the portal                                    |

## Root-Level Portals

When called without a container, `createPortal` renders at the application root level. This is the most common use case for dialogs:

```tsx
import {
  createPortal,
  GtkApplicationWindow,
  GtkButton,
  GtkAboutDialog,
  quit,
} from "@gtkx/react";
import { useState } from "react";

const App = () => {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <GtkApplicationWindow title="My App" onCloseRequest={quit}>
      <GtkButton label="Show Dialog" onClicked={() => setShowDialog(true)} />

      {showDialog &&
        createPortal(
          <GtkAboutDialog
            programName="My App"
            onCloseRequest={() => {
              setShowDialog(false);
              return false;
            }}
          />
        )}
    </GtkApplicationWindow>
  );
};
```

The dialog renders as a sibling to the main window, not nested inside it.

## Container Portals

You can also render into a specific widget container using refs:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { createPortal, GtkBox, GtkLabel, GtkButton } from "@gtkx/react";
import { useState, useRef } from "react";

const App = () => {
  const targetRef = useRef<Gtk.Box | null>(null);
  const [showInTarget, setShowInTarget] = useState(false);

  return (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
      <GtkButton
        label="Toggle Portal"
        onClicked={() => setShowInTarget(!showInTarget)}
      />

      <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
        <GtkBox
          orientation={Gtk.Orientation.VERTICAL}
          spacing={8}
          ref={targetRef}
          cssClasses={["card"]}
          hexpand
        >
          Target container
          {/* Portal content appears here */}
        </GtkBox>

        <GtkBox
          orientation={Gtk.Orientation.VERTICAL}
          spacing={8}
          cssClasses={["card"]}
          hexpand
        >
          Source container
          {showInTarget &&
            createPortal(
              "I'm rendered in the target!",
              targetRef.current ?? undefined
            )}
        </GtkBox>
      </GtkBox>
    </GtkBox>
  );
};
```

## How Portals Work

1. **Without container**: Content renders at the root level, as siblings to your main window (windows/dialogs are associated with the GTK Application)
2. **With container**: Content attaches to the specified widget as a child
3. **React events bubble**: Events still bubble through the React tree, not the GTK tree
4. **Context preserved**: React context passes through portals normally

## Use Cases

### Dialogs

The primary use case — render dialogs outside the main window hierarchy:

```tsx
{
  showConfirm &&
    createPortal(
      <GtkDialog title="Confirm" modal>
        <GtkButton label="OK" onClicked={handleConfirm} />
      </GtkDialog>
    );
}
```

### Multiple Windows

Render additional windows alongside your main window:

```tsx
{
  showSecondWindow &&
    createPortal(
      <GtkApplicationWindow title="Second Window" defaultWidth={400} defaultHeight={300}>
        This is a second window
      </GtkApplicationWindow>
    );
}
```

### Dynamic Content Injection

Move content between containers based on state:

```tsx
const [inSidebar, setInSidebar] = useState(true);

const content = "Movable content";

// Renders in sidebar or main area based on state
{
  inSidebar
    ? createPortal(content, sidebarRef.current)
    : createPortal(content, mainRef.current);
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
</Expander.Root>;

// Portal: Renders content in a completely different container
{
  createPortal(<Content />, otherContainer);
}
```

## Tips

1. **Always conditionally render portal content** — Don't create portals for content that shouldn't exist yet
2. **Clean up on unmount** — Portal content is automatically removed when the portal unmounts
3. **Use keys for lists of portals** — If rendering multiple portals dynamically, provide unique keys
4. **State lives in React** — Even though content renders elsewhere in GTK, state management follows React's rules
