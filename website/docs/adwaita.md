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
import { x, AdwHeaderBar, GtkButton, GtkLabel } from "@gtkx/react";

<AdwHeaderBar>
 <x.Slot for={AdwHeaderBar} id="titleWidget">
 <GtkLabel label="My App" cssClasses={["title"]} />
 </x.Slot>

 <GtkButton iconName="open-menu-symbolic" cssClasses={["flat"]} />
</AdwHeaderBar>;
```

### AdwViewStack / AdwViewSwitcher

Tab-like navigation between views:

```tsx
import { x, AdwViewStack, AdwViewSwitcher, GtkBox } from "@gtkx/react";
import * as Adw from "@gtkx/ffi/adw";
import * as Gtk from "@gtkx/ffi/gtk";
import { useRef, useState } from "react";

const TabbedView = () => {
 const stackRef = useRef<Adw.ViewStack | null>(null);
 const [currentPage, setCurrentPage] = useState("home");

 return (
 <GtkBox orientation={Gtk.Orientation.VERTICAL}>
 <AdwViewSwitcher stack={stackRef.current ?? undefined} />

 <AdwViewStack
 ref={stackRef}
 page={currentPage}
 onNotify={(_, prop) => {
 if (prop === "visible-child-name" && stackRef.current) {
 setCurrentPage(stackRef.current.getVisibleChildName() ?? "home");
 }
 }}
>
 <x.StackPage id="home" title="Home" iconName="go-home-symbolic">
 Home content
 </x.StackPage>
 <x.StackPage id="settings" title="Settings" iconName="preferences-system-symbolic">
 Settings content
 </x.StackPage>
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
</GtkListBox>;
```

#### ActionRow Slots

Use `x.ActionRowPrefix` and `x.ActionRowSuffix` to position widgets at the start or end of the row. These work with `AdwActionRow`, `AdwEntryRow`, and `AdwExpanderRow`:

```tsx
import { x, AdwActionRow, GtkListBox, GtkImage, GtkSwitch } from "@gtkx/react";

<GtkListBox cssClasses={["boxed-list"]}>
 <AdwActionRow title="Airplane Mode">
 <x.ActionRowPrefix>
 <GtkImage iconName="airplane-mode-symbolic" />
 </x.ActionRowPrefix>
 <x.ActionRowSuffix>
 <GtkSwitch valign={Gtk.Align.CENTER} />
 </x.ActionRowSuffix>
 </AdwActionRow>
</GtkListBox>;
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
</GtkListBox>;
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
 <GtkSpinButton valign={Gtk.Align.CENTER} climbRate={1} digits={0} />
 </AdwActionRow>
</AdwPreferencesGroup>;
```

### AdwClamp

Constrain content width for readability:

```tsx
import { AdwClamp, GtkBox } from "@gtkx/react";

<AdwClamp maximumSize={600} tighteningThreshold={400}>
 <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
 This content is constrained to a readable width On wide screens, it won't stretch too far
 </GtkBox>
</AdwClamp>;
```

### AdwToolbarView

Container for header bars and toolbars with content:

```tsx
import { x, AdwToolbarView, AdwHeaderBar, GtkActionBar, GtkButton, GtkLabel } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";

<AdwToolbarView>
 <x.ToolbarTop>
 <AdwHeaderBar />
 </x.ToolbarTop>

 <GtkLabel label="Main content area" vexpand />

 <x.ToolbarBottom>
 <GtkActionBar>
 <GtkButton label="Cancel" />
 <GtkButton label="Save" cssClasses={["suggested-action"]} />
 </GtkActionBar>
 </x.ToolbarBottom>
</AdwToolbarView>;
```

The `x.ToolbarTop` and `x.ToolbarBottom` components position header bars, action bars, or other toolbars at the top and bottom of the view.

### AdwNavigationView

Stack-based navigation with push/pop transitions. Use `x.NavigationPage` for declarative page management:

```tsx
import { x, AdwNavigationView, AdwHeaderBar, GtkBox, GtkButton, GtkLabel } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";
import { useState } from "react";

const NavigationExample = () => {
 const [history, setHistory] = useState(["home"]);

 const pushDetail = () => {
 setHistory([...history, "detail"]);
 };

 const pop = () => {
 setHistory(history.slice(0, -1));
 };

 return (
 <AdwNavigationView history={history} onHistoryChanged={setHistory}>
 <x.NavigationPage id="home" title="Main">
 <GtkBox orientation={Gtk.Orientation.VERTICAL}>
 <AdwHeaderBar />
 <GtkBox
 orientation={Gtk.Orientation.VERTICAL}
 spacing={12}
 marginTop={24}
 marginStart={24}
 marginEnd={24}
>
 <GtkLabel label="Welcome to the app" cssClasses={["title-2"]} />
 <GtkButton label="View Details" onClicked={pushDetail} cssClasses={["suggested-action"]} />
 </GtkBox>
 </GtkBox>
 </x.NavigationPage>

 <x.NavigationPage id="detail" title="Details">
 <GtkBox orientation={Gtk.Orientation.VERTICAL}>
 <AdwHeaderBar />
 <GtkBox
 orientation={Gtk.Orientation.VERTICAL}
 spacing={12}
 marginTop={24}
 marginStart={24}
 marginEnd={24}
>
 <GtkLabel label="Detail content here" />
 <GtkButton label="Go Back" onClicked={pop} />
 </GtkBox>
 </GtkBox>
 </x.NavigationPage>
 </AdwNavigationView>
 );
};
```

### AdwNavigationSplitView

Sidebar/content split layout for master-detail interfaces. Use `x.NavigationPage` with `id="sidebar"` and `id="content"` to define the two panes:

```tsx
import {
 x,
 AdwNavigationSplitView,
 AdwToolbarView,
 AdwHeaderBar,
 AdwActionRow,
 GtkListBox,
 GtkScrolledWindow,
 GtkBox,
 GtkImage,
 GtkLabel,
} from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";
import { useState } from "react";

interface Item {
 id: string;
 title: string;
 icon: string;
}

const items: Item[] = [
 { id: "inbox", title: "Inbox", icon: "mail-unread-symbolic" },
 { id: "starred", title: "Starred", icon: "starred-symbolic" },
 { id: "sent", title: "Sent", icon: "mail-send-symbolic" },
];

const SplitViewExample = () => {
 const [selected, setSelected] = useState(items[0]);

 return (
 <AdwNavigationSplitView sidebarWidthFraction={0.33} minSidebarWidth={200} maxSidebarWidth={300}>
 <x.NavigationPage id="sidebar" title="Mail">
 <AdwToolbarView>
 <x.ToolbarTop>
 <AdwHeaderBar />
 </x.ToolbarTop>
 <GtkScrolledWindow vexpand>
 <GtkListBox
 cssClasses={["navigation-sidebar"]}
 onRowSelected={(_, row) => {
 if (!row) return;
 const item = items[row.getIndex()];
 if (item) setSelected(item);
 }}
>
 {items.map((item) => (
 <AdwActionRow key={item.id} title={item.title}>
 <x.ActionRowPrefix>
 <GtkImage iconName={item.icon} />
 </x.ActionRowPrefix>
 </AdwActionRow>
 ))}
 </GtkListBox>
 </GtkScrolledWindow>
 </AdwToolbarView>
 </x.NavigationPage>

 <x.NavigationPage id="content" title={selected?.title ?? ""}>
 <AdwToolbarView>
 <x.ToolbarTop>
 <AdwHeaderBar />
 </x.ToolbarTop>
 <GtkBox
 orientation={Gtk.Orientation.VERTICAL}
 spacing={12}
 halign={Gtk.Align.CENTER}
 valign={Gtk.Align.CENTER}
 vexpand
>
 <GtkImage iconName={selected?.icon ?? ""} iconSize={Gtk.IconSize.LARGE} />
 <GtkLabel label={selected?.title ?? ""} cssClasses={["title-2"]} />
 </GtkBox>
 </AdwToolbarView>
 </x.NavigationPage>
 </AdwNavigationSplitView>
 );
};
```

The `x.NavigationPage` component works with both `AdwNavigationView` (stack-based navigation) and `AdwNavigationSplitView` (sidebar/content layout). For split views, the `id` prop determines which slot the page occupies: `"sidebar"` for the left pane and `"content"` for the right pane.

## Settings Page Example

```tsx
import {
 x,
 GtkApplicationWindow,
 GtkBox,
 GtkScrolledWindow,
 AdwHeaderBar,
 AdwClamp,
 AdwPreferencesGroup,
 AdwActionRow,
 GtkSwitch,
 GtkLabel,
 quit,
} from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";
import { useState } from "react";

const SettingsPage = () => {
 const [darkMode, setDarkMode] = useState(false);
 const [notifications, setNotifications] = useState(true);

 return (
 <GtkApplicationWindow title="Settings" defaultWidth={500} defaultHeight={600} onClose={quit}>
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
 onStateSet={(_, state) => {
 setDarkMode(state);
 return false;
 }}
 />
 </AdwActionRow>
 </AdwPreferencesGroup>

 <AdwPreferencesGroup title="Notifications">
 <AdwActionRow title="Enable Notifications" subtitle="Receive updates and alerts">
 <GtkSwitch
 valign={Gtk.Align.CENTER}
 active={notifications}
 onStateSet={(_, state) => {
 setNotifications(state);
 return false;
 }}
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

## Reference

For the complete list of Adwaita CSS classes (typography, buttons, containers, status colors), see the [Libadwaita Style Classes](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/main/style-classes.html).
