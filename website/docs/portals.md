# Portals and Dialogs

GTKX supports rendering content outside the normal component tree using portals, most commonly for dialogs and popovers that need to be children of the active window.

## createPortal

Render a component into a different container—typically used for dialogs that need to appear as children of the active window:

```tsx
import { createPortal, useApplication, useProperty } from "@gtkx/react";
import { useState } from "react";

const MyComponent = () => {
    const app = useApplication();
    const [open, setOpen] = useState(false);
    const activeWindow = useProperty(app, "activeWindow");

    return (
        <>
            <GtkButton label="Show Dialog" onClicked={() => setOpen(true)} />
            {open && activeWindow && createPortal(<GtkAboutDialog programName="My App" />, activeWindow)}
        </>
    );
};
```
