---
title: "JSX Elements"
description: "How GTKX JSX elements map props, signals, notifications, child slots and refs to the native API."
---

# JSX Elements

Codegen generates a JSX element for each GObject class in the configured libraries, named after its GLib type, such as `<GtkButton>` or `<AdwHeaderBar>`. This page describes how element props map to the native API. [Components](/v2/guide/components) covers the higher-level components built on them.

## The JSX prop model

Generated elements follow the native API with GTKX naming conventions. This header bar toggles a search entry:

```tsx
import type * as Gtk from "@gtkx/gi/gtk";
import { AdwHeaderBar, AdwToolbarView } from "@gtkx/jsx/adw";
import { GtkButton, GtkSearchEntry, GtkToggleButton } from "@gtkx/jsx/gtk";
import { useRef, useState } from "react";

export const SearchPane = () => {
    const [searching, setSearching] = useState(false);
    const entry = useRef<Gtk.SearchEntry>(null);

    return (
        <AdwToolbarView
            top={
                <AdwHeaderBar
                    start={
                        <GtkToggleButton
                            iconName="system-search-symbolic"
                            active={searching}
                            onNotifyActive={(active) => setSearching(active)}
                        />
                    }
                    end={
                        <GtkButton
                            label="Focus"
                            onClicked={() => entry.current?.grabFocus()}
                        />
                    }
                />
            }
        >
            <GtkSearchEntry
                ref={entry}
                sensitive={searching}
                onSearchChanged={(self) => console.log(self.getText())}
            />
        </AdwToolbarView>
    );
};
```

- Properties use camelCase, such as `showTitleButtons`.
- Signals use handler props, such as `onClicked`. GTKX passes the emitting object after the signal arguments.
- Property notifications use `onNotifyX`, receiving the new value and the emitting object.
- Object properties that accept elements can be expressed as JSX, with GTKX managing their lifetime. This includes construct-only ones, such as `userContentManager={<WebKitUserContentManager onScriptMessageReceived={...} />}` on a `WebKitWebView`: GTKX builds the prop's element first and passes its object when it constructs the parent, so the element must stay the same while the parent is mounted.
- Elements that show one child, such as `GtkScrolledWindow`, `AdwClamp`, window content or `AdwToolbarView` content, show the last one passed. Development builds warn when such an element holds more than one visible child; wrap them in a `GtkBox`.
- Child slots that no property backs are props named after their GtkBuilder child type, such as `start` and `end` on a header bar or `top` and `bottom` on a toolbar view.
- Refs expose the corresponding GI instance for imperative APIs.

Handlers don't report what GTKX writes for you. Writing a prop doesn't call that property's `onNotifyX` handler, and signal handlers such as `onChanged`, `onRowSelected` or `onClosePage` stay quiet while a commit changes props or children.

Properties the widget changes in reaction still notify. When adding or removing children changes a property, such as the selected page after the selected tab is removed, its `onNotifyX` handler runs once the commit and its layout effects have finished, with the value at that point. The handler doesn't run when:

- The commit writes that property itself, as a controlled `visibleChildName` does.
- The property ends at the value its prop asks for, as a `GtkDropDown`'s `selected={0}` does once its model is placed.
- The property ends at the value it had before the children changed.

A prop the element does not have, such as a typo, a C-style name like `margin_top` or a prop from another toolkit, throws an error that names the element and, where it can, the closest prop it does have.

Create objects and place children with JSX rather than through refs, so GTKX manages their lifetime. The [generated element reference](/v2/guide/configuration-and-codegen#generating-element-reference-docs) shows the exact props, slots, and signals for each configured library.

### Member names

Native methods keep their generated camelCase names, even when a name overlaps a GTKX signal or property helper. For example, `Gio.Socket.connect` connects the socket; use `GObject.signalConnect` to connect one of its signals. When a method has the same name as a property, read and write the property with `GObject.getProperty` and `GObject.setProperty` from `@gtkx/gi/gobject`. Both take the camelCase property name and type the value from the object's properties.
