---
sidebar_position: 4
---

# Adwaita

GTKX includes full support for [libadwaita](https://gnome.pages.gitlab.gnome.org/libadwaita/) components, allowing you to create apps that follow GNOME's Human Interface Guidelines. Make sure `libadwaita` is installed on your system (see [Getting Started](./getting-started)).

## Application Window

Use `AdwApplicationWindow` instead of GTK's `ApplicationWindow` for apps using libadwaita:

```tsx
import { AdwApplicationWindow, quit } from "@gtkx/react";

const App = () => (
  <AdwApplicationWindow.Root
    defaultWidth={500}
    defaultHeight={700}
    onCloseRequest={quit}
  >
    <AdwApplicationWindow.Content>
      {/* Your app content */}
    </AdwApplicationWindow.Content>
  </AdwApplicationWindow.Root>
);
```

## Toolbar View

`AdwToolbarView` provides a container with top and bottom toolbars. Use slots to place content:

```tsx
import {
  AdwToolbarView,
  AdwHeaderBar,
  AdwWindowTitle,
  Label,
} from "@gtkx/react";

const AppLayout = () => (
  <AdwToolbarView.Root>
    <AdwToolbarView.Top>
      <AdwHeaderBar.Root>
        <AdwHeaderBar.TitleWidget>
          <AdwWindowTitle title="My App" subtitle="Welcome" />
        </AdwHeaderBar.TitleWidget>
      </AdwHeaderBar.Root>
    </AdwToolbarView.Top>
    <AdwToolbarView.Content>Main content area</AdwToolbarView.Content>
    <AdwToolbarView.Bottom>{/* Optional bottom bar */}</AdwToolbarView.Bottom>
  </AdwToolbarView.Root>
);
```

## Header Bar

`AdwHeaderBar` is the libadwaita header bar with adaptive behavior. Children are packed to the start by default:

```tsx
import { AdwHeaderBar, AdwWindowTitle, GtkButton } from "@gtkx/react";

<AdwHeaderBar.Root>
  <AdwHeaderBar.TitleWidget>
    <AdwWindowTitle title="Settings" subtitle="Preferences" />
  </AdwHeaderBar.TitleWidget>
  <GtkButton iconName="open-menu-symbolic" />
</AdwHeaderBar.Root>;
```

## Status Page

`AdwStatusPage` displays a prominent icon, title, and description. Ideal for welcome screens, empty states, or error pages:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { AdwStatusPage, GtkBox, GtkButton, AdwButtonContent } from "@gtkx/react";

const WelcomePage = () => (
  <AdwStatusPage
    title="Welcome to My App"
    description="Get started by exploring the features below"
    iconName="org.gnome.Adwaita1.Demo"
  >
    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
      <GtkButton cssClasses={["suggested-action", "pill"]}>
        <AdwButtonContent iconName="list-add-symbolic" label="Get Started" />
      </GtkButton>
    </GtkBox>
  </AdwStatusPage>
);
```

## Preferences Group

`AdwPreferencesGroup` organizes settings into titled sections:

```tsx
import { AdwPreferencesGroup, AdwSwitchRow, AdwSpinRow } from "@gtkx/react";
import { useState } from "react";

const AppearanceSettings = () => {
  const [darkMode, setDarkMode] = useState(false);

  return (
    <AdwPreferencesGroup.Root
      title="Appearance"
      description="Customize the look and feel"
    >
      <AdwSwitchRow
        title="Dark Mode"
        subtitle="Use dark color scheme"
        active={darkMode}
        onActivate={() => setDarkMode(!darkMode)}
      />
      <AdwSpinRow
        title="Font Size"
        subtitle="Adjust the default font size"
        value={14}
        climbRate={1}
        digits={0}
      />
    </AdwPreferencesGroup.Root>
  );
};
```

## Action Row

`AdwActionRow` is a versatile list row with title, subtitle, and optional prefix/suffix widgets:

```tsx
import {
  AdwPreferencesGroup,
  AdwActionRow,
  AdwAvatar,
  GtkImage,
} from "@gtkx/react";

const AccountSection = () => (
  <AdwPreferencesGroup.Root title="Account">
    <AdwActionRow.Root
      title="Profile"
      subtitle="Manage your account settings"
      activatable
    >
      <AdwAvatar size={40} text="Demo User" showInitials />
    </AdwActionRow.Root>
    <AdwActionRow.Root title="Storage" subtitle="2.4 GB of 15 GB used">
      <GtkImage iconName="drive-harddisk-symbolic" iconSize={1} />
    </AdwActionRow.Root>
  </AdwPreferencesGroup.Root>
);
```

## Avatar

`AdwAvatar` displays a user avatar with fallback initials:

```tsx
import { AdwAvatar } from "@gtkx/react";

<AdwAvatar size={64} text="Alice Smith" showInitials />;
```

The `text` prop provides the name for generating initials, and `size` sets the diameter in pixels.

## Banner

`AdwBanner` shows dismissible messages at the top of a view:

```tsx
import { AdwBanner } from "@gtkx/react";
import { useState } from "react";

const NotificationBanner = () => {
  const [showBanner, setShowBanner] = useState(true);

  return showBanner ? (
    <AdwBanner
      title="Welcome! Explore the settings below."
      revealed
      buttonLabel="Dismiss"
      onButtonClicked={() => setShowBanner(false)}
    />
  ) : null;
};
```

## Button Content

`AdwButtonContent` creates consistent button layouts with an icon and label:

```tsx
import { GtkButton, AdwButtonContent } from "@gtkx/react";

<GtkButton cssClasses={["suggested-action", "pill"]}>
    <AdwButtonContent iconName="document-save-symbolic" label="Save" />
</GtkButton>

<GtkButton cssClasses={["destructive-action", "pill"]}>
    <AdwButtonContent iconName="user-trash-symbolic" label="Delete" />
</GtkButton>
```

## Clamp

`AdwClamp` constrains content to a maximum width while centering it:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { AdwClamp, GtkScrolledWindow, GtkBox } from "@gtkx/react";

const ContentPage = () => (
  <GtkScrolledWindow vexpand>
    <AdwClamp
      maximumSize={600}
      marginTop={24}
      marginBottom={24}
      marginStart={12}
      marginEnd={12}
    >
      <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
        {/* Content constrained to 600px max width */}
      </GtkBox>
    </AdwClamp>
  </GtkScrolledWindow>
);
```

## Complete Example

Here's a full application using libadwaita components:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import {
  AdwActionRow,
  AdwApplicationWindow,
  AdwAvatar,
  AdwBanner,
  AdwButtonContent,
  AdwClamp,
  AdwHeaderBar,
  AdwPreferencesGroup,
  AdwSpinRow,
  AdwStatusPage,
  AdwSwitchRow,
  AdwToolbarView,
  AdwWindowTitle,
  GtkBox,
  GtkButton,
  GtkScrolledWindow,
  quit,
} from "@gtkx/react";
import { useState } from "react";

