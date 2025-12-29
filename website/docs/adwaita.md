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
</AdwHeaderBar>;
```

### AdwViewStack / AdwViewSwitcher

Tab-like navigation between views:

```tsx
import {
  AdwViewStack,
  AdwViewStackPage,
  AdwViewSwitcher,
  GtkBox,
} from "@gtkx/react";
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
        <AdwViewStackPage
          name="settings"
          title="Settings"
          iconName="preferences-system-symbolic"
        >
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

  <AdwActionRow
    title="Account"
    subtitle="Manage your account settings"
    activatable
  >
    <GtkButton
      iconName="go-next-symbolic"
      cssClasses={["flat"]}
      valign={Gtk.Align.CENTER}
    />
  </AdwActionRow>
</GtkListBox>;
```

#### ActionRow Slots

Use `ActionRow.Prefix` and `ActionRow.Suffix` to position widgets at the start or end of the row. These work with `AdwActionRow`, `AdwEntryRow`, and `AdwExpanderRow`:

```tsx
import { AdwActionRow, ActionRow, GtkListBox, GtkImage, GtkSwitch } from "@gtkx/react";

<GtkListBox cssClasses={["boxed-list"]}>
  <AdwActionRow title="Airplane Mode">
    <ActionRow.Prefix>
      <GtkImage iconName="airplane-mode-symbolic" />
    </ActionRow.Prefix>
    <ActionRow.Suffix>
      <GtkSwitch valign={Gtk.Align.CENTER} />
    </ActionRow.Suffix>
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
import {
  AdwPreferencesGroup,
  AdwActionRow,
  GtkSwitch,
  GtkSpinButton,
} from "@gtkx/react";

<AdwPreferencesGroup
  title="Appearance"
  description="Customize the look and feel"
>
  <AdwActionRow title="Dark Mode">
    <GtkSwitch valign={Gtk.Align.CENTER} />
  </AdwActionRow>
  <AdwActionRow title="Font Size">
    <GtkSpinButton valign={Gtk.Align.CENTER} />
  </AdwActionRow>
</AdwPreferencesGroup>;
```

### AdwClamp

Constrain content width for readability:

```tsx
import { AdwClamp, GtkBox } from "@gtkx/react";

<AdwClamp maximumSize={600} tighteningThreshold={400}>
  <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
    This content is constrained to a readable width On wide screens, it won't
    stretch too far
  </GtkBox>
</AdwClamp>;
```

### AdwToolbarView

Container for header bars and toolbars with content:

```tsx
import { AdwToolbarView, AdwHeaderBar, GtkActionBar, GtkButton, GtkLabel, Toolbar } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";

<AdwToolbarView>
  <Toolbar.Top>
    <AdwHeaderBar />
  </Toolbar.Top>

  <GtkLabel label="Main content area" vexpand />

  <Toolbar.Bottom>
    <GtkActionBar>
      <GtkButton label="Cancel" />
      <GtkButton label="Save" cssClasses={["suggested-action"]} />
    </GtkActionBar>
  </Toolbar.Bottom>
</AdwToolbarView>;
```

The `Toolbar.Top` and `Toolbar.Bottom` components position header bars, action bars, or other toolbars at the top and bottom of the view.

### AdwToastOverlay

Show toast notifications declaratively using the `Toast` component:

```tsx
import { AdwToastOverlay, Toast, GtkButton, GtkBox } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";
import { useState } from "react";

const ToastExample = () => {
  const [showToast, setShowToast] = useState(false);

  return (
    <AdwToastOverlay>
      <GtkBox orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER}>
        <GtkButton label="Show Toast" onClicked={() => setShowToast(true)} />
      </GtkBox>

      {showToast && (
        <Toast
          title="Action completed!"
          timeout={3}
          onDismissed={() => setShowToast(false)}
        />
      )}
    </AdwToastOverlay>
  );
};
```

#### Toast with Action Button

```tsx
const [showToast, setShowToast] = useState(false);
const [lastDeleted, setLastDeleted] = useState<Item | null>(null);

const handleDelete = (item: Item) => {
  setLastDeleted(item);
  setShowToast(true);
  // Delete item...
};

