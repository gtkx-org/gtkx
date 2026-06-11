# Portals

`createPortal` renders a component into a different GTK container, outside the normal component tree, while keeping it inside the same React tree for state and context.

Dialogs do not need portals: `Adw.Dialog` components take a `parent` prop naming the window they are presented against, window components take the regular `transientFor` property prop, and neither attaches to the surrounding widget regardless of where it renders.

## createPortal

Render a component as a child of another widget — for example, into a container captured from a different part of the tree:

```tsx
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
import { createPortal } from "@gtkx/react";
import { useState } from "react";

const Status = ({ bar }: { bar: Gtk.Box | null }) => {
    const [message] = useState("Ready");
    return bar && createPortal(<GtkLabel label={message} />, bar);
};

const App = () => {
    const [bar, setBar] = useState<Gtk.Box | null>(null);
    return (
        <>
            <GtkBox ref={setBar} />
            <Status bar={bar} />
        </>
    );
};
```

The portaled content participates in React state, context, and event handling exactly as if it were rendered in place; only its GTK parent differs.