type Page = "welcome" | "settings";

const WelcomePage = ({ onNavigate }: { onNavigate: (page: Page) => void }) => (
  <AdwStatusPage
    title="Welcome to GTKX"
    description="Build native Linux desktop apps with React"
    iconName="org.gnome.Adwaita1.Demo"
  >
    <GtkButton
      cssClasses={["suggested-action", "pill"]}
      onClicked={() => onNavigate("settings")}
    >
      <AdwButtonContent iconName="emblem-system-symbolic" label="Settings" />
    </GtkButton>
  </AdwStatusPage>
);

const SettingsPage = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [showBanner, setShowBanner] = useState(true);

  return (
    <GtkScrolledWindow vexpand hscrollbarPolicy={2}>
      <AdwClamp maximumSize={600} marginTop={24} marginBottom={24}>
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
          {showBanner && (
            <AdwBanner
              title="Welcome! Explore the settings below."
              revealed
              buttonLabel="Dismiss"
              onButtonClicked={() => setShowBanner(false)}
            />
          )}

          <AdwPreferencesGroup.Root title="Appearance">
            <AdwSwitchRow
              title="Dark Mode"
              subtitle="Use dark color scheme"
              active={darkMode}
              onActivate={() => setDarkMode(!darkMode)}
            />
          </AdwPreferencesGroup.Root>

          <AdwPreferencesGroup.Root title="Notifications">
            <AdwSwitchRow
              title="Enable Notifications"
              subtitle="Receive alerts and updates"
              active={notifications}
              onActivate={() => setNotifications(!notifications)}
            />
          </AdwPreferencesGroup.Root>

          <AdwPreferencesGroup.Root title="Account">
            <AdwActionRow.Root title="Profile" activatable>
              <AdwAvatar size={40} text="Demo User" showInitials />
            </AdwActionRow.Root>
          </AdwPreferencesGroup.Root>
        </GtkBox>
      </AdwClamp>
    </GtkScrolledWindow>
  );
};

export const App = () => {
  const [currentPage, setCurrentPage] = useState<Page>("welcome");

  return (
    <AdwApplicationWindow.Root
      defaultWidth={500}
      defaultHeight={700}
      onCloseRequest={quit}
    >
      <AdwApplicationWindow.Content>
        <AdwToolbarView.Root>
          <AdwToolbarView.Top>
            <AdwHeaderBar.Root>
              <AdwHeaderBar.TitleWidget>
                <AdwWindowTitle title="Adwaita Demo" />
              </AdwHeaderBar.TitleWidget>
              {currentPage !== "welcome" && (
                <GtkButton
                  iconName="go-home-symbolic"
                  onClicked={() => setCurrentPage("welcome")}
                />
              )}
            </AdwHeaderBar.Root>
          </AdwToolbarView.Top>
          <AdwToolbarView.Content>
            {currentPage === "welcome" && (
              <WelcomePage onNavigate={setCurrentPage} />
            )}
            {currentPage === "settings" && <SettingsPage />}
          </AdwToolbarView.Content>
        </AdwToolbarView.Root>
      </AdwApplicationWindow.Content>
    </AdwApplicationWindow.Root>
  );
};

export default App;
export const appId = "org.gtkx.AdwaitaDemo";
```

## Running the Example

The GTKX repository includes a full adwaita example:

```bash
cd examples/adwaita
pnpm install
pnpm dev
```

## Next Steps

- [Slots](./slots) — Learn about slot patterns used in Adwaita widgets
- [Styling](./styling) — Add custom styles with CSS-in-JS
- [Menus](./menus) — Create application menus