const handleUndo = () => {
  // Restore lastDeleted...
  setShowToast(false);
};

<AdwToastOverlay>
  {/* ... content ... */}

  {showToast && lastDeleted && (
    <Toast
      title={`Deleted "${lastDeleted.name}"`}
      timeout={5}
      buttonLabel="Undo"
      onButtonClicked={handleUndo}
      onDismissed={() => setShowToast(false)}
    />
  )}
</AdwToastOverlay>;
```

#### Toast Props

| Prop | Type | Description |
|------|------|-------------|
| `title` | `string` | The toast message text |
| `timeout` | `number` | Auto-dismiss timeout in seconds (0 for indefinite) |
| `buttonLabel` | `string` | Label for the action button |
| `onButtonClicked` | `() => void` | Callback when action button is clicked |
| `onDismissed` | `() => void` | Callback when toast is dismissed |
| `priority` | `Adw.ToastPriority` | Interrupt priority level |
| `useMarkup` | `boolean` | Whether to use Pango markup in title |

### AdwNavigationView

Stack-based navigation with push/pop transitions:

```tsx
import {
  AdwNavigationView,
  AdwNavigationPage,
  AdwHeaderBar,
  GtkBox,
  GtkButton,
  GtkLabel,
} from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";
import * as Adw from "@gtkx/ffi/adw";
import { useState, useRef } from "react";

const NavigationExample = () => {
  const navViewRef = useRef<Adw.NavigationView | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const pushDetail = () => {
    setShowDetail(true);
    navViewRef.current?.pushByTag("detail");
  };

  const popToMain = () => {
    navViewRef.current?.pop();
    setShowDetail(false);
  };

  return (
    <AdwNavigationView ref={navViewRef}>
      <AdwNavigationPage title="Main" tag="main">
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
            <GtkButton
              label="View Details"
              onClicked={pushDetail}
              cssClasses={["suggested-action"]}
            />
          </GtkBox>
        </GtkBox>
      </AdwNavigationPage>

      {showDetail && (
        <AdwNavigationPage title="Details" tag="detail">
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
              <GtkButton label="Go Back" onClicked={popToMain} />
            </GtkBox>
          </GtkBox>
        </AdwNavigationPage>
      )}
    </AdwNavigationView>
  );
};
```

#### AdwNavigationPage Props

| Prop        | Type         | Description                                       |
| ----------- | ------------ | ------------------------------------------------- |
| `title`     | `string`     | Page title shown in header bar                    |
| `tag`       | `string`     | Unique tag for navigation (used with `pushByTag`) |
| `canPop`    | `boolean`    | Whether the page can be popped (default: true)    |
| `onShowing` | `() => void` | Called when page starts showing                   |
| `onShown`   | `() => void` | Called when page is fully shown                   |
| `onHiding`  | `() => void` | Called when page starts hiding                    |
| `onHidden`  | `() => void` | Called when page is fully hidden                  |

#### Navigation Methods

Access navigation methods via ref:

```tsx
const navViewRef = useRef<Adw.NavigationView | null>(null);

// Push a page by its tag
navViewRef.current?.pushByTag("detail");

// Pop the current page
navViewRef.current?.pop();

// Pop to a specific page
navViewRef.current?.popToTag("main");

// Replace the visible page
navViewRef.current?.replaceWithTags(["main", "settings"]);
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
    <GtkApplicationWindow
      title="Settings"
      defaultWidth={500}
      defaultHeight={600}
      onCloseRequest={quit}
    >
      <GtkBox orientation={Gtk.Orientation.VERTICAL}>
        <AdwHeaderBar />

        <GtkScrolledWindow vexpand>
          <AdwClamp maximumSize={600}>
            <GtkBox
              orientation={Gtk.Orientation.VERTICAL}
              spacing={24}
              marginTop={24}
              marginBottom={24}
            >
              <AdwPreferencesGroup title="Appearance">
                <AdwActionRow
                  title="Dark Mode"
                  subtitle="Use dark color scheme"
                >
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
                <AdwActionRow
                  title="Enable Notifications"
                  subtitle="Receive updates and alerts"
                >
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
