# Adwaita

Libadwaita (Adw) is GNOME's design system library, providing modern widgets and styling for Linux desktop applications. GTKX includes full support for Adwaita components.

## Overview

Adwaita components are prefixed with `Adw` and provide:
- Modern GNOME visual design
- Responsive layouts
- Adaptive widgets that work on different screen sizes
- Consistent styling across GNOME applications

## Common Components

### AdwHeaderBar

Modern header bar with adaptive styling:

```tsx
import { AdwHeaderBar, GtkButton, GtkLabel, Slot } from "@gtkx/react";

<AdwHeaderBar>
    <Slot for={AdwHeaderBar} id="titleWidget">
        <GtkLabel label="My App" cssClasses={["title"]} />
    </Slot>

    <GtkButton iconName="open-menu-symbolic" cssClasses={["flat"]} />
</AdwHeaderBar>
```

### AdwViewStack / AdwViewSwitcher

Tab-like navigation between views:

```tsx
import { AdwViewStack, AdwViewStackPage, AdwViewSwitcher, GtkBox } from "@gtkx/react";
import { useState } from "react";

const TabbedView = () => {
    const [currentPage, setCurrentPage] = useState("home");

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <AdwViewSwitcher stack={currentPage} onStackChanged={setCurrentPage} />

            <AdwViewStack visibleChild={currentPage}>
                <AdwViewStackPage name="home" title="Home" iconName="go-home-symbolic">
                    Home content
                </AdwViewStackPage>
                <AdwViewStackPage name="settings" title="Settings" iconName="preferences-system-symbolic">
                    Settings content
                </AdwViewStackPage>
            </AdwViewStack>
        </GtkBox>
    );
};
```

### AdwActionRow

List row with title, subtitle, and optional widgets:

```tsx
import { AdwActionRow, GtkListBox, GtkSwitch, GtkButton } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";

<GtkListBox cssClasses={["boxed-list"]} selectionMode={Gtk.SelectionMode.NONE}>
    <AdwActionRow title="Dark Mode" subtitle="Use dark color scheme">
        <GtkSwitch valign={Gtk.Align.CENTER} />
    </AdwActionRow>

    <AdwActionRow title="Notifications" subtitle="Enable push notifications">
        <GtkSwitch valign={Gtk.Align.CENTER} active />
    </AdwActionRow>

    <AdwActionRow title="Account" subtitle="Manage your account settings" activatable>
        <GtkButton iconName="go-next-symbolic" cssClasses={["flat"]} valign={Gtk.Align.CENTER} />
    </AdwActionRow>
</GtkListBox>
```

### AdwExpanderRow

Expandable list row:

```tsx
import { AdwExpanderRow, AdwActionRow, GtkListBox } from "@gtkx/react";

<GtkListBox cssClasses={["boxed-list"]}>
    <AdwExpanderRow title="Advanced Settings" subtitle="Additional options">
        <AdwActionRow title="Option 1">
            <GtkSwitch />
        </AdwActionRow>
        <AdwActionRow title="Option 2">
            <GtkSwitch />
        </AdwActionRow>
    </AdwExpanderRow>
</GtkListBox>
```

### AdwPreferencesGroup

Group related settings with a header:

```tsx
import { AdwPreferencesGroup, AdwActionRow, GtkSwitch, GtkSpinButton } from "@gtkx/react";

<AdwPreferencesGroup title="Appearance" description="Customize the look and feel">
    <AdwActionRow title="Dark Mode">
        <GtkSwitch valign={Gtk.Align.CENTER} />
    </AdwActionRow>
    <AdwActionRow title="Font Size">
        <GtkSpinButton valign={Gtk.Align.CENTER} />
    </AdwActionRow>
</AdwPreferencesGroup>
```

### AdwClamp

Constrain content width for readability:

```tsx
import { AdwClamp, GtkBox } from "@gtkx/react";

<AdwClamp maximumSize={600} tighteningThreshold={400}>
    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
        This content is constrained to a readable width
        On wide screens, it won't stretch too far
    </GtkBox>
</AdwClamp>
```

### AdwToastOverlay

Show toast notifications:

```tsx
import { AdwToastOverlay, GtkButton, GtkBox } from "@gtkx/react";
import * as Adw from "@gtkx/ffi/adw";
import { useRef } from "react";

const ToastExample = () => {
    const overlayRef = useRef<Adw.ToastOverlay | null>(null);

    const showToast = () => {
        if (overlayRef.current) {
            const toast = new Adw.Toast({ title: "Action completed!" });
            toast.setTimeout(3);
            overlayRef.current.addToast(toast);
        }
    };

    return (
        <AdwToastOverlay ref={overlayRef}>
            <GtkBox orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER}>
                <GtkButton label="Show Toast" onClicked={showToast} />
            </GtkBox>
        </AdwToastOverlay>
    );
};
```

