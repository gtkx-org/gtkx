---
sidebar_position: 11
---

# Adwaita

GTKX supports [libadwaita](https://gnome.pages.gitlab.gnome.org/libadwaita/) for building modern GNOME applications. Adwaita provides adaptive widgets, consistent styling, and follows GNOME's Human Interface Guidelines.

## Prerequisites

Install libadwaita development files:

```bash
# Fedora
sudo dnf install libadwaita-devel

# Ubuntu/Debian
sudo apt install libadwaita-1-dev

# Arch
sudo pacman -S libadwaita
```

## Importing Adwaita

```tsx
import * as Adw from '@gtkx/ffi/adw';
import {
    AdwApplicationWindow,
    AdwHeaderBar,
    AdwToolbarView,
    AdwWindowTitle,
    Toolbar
} from '@gtkx/react';
```

## Application Window

Use `AdwApplicationWindow` for libadwaita apps:

```tsx
import { AdwApplicationWindow, AdwToolbarView, AdwHeaderBar, Toolbar, quit } from '@gtkx/react';

function App() {
    return (
        <AdwApplicationWindow
            defaultWidth={500}
            defaultHeight={700}
            onCloseRequest={quit}
        >
            <AdwToolbarView>
                <Toolbar.Top>
                    <AdwHeaderBar />
                </Toolbar.Top>
                Content
            </AdwToolbarView>
        </AdwApplicationWindow>
    );
}
```

### Content Slot

`AdwApplicationWindow` uses a `content` slot:

```tsx
<AdwApplicationWindow>
    <Slot id="content">
        <AdwToolbarView>
            ...
        </AdwToolbarView>
    </Slot>
</AdwApplicationWindow>
```

## ToolbarView

`AdwToolbarView` organizes content with top and bottom toolbars:

```tsx
import { AdwToolbarView, AdwHeaderBar, GtkActionBar, Toolbar } from '@gtkx/react';

<AdwToolbarView>
    <Toolbar.Top>
        <AdwHeaderBar />
    </Toolbar.Top>
    <GtkBox vexpand>
        Main content
    </GtkBox>
    <Toolbar.Bottom>
        <GtkActionBar>
            <GtkButton label="Cancel" />
            <GtkButton label="Apply" />
        </GtkActionBar>
    </Toolbar.Bottom>
</AdwToolbarView>
```

## HeaderBar

`AdwHeaderBar` provides an adaptive header with title and controls:

```tsx
import { AdwHeaderBar, AdwWindowTitle, GtkButton, Pack, Slot } from '@gtkx/react';

<AdwHeaderBar>
    <Pack.Start>
        <GtkButton iconName="go-previous-symbolic" />
    </Pack.Start>
    <Slot id="titleWidget">
        <AdwWindowTitle title="My App" subtitle="Welcome" />
    </Slot>
    <Pack.End>
        <GtkMenuButton iconName="open-menu-symbolic" />
    </Pack.End>
</AdwHeaderBar>
```

## Status Page

Display welcome screens, empty states, or errors:

```tsx
import { AdwStatusPage, GtkButton, AdwButtonContent } from '@gtkx/react';

<AdwStatusPage
    title="No Documents"
    description="Create a new document to get started"
    iconName="document-new-symbolic"
>
    <GtkButton cssClasses={['suggested-action', 'pill']}>
        <AdwButtonContent iconName="list-add-symbolic" label="New Document" />
    </GtkButton>
</AdwStatusPage>
```

## Preferences

### PreferencesGroup

Organize settings into sections:

```tsx
import { AdwPreferencesGroup, AdwSwitchRow, AdwSpinRow } from '@gtkx/react';

<AdwPreferencesGroup title="Appearance" description="Customize the look">
    <AdwSwitchRow
        title="Dark Mode"
        subtitle="Use dark color scheme"
        active={darkMode}
        onNotifyActive={() => setDarkMode(!darkMode)}
    />
    <AdwSpinRow
        title="Font Size"
        subtitle="Adjust text size"
        value={fontSize}
        adjustment={new Gtk.Adjustment({ lower: 8, upper: 32, stepIncrement: 1 })}
        onNotifyValue={(row) => setFontSize(row.getValue())}
    />
</AdwPreferencesGroup>
```

### PreferencesPage

Group multiple `PreferencesGroup` into a scrollable page:

```tsx
import { AdwPreferencesPage, AdwPreferencesGroup } from '@gtkx/react';

<AdwPreferencesPage>
    <AdwPreferencesGroup title="General">
        ...
    </AdwPreferencesGroup>
    <AdwPreferencesGroup title="Advanced">
        ...
    </AdwPreferencesGroup>
</AdwPreferencesPage>
```

### Row Types

| Component | Description |
|-----------|-------------|
| `AdwActionRow` | Row with title, subtitle, and child widgets |
| `AdwSwitchRow` | Row with toggle switch |
| `AdwSpinRow` | Row with numeric spinner |
| `AdwComboRow` | Row with dropdown selection |
| `AdwEntryRow` | Row with text entry |
| `AdwPasswordEntryRow` | Row with password entry |
| `AdwExpanderRow` | Expandable row with children |

## Action Row

Versatile list row with prefix/suffix widgets:

```tsx
import { AdwActionRow, AdwAvatar, GtkImage } from '@gtkx/react';

<AdwActionRow title="Profile" subtitle="View and edit your profile" activatable>
    <AdwAvatar size={40} text="Alice" showInitials />
</AdwActionRow>
```

## Avatar

Display user avatars with fallback initials:

```tsx
import { AdwAvatar } from '@gtkx/react';

<AdwAvatar
    size={64}
    text="Alice Smith"
    showInitials
/>
```

## Banner

Dismissible message banner:

```tsx
import { AdwBanner } from '@gtkx/react';

const [visible, setVisible] = useState(true);

{visible && (
    <AdwBanner
        title="Welcome! Explore the app."
        revealed
        buttonLabel="Dismiss"
        onButtonClicked={() => setVisible(false)}
    />
)}
```

## Button Content

Consistent button layout with icon and label:

```tsx
import { GtkButton, AdwButtonContent } from '@gtkx/react';

<GtkButton cssClasses={['suggested-action', 'pill']}>
    <AdwButtonContent iconName="document-save-symbolic" label="Save" />
</GtkButton>

<GtkButton cssClasses={['destructive-action', 'pill']}>
    <AdwButtonContent iconName="user-trash-symbolic" label="Delete" />
</GtkButton>
```

## Clamp

Constrain content to a maximum width:

```tsx
import { AdwClamp, GtkScrolledWindow, GtkBox } from '@gtkx/react';

<GtkScrolledWindow vexpand>
    <AdwClamp
        maximumSize={600}
        marginTop={24}
        marginBottom={24}
        marginStart={12}
        marginEnd={12}
    >
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            Constrained content
        </GtkBox>
    </AdwClamp>
</GtkScrolledWindow>
```

## Toast

Show transient notifications:

```tsx
import { AdwToastOverlay, AdwToast } from '@gtkx/react';
import { useRef } from 'react';
import * as Adw from '@gtkx/ffi/adw';

function App() {
    const overlayRef = useRef<Adw.ToastOverlay>(null);

    const showToast = () => {
        const toast = new Adw.Toast({ title: 'Document saved' });
        overlayRef.current?.addToast(toast);
    };

    return (
        <AdwToastOverlay ref={overlayRef}>
            <GtkButton label="Save" onClicked={showToast} />
        </AdwToastOverlay>
    );
}
```

## Navigation

### NavigationView

Stack-based navigation:

```tsx
import { AdwNavigationView, AdwNavigationPage, AdwHeaderBar, Toolbar } from '@gtkx/react';

<AdwNavigationView>
    <AdwNavigationPage title="Home" tag="home">
        <AdwToolbarView>
            <Toolbar.Top>
                <AdwHeaderBar />
            </Toolbar.Top>
            <GtkButton
                label="Go to Details"
                onClicked={() => nav.pushByTag('details')}
            />
        </AdwToolbarView>
    </AdwNavigationPage>
    <AdwNavigationPage title="Details" tag="details">
        <AdwToolbarView>
            <Toolbar.Top>
                <AdwHeaderBar />
            </Toolbar.Top>
            Details content
        </AdwToolbarView>
    </AdwNavigationPage>
</AdwNavigationView>
```

### ViewStack

Tab-like navigation:

```tsx
import { AdwViewStack, AdwViewStackPage, AdwViewSwitcher } from '@gtkx/react';

<AdwHeaderBar>
    <Slot id="titleWidget">
        <AdwViewSwitcher stack={stackRef.current} />
    </Slot>
</AdwHeaderBar>
<AdwViewStack ref={stackRef}>
    <AdwViewStackPage name="page1" title="Home" iconName="go-home-symbolic">
        Home content
    </AdwViewStackPage>
    <AdwViewStackPage name="page2" title="Settings" iconName="emblem-system-symbolic">
        Settings content
    </AdwViewStackPage>
</AdwViewStack>
```

## Styling

Adwaita provides consistent styling. Use built-in style classes:

```tsx
<GtkButton cssClasses={['suggested-action']} label="Primary" />
<GtkButton cssClasses={['destructive-action']} label="Danger" />
<GtkButton cssClasses={['flat']} label="Flat" />
<GtkButton cssClasses={['circular']} iconName="list-add-symbolic" />
<GtkButton cssClasses={['pill']} label="Pill Button" />
```

## Complete Example

```tsx
import * as Gtk from '@gtkx/ffi/gtk';
import {
    AdwApplicationWindow,
    AdwToolbarView,
    AdwHeaderBar,
    AdwWindowTitle,
    AdwPreferencesGroup,
    AdwSwitchRow,
    AdwClamp,
    GtkBox,
    GtkScrolledWindow,
    Toolbar,
    Slot,
    quit
} from '@gtkx/react';
import { useState } from 'react';

function App() {
    const [darkMode, setDarkMode] = useState(false);
    const [notifications, setNotifications] = useState(true);

    return (
        <AdwApplicationWindow
            defaultWidth={500}
            defaultHeight={600}
            onCloseRequest={quit}
        >
            <AdwToolbarView>
                <Toolbar.Top>
                    <AdwHeaderBar>
                        <Slot id="titleWidget">
                            <AdwWindowTitle title="Settings" />
                        </Slot>
                    </AdwHeaderBar>
                </Toolbar.Top>
                <GtkScrolledWindow vexpand>
                    <AdwClamp maximumSize={600} margin={24}>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
                            <AdwPreferencesGroup title="Appearance">
                                <AdwSwitchRow
                                    title="Dark Mode"
                                    active={darkMode}
                                    onNotifyActive={() => setDarkMode(!darkMode)}
                                />
                            </AdwPreferencesGroup>
                            <AdwPreferencesGroup title="Notifications">
                                <AdwSwitchRow
                                    title="Enable Notifications"
                                    active={notifications}
                                    onNotifyActive={() => setNotifications(!notifications)}
                                />
                            </AdwPreferencesGroup>
                        </GtkBox>
                    </AdwClamp>
                </GtkScrolledWindow>
            </AdwToolbarView>
        </AdwApplicationWindow>
    );
}

export default App;
export const appId = 'com.example.settings';
```
