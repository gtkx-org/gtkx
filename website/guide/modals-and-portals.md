---
title: "Modals and Portals"
description: "Render dialogs, windows, and children outside their JSX parent."
---

# Modals and Portals

Portals move widgets to another native container without moving them out of their React context, state, or lifecycle.

```tsx
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
import { createPortal } from "@gtkx/react";
import { useState } from "react";

const StatusArea = () => {
    const [target, setTarget] = useState<Gtk.Box | null>(null);

    return (
        <>
            <GtkBox ref={setTarget} />
            {target && createPortal(<GtkLabel label="Synced" />, target)}
        </>
    );
};
```

Capture the target in state so the portal renders once it exists. `rootElement` from `@gtkx/react` is the top-level target for children without a GTK parent. See the [`createPortal` reference](/reference/@gtkx/react/index/variables/createPortal) for its signature.

## Windows and dialogs

Window and `AdwDialog` elements present on mount and close on unmount, so render them conditionally. A `GtkApplicationWindow` must have an application ancestor. Set `transientFor` when a secondary window belongs to another window, and make `onCloseRequest` update the state that mounted it.

```tsx
import { AdwAlertDialog } from "@gtkx/jsx/adw";

const Confirm = ({ onResponse }: { onResponse: (id: string) => void }) => (
    <AdwAlertDialog
        heading="Delete task?"
        defaultResponse="cancel"
        closeResponse="cancel"
        responses={[
            { id: "cancel", label: "Cancel" },
            { id: "delete", label: "Delete" },
        ]}
        onResponse={onResponse}
    />
);
```

Use children for an alert dialog's extra content. More specialized Adwaita dialogs keep their own child layout. `canClose={false}` and `onCloseAttempt` intercept user dismissal; unmounting always closes the dialog.

`useParentWindow()` finds the nearest window in the React tree, including through portals. See the [generated element reference](/reference/) for dialog-specific props and signals.