## CSS Classes

Adwaita provides many built-in CSS classes:

### Typography

```tsx
<GtkLabel cssClasses={["title-1"]} label="Large Title" />
<GtkLabel cssClasses={["title-2"]} label="Medium Title" />
<GtkLabel cssClasses={["title-3"]} label="Small Title" />
<GtkLabel cssClasses={["heading"]} label="Heading" />
<GtkLabel cssClasses={["body"]} label="Body text" />
<GtkLabel cssClasses={["caption"]} label="Caption" />
<GtkLabel cssClasses={["dim-label"]} label="Dimmed" />
<GtkLabel cssClasses={["numeric"]} label="12345" />
```

### Buttons

```tsx
<GtkButton cssClasses={["suggested-action"]} label="Primary" />
<GtkButton cssClasses={["destructive-action"]} label="Danger" />
<GtkButton cssClasses={["flat"]} label="Flat" />
<GtkButton cssClasses={["pill"]} label="Pill" />
<GtkButton cssClasses={["circular"]} iconName="list-add-symbolic" />
<GtkButton cssClasses={["raised"]} label="Raised" />
<GtkButton cssClasses={["opaque"]} label="Opaque" />
```

### Containers

```tsx
<GtkBox cssClasses={["card"]} />
<GtkListBox cssClasses={["boxed-list"]} />
<GtkBox cssClasses={["toolbar"]} />
<GtkBox cssClasses={["content"]} />
<GtkBox cssClasses={["view"]} />
```

### Status Colors

```tsx
<GtkLabel cssClasses={["success"]} label="Success" />
<GtkLabel cssClasses={["warning"]} label="Warning" />
<GtkLabel cssClasses={["error"]} label="Error" />
<GtkLabel cssClasses={["accent"]} label="Accent" />
```

## Settings Page Example

```tsx
import {
    GtkApplicationWindow, GtkBox, GtkScrolledWindow,
    AdwHeaderBar, AdwClamp, AdwPreferencesGroup, AdwActionRow,
    GtkSwitch, GtkLabel, quit
} from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";
import { useState } from "react";

const SettingsPage = () => {
    const [darkMode, setDarkMode] = useState(false);
    const [notifications, setNotifications] = useState(true);

    return (
        <GtkApplicationWindow title="Settings" defaultWidth={500} defaultHeight={600} onCloseRequest={quit}>
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <AdwHeaderBar />

                <GtkScrolledWindow vexpand>
                    <AdwClamp maximumSize={600}>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24} marginTop={24} marginBottom={24}>
                            <AdwPreferencesGroup title="Appearance">
                                <AdwActionRow title="Dark Mode" subtitle="Use dark color scheme">
                                    <GtkSwitch
                                        valign={Gtk.Align.CENTER}
                                        active={darkMode}
                                        onStateSet={(_, state) => { setDarkMode(state); return false; }}
                                    />
                                </AdwActionRow>
                            </AdwPreferencesGroup>

                            <AdwPreferencesGroup title="Notifications">
                                <AdwActionRow title="Enable Notifications" subtitle="Receive updates and alerts">
                                    <GtkSwitch
                                        valign={Gtk.Align.CENTER}
                                        active={notifications}
                                        onStateSet={(_, state) => { setNotifications(state); return false; }}
                                    />
                                </AdwActionRow>
                            </AdwPreferencesGroup>

                            <AdwPreferencesGroup title="About">
                                <AdwActionRow title="Version" subtitle="1.0.0" />
                                <AdwActionRow title="License" subtitle="MIT" />
                            </AdwPreferencesGroup>
                        </GtkBox>
                    </AdwClamp>
                </GtkScrolledWindow>
            </GtkBox>
        </GtkApplicationWindow>
    );
};
```

## Tips

1. **Use AdwActionRow for settings** — Provides consistent list item styling
2. **Wrap content in AdwClamp** — Prevents content from stretching too wide
3. **Use boxed-list class** — Gives lists a modern card-like appearance
4. **Prefer Adw components** — They handle responsive behavior automatically
5. **Follow GNOME HIG** — Check the [GNOME Human Interface Guidelines](https://developer.gnome.org/hig/) for design patterns
