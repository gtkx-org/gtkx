---
sidebar_position: 6
---

# Portals

Portals let you render React children into a different part of the GTK widget tree. This is useful for dialogs, additional windows, and content that should render outside the parent hierarchy.

## API

```typescript
import { createPortal } from '@gtkx/react';

createPortal(
    children: ReactNode,
    container?: Gtk.Widget,
    key?: string | null
): ReactPortal
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `children` | `ReactNode` | React elements to render |
| `container` | `Gtk.Widget` | Target widget (optional, defaults to app root) |
| `key` | `string \| null` | React key for the portal |

## Root-Level Portals

Without a container, content renders at the application root level as a sibling to your main window:

```tsx
import { createPortal, GtkApplicationWindow, GtkWindow, GtkButton, quit } from '@gtkx/react';
import { useState } from 'react';

function App() {
    const [showWindow, setShowWindow] = useState(false);

    return (
        <GtkApplicationWindow title="Main" onCloseRequest={quit}>
            <GtkButton
                label="Open Window"
                onClicked={() => setShowWindow(true)}
            />
            {showWindow && createPortal(
                <GtkWindow
                    title="Secondary"
                    defaultWidth={400}
                    defaultHeight={300}
                    onCloseRequest={() => {
                        setShowWindow(false);
                        return true;
                    }}
                >
                    This is a secondary window
                </GtkWindow>
            )}
        </GtkApplicationWindow>
    );
}
```

The secondary window renders as a peer to the main window, not nested inside it. GTK automatically sets up the transient relationship.

## Container Portals

Render into a specific widget by passing a container reference:

```tsx
import { createPortal, GtkBox, GtkButton, GtkLabel } from '@gtkx/react';
import { useState, useRef } from 'react';
import * as Gtk from '@gtkx/ffi/gtk';

function App() {
    const targetRef = useRef<Gtk.Box>(null);
    const [showContent, setShowContent] = useState(false);

    return (
        <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
            <GtkBox ref={targetRef}>
                Target area:
            </GtkBox>
            <GtkBox>
                <GtkButton
                    label="Toggle"
                    onClicked={() => setShowContent(!showContent)}
                />
                {showContent && targetRef.current && createPortal(
                    <GtkLabel label="Portaled content" />,
                    targetRef.current
                )}
            </GtkBox>
        </GtkBox>
    );
}
```

Content appears in the target box even though the portal call is in the source box.

## How Portals Work

1. **Without container**: Content renders at the application root
2. **With container**: Content appends to the specified widget
3. **React context preserved**: Context providers work through portals
4. **Automatic cleanup**: Content removes when the portal unmounts

## Use Cases

### Modal Dialogs

Render dialogs outside the main window:

```tsx
const [showAbout, setShowAbout] = useState(false);

{showAbout && createPortal(
    <GtkAboutDialog
        programName="My App"
        version="1.0.0"
        onCloseRequest={() => {
            setShowAbout(false);
            return true;
        }}
    />
)}
```

### Multiple Windows

Create additional application windows:

```tsx
const [windows, setWindows] = useState<string[]>([]);

{windows.map(id => createPortal(
    <GtkWindow
        key={id}
        title={`Window ${id}`}
        onCloseRequest={() => {
            setWindows(w => w.filter(x => x !== id));
            return true;
        }}
    >
        Content for window {id}
    </GtkWindow>,
    undefined,
    id
))}
```

### Dynamic Content Placement

Move content between containers:

```tsx
const sidebarRef = useRef<Gtk.Box>(null);
const mainRef = useRef<Gtk.Box>(null);
const [inSidebar, setInSidebar] = useState(true);

const content = <GtkLabel label="Movable content" />;

{inSidebar && sidebarRef.current && createPortal(content, sidebarRef.current)}
{!inSidebar && mainRef.current && createPortal(content, mainRef.current)}
```

### Tooltips and Overlays

Render tooltips or popups at the root level to avoid clipping:

```tsx
const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);

{tooltip && createPortal(
    <GtkWindow
        decorated={false}
        defaultWidth={200}
        defaultHeight={50}
    >
        Tooltip content
    </GtkWindow>
)}
```

## Portal vs Slot

Portals and slots serve different purposes:

| Feature | Portal | Slot |
|---------|--------|------|
| Purpose | Render in different container | Set widget property |
| Target | Any widget or root | Parent widget's property |
| Method | `append()` to container | Property setter (e.g., `setTitlebar()`) |
| Use case | Dialogs, windows | Titlebars, custom children |

```tsx
// Slot: sets the titlebar property
<GtkWindow>
    <Slot id="titlebar">
        <GtkHeaderBar />
    </Slot>
</GtkWindow>

// Portal: renders in a different container
{createPortal(<Content />, otherContainer)}
```

## Tips

1. **Conditional rendering**: Only create portals when the content should exist
2. **Null checks**: Verify container refs before using them
3. **Keys for lists**: Provide unique keys when rendering multiple portals
4. **State ownership**: State lives in the React tree, not the GTK tree
5. **Cleanup**: Portal content automatically unmounts with the portal

## Window Transient Relationships

When portaling a `GtkWindow` as a child of another window, GTK sets up a transient relationship automatically. The child window:
- Stays above its parent
- Centers on the parent by default
- Closes when the parent closes

```tsx
<GtkApplicationWindow title="Parent">
    {showChild && createPortal(
        <GtkWindow title="Child">
            This window is transient to the parent
        </GtkWindow>
    )}
</GtkApplicationWindow>
```
