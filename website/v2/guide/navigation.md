---
title: "Navigation"
description: "Choose an Adwaita navigator and connect its pages, headers, and native back controls."
---

# Navigation

`@gtkx/navigation` renders [React Navigation](https://reactnavigation.org) with Adwaita widgets. Install it alongside GTKX:

```bash
npm install @gtkx/navigation@beta
```

Choose a navigator for the layout:

| Navigator                           | Use it for                                     | Native widgets                           |
| ----------------------------------- | ---------------------------------------------- | ---------------------------------------- |
| [Stack](#stack-navigator)           | Moving through a sequence of pages             | `AdwNavigationView`                      |
| [Tabs](#tab-navigator)              | Switching between a few peer sections          | `AdwViewStack` and a view switcher       |
| [Drawer](#drawer-navigator)         | Choosing an application section from a sidebar | `AdwOverlaySplitView`                    |
| [Split view](#split-view-navigator) | Keeping a selection beside its detail pages    | `AdwNavigationSplitView`                 |
| [Tab view](#tab-view-navigator)     | Opening any number of documents as tabs        | `AdwTabView` with a tab bar and overview |

Scaffolded applications already generate the Adwaita bindings these navigators need. The package re-exports React Navigation's core hooks, actions and types. Use its [navigation documentation](https://reactnavigation.org/docs/navigation-object/) for those shared concepts and the [GTKX reference](/v2/reference/@gtkx/navigation/) for navigator options.

## NavigationContainer

`NavigationContainer` hosts the navigation tree. Render it once, inside the window, around the root navigator:

```tsx
import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
import { NavigationContainer } from "@gtkx/navigation";
import { quit } from "@gtkx/react";

export const App = () => (
    <AdwApplication>
        <AdwApplicationWindow
            title="Notes"
            defaultWidth={800}
            defaultHeight={600}
            onCloseRequest={quit}
        >
            <NavigationContainer>
                <Notes />
            </NavigationContainer>
        </AdwApplicationWindow>
    </AdwApplication>
);
```

The container's default theme follows Adwaita's current dark and high-contrast settings. Pass `theme` to override the values supplied to `useTheme` and screen options; this does not change the native color scheme.

Navigation outside the tree uses React Navigation's [container API](https://reactnavigation.org/docs/navigation-container/).

### Restoring state

Pass a saved state to `initialState` and save each new one from `onStateChange`. React Navigation's [state persistence](https://reactnavigation.org/docs/state-persistence/) example renders `null` until the saved state loads, but a GTKX application ends when its first render shows no window. Keep the window rendered and load the state inside it:

```tsx
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import {
    AdwApplication,
    AdwApplicationWindow,
    AdwSpinner,
} from "@gtkx/jsx/adw";
import { type InitialState, NavigationContainer } from "@gtkx/navigation";
import { quit } from "@gtkx/react";
import { useEffect, useState } from "react";

const dataDir = GLib.buildFilenamev([GLib.getUserDataDir(), "notes"]);
const stateFile = Gio.File.newForPath(
    GLib.buildFilenamev([dataDir, "navigation.json"]),
);

const loadState = async (): Promise<InitialState | undefined> => {
    try {
        const [bytes] = await stateFile.loadContentsAsync(null);
        return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
        return undefined;
    }
};

const saveState = (state: object | undefined) => {
    GLib.mkdirWithParents(dataDir, 0o755);
    const bytes = new TextEncoder().encode(JSON.stringify(state));
    stateFile
        .replaceContentsAsync(
            bytes,
            null,
            false,
            Gio.FileCreateFlags.NONE,
            null,
        )
        .catch((error: unknown) => {
            console.error(error);
        });
};

export const App = () => {
    const [restored, setRestored] = useState<{
        state: InitialState | undefined;
    }>();

    useEffect(() => {
        void loadState().then((state) => setRestored({ state }));
    }, []);

    return (
        <AdwApplication>
            <AdwApplicationWindow
                title="Notes"
                defaultWidth={800}
                defaultHeight={600}
                onCloseRequest={quit}
            >
                {restored ? (
                    <NavigationContainer
                        initialState={restored.state}
                        onStateChange={saveState}
                    >
                        <Notes />
                    </NavigationContainer>
                ) : (
                    <AdwSpinner />
                )}
            </AdwApplicationWindow>
        </AdwApplication>
    );
};
```

### Opening links

`NavigationContainer` has no `linking` prop: React Navigation's linking reads URLs through React Native, while a desktop application receives them from `GApplication`. Register the scheme with `deploy.protocols` in `gtkx.config.ts`, set `Gio.ApplicationFlags.HANDLES_OPEN`, and turn each URI into a navigation state with `getStateFromPath`.

A launch with a URI emits `open` before the window renders, so pass that state to `initialState`. A URI forwarded from a second launch reaches the running container, which `resetRoot` updates:

```tsx
import * as Gio from "@gtkx/gi/gio";
import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
import {
    createNavigationContainerRef,
    getStateFromPath,
    type InitialState,
    NavigationContainer,
} from "@gtkx/navigation";
import { quit } from "@gtkx/react";
import { useState } from "react";

type NotesParams = { List: undefined; Note: { id: string } };

const navigationRef = createNavigationContainerRef<NotesParams>();

const linking = {
    initialRouteName: "List",
    screens: { List: "", Note: "note/:id" },
} as const;

const stateFromUri = (uri: string) =>
    getStateFromPath<NotesParams>(uri.replace(/^notes:\/\//, ""), linking);

export const App = () => {
    const [initialState, setInitialState] = useState<InitialState>();

    const open = (files: Gio.File[]) => {
        const uri = files.at(-1)?.getUri();
        const state = uri === undefined ? undefined : stateFromUri(uri);
        if (state === undefined) return;
        if (navigationRef.isReady()) navigationRef.resetRoot(state);
        else setInitialState(state);
    };

    return (
        <AdwApplication flags={Gio.ApplicationFlags.HANDLES_OPEN} onOpen={open}>
            <AdwApplicationWindow
                title="Notes"
                defaultWidth={800}
                defaultHeight={600}
                onCloseRequest={quit}
            >
                <NavigationContainer
                    ref={navigationRef}
                    initialState={initialState}
                >
                    <Notes />
                </NavigationContainer>
            </AdwApplicationWindow>
        </AdwApplication>
    );
};
```

`initialRouteName` keeps the list beneath a linked note, so Back returns to it. `getPathFromState(state, linking)` turns a state back into a path, for example to copy a link to the visible page. During development, pass a URI after `--`, as in `pnpm dev -- notes://note/42`; see [command-line apps](/v2/guide/application-lifecycle#command-line-apps).

## Stack navigator

`createStackNavigator` renders an `AdwNavigationView`. Define the route parameters to typecheck screens, `navigate` calls, and `route.params`:

<<< @/figures/guide/navigation-stack.tsx [src/notes.tsx]

<figure class="result">
    <img class="result-light" src="/figures/guide-navigation-stack-light.png" width="360" height="260" loading="lazy" alt="A window whose header bar shows the title Notes above a centered Open note 42 button." />
    <img class="result-dark" src="/figures/guide-navigation-stack-dark.png" width="360" height="260" loading="lazy" alt="A window whose header bar shows the title Notes above a centered Open note 42 button." />
    <figcaption>Captured from the sample above. The navigator draws the header bar and its title from the screen options.</figcaption>
</figure>

Each screen renders one root widget; wrap several widgets in a container such as `GtkBox`.

The stack uses React Navigation's routing behavior. In the example, `navigate("Note", { id })` updates the current Note screen or pushes one from another screen. Returning to an earlier route is a separate action, such as `popTo`. See the [navigation API](https://reactnavigation.org/docs/navigation-object/) for route identity and action behavior.

Pushes and pops use Adwaita transitions. Replacing or resetting the stack switches pages without a transition.

### Headers

Each page gets an `AdwHeaderBar` with a title and native back button. The title defaults to the route name. Add header actions through screen options:

```tsx
import { GtkButton } from "@gtkx/jsx/gtk";

<Stack.Screen
    name="Note"
    component={Note}
    options={({ route }) => ({
        title: `Note ${route.params.id}`,
        headerEnd: <GtkButton iconName="document-edit-symbolic" />,
    })}
/>;
```

Use `headerStart` and `headerEnd` for actions in the native header bar. `headerTitle` replaces its title widget, and `header` replaces the bar. Set `headerShown: false` on a screen that contains another navigator to let the inner navigator own the header.

Set shared defaults through the navigator's `screenOptions`; a screen's `options` take precedence. See the [header options reference](/v2/reference/@gtkx/navigation/type-aliases/HeaderOptions).

### Native back controls

The header back button, Escape, Alt+Left, mouse back button and swipe gestures use the native Adwaita behavior. Set `popOnEscape={false}` to disable the navigator's Escape handling, `canPop: false` to prevent native back navigation, or `animation: "none"` to skip a page's transition. `headerBackVisible: false` hides only the header button.

Native back controls dispatch `StackActions.pop()`. Use `usePreventRemove` to guard against losing edits; if it prevents removal, the page returns to its position and the callback receives the attempted action:

```tsx
import type { NavigationAction } from "@gtkx/navigation";
import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwAlertDialog } from "@gtkx/jsx/adw";
import { GtkBox, GtkEntry } from "@gtkx/jsx/gtk";
import { useNavigation, usePreventRemove } from "@gtkx/navigation";
import { useState } from "react";

const Compose = () => {
    const navigation = useNavigation();
    const [text, setText] = useState("");
    const [pending, setPending] = useState<NavigationAction | null>(null);

    usePreventRemove(text !== "", ({ data }) => {
        setPending(data.action);
    });

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkEntry
                placeholderText="Write something"
                onChanged={(entry) => setText(entry.text)}
            />
            {pending && (
                <AdwAlertDialog
                    heading="Discard draft?"
                    body="The text you wrote will be lost."
                    defaultResponse="keep"
                    closeResponse="keep"
                    responses={[
                        { id: "keep", label: "Keep Editing" },
                        {
                            id: "discard",
                            label: "Discard",
                            appearance: Adw.ResponseAppearance.DESTRUCTIVE,
                        },
                    ]}
                    onResponse={(id) => {
                        if (id === "discard") {
                            navigation.dispatch(pending);
                        }

                        setPending(null);
                    }}
                />
            )}
        </GtkBox>
    );
};
```

React Navigation documents the rest of the [removal guard lifecycle](https://reactnavigation.org/docs/preventing-going-back/).

React Navigation 7 depends on `use-latest-callback` 0.2, which outside a browser updates the guard's callback in a passive effect. A passive effect that leaves the screen, such as `useEffect(() => { if (sent) navigation.goBack(); }, [sent])`, and runs before that update still sees the old `preventRemove` value, so the guard blocks a leave it should allow. Version 0.3 fixes this. Until React Navigation 7 accepts it, override the version: with npm, add it to `"overrides"` in `package.json`; with Yarn, to `"resolutions"`; with pnpm, to `overrides` in `pnpm-workspace.yaml`. For npm:

```json
{
    "overrides": {
        "use-latest-callback": "^0.3.5"
    }
}
```

Otherwise, call `usePreventRemove` before the effect that leaves the screen, so its callback updates first.

### Transition events

Stack screens emit `transitionStart` and `transitionEnd` from their native page signals. Their `closing` value distinguishes a page leaving from one arriving. Screen `listeners` can observe them whether animation is enabled or disabled.

## Tab navigator

`createTabNavigator` renders an `AdwViewStack`. The switcher occupies the header title by default; `tabBarPosition="bottom"` puts an `AdwViewSwitcherBar` below the content:

<<< @/figures/guide/navigation-tabs.tsx [src/mail.tsx]

<figure class="result">
    <img class="result-light" src="/figures/guide-navigation-tabs-light.png" width="360" height="440" loading="lazy" alt="A window titled Inbox showing an Inbox status page, with a switcher bar at the bottom holding an Inbox button with a badge of 3 and an Archived button." />
    <img class="result-dark" src="/figures/guide-navigation-tabs-dark.png" width="360" height="440" loading="lazy" alt="A window titled Inbox showing an Inbox status page, with a switcher bar at the bottom holding an Inbox button with a badge of 3 and an Archived button." />
    <figcaption>Captured from the sample above with <code>unread={3}</code>. The bottom switcher shows each screen's icon, label and badge.</figcaption>
</figure>

The switcher uses each screen's label, icon, badge and attention options. Tabs mount when first focused unless `lazy: false` is set. Set `animation: "fade"` for a crossfade.

Set `useUnderline: true` to read underscores in the switcher label as keyboard mnemonics: with `tabBarLabel: "_World"`, Alt+W selects the tab in either switcher position. Write `__` for a literal underscore. Header titles stay plain text, so put the mnemonic in `tabBarLabel` and keep `title` plain.

With a top switcher, leave the header's title widget available for it. To supply `headerTitle`, move the switcher to the bottom or place it explicitly through a custom `header`. Hiding the header leaves a top switcher visible on its own.

User selection emits `tabPress`, which a screen listener can prevent. Programmatic selection uses React Navigation's tab actions. The [tab options reference](/v2/reference/@gtkx/navigation/type-aliases/TabNavigationOptions) covers the remaining settings.

## Drawer navigator

`createDrawerNavigator` uses an `AdwOverlaySplitView`. Its sidebar lists the screens and marks the focused one; a button in the content header toggles the sidebar:

<<< @/figures/guide/navigation-drawer.tsx [src/app.tsx]

<figure class="result">
    <img class="result-light" src="/figures/guide-navigation-drawer-light.png" width="640" height="400" loading="lazy" alt="A window with a sidebar titled Mail listing Inbox, selected, and Preferences with their icons, beside a content pane whose header has a sidebar toggle and the title Inbox above a No New Mail status page." />
    <img class="result-dark" src="/figures/guide-navigation-drawer-dark.png" width="640" height="400" loading="lazy" alt="A window with a sidebar titled Mail listing Inbox, selected, and Preferences with their icons, beside a content pane whose header has a sidebar toggle and the title Inbox above a No New Mail status page." />
    <figcaption>Captured from the sample above with <code>isNarrow={false}</code>. The sidebar stays beside the content and marks the focused screen.</figcaption>
</figure>

Set `collapsed` when the layout needs an overlay sidebar; the sidebar then closes after a selection. In a wide layout it stays beside the content. `defaultStatus` controls its initial visibility, and `pinSidebar` preserves visibility across collapse changes.

`useUnderline: true` works the same way for drawer labels: with `drawerLabel: "_Settings"`, Alt+S selects the screen while the sidebar is visible.

Native opening and dismissal update the drawer's navigation state, so gestures and React Navigation's drawer actions stay in sync. See the [drawer configuration reference](/v2/reference/@gtkx/navigation/type-aliases/DrawerNavigationConfig) for sizing and placement.

`drawerContent` can wrap the default `DrawerItemList` with application-specific content:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { AdwHeaderBar, AdwToolbarView, AdwWindowTitle } from "@gtkx/jsx/adw";
import { GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { type DrawerContentProps, DrawerItemList } from "@gtkx/navigation";

const Sidebar = (props: DrawerContentProps) => (
    <AdwToolbarView
        top={<AdwHeaderBar titleWidget={<AdwWindowTitle title="Mail" />} />}
    >
        <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.NEVER}>
            <DrawerItemList {...props} />
        </GtkScrolledWindow>
    </AdwToolbarView>
);

<Drawer.Navigator drawerContent={(props) => <Sidebar {...props} />}>
    <Drawer.Screen name="Inbox" component={Inbox} />
    <Drawer.Screen name="Settings" component={Settings} />
</Drawer.Navigator>;
```

Activating a row emits `drawerItemPress`, which `preventDefault` cancels, before navigating.

## Split view navigator

`createSplitViewNavigator` keeps its first screen in the sidebar and places the other screens in a content stack. Use it when the sidebar selects data, such as a folder whose messages appear beside it:

<<< @/figures/guide/navigation-split-view.tsx [src/mail.tsx]

<figure class="result">
    <img class="result-light" src="/figures/guide-navigation-split-view-light.png" width="720" height="420" loading="lazy" alt="A window with a sidebar titled Mail holding a selected Inbox row, beside a content pane whose header bar is titled Inbox above a centered Open message 1 button." />
    <img class="result-dark" src="/figures/guide-navigation-split-view-dark.png" width="720" height="420" loading="lazy" alt="A window with a sidebar titled Mail holding a selected Inbox row, beside a content pane whose header bar is titled Inbox above a centered Open message 1 button." />
    <figcaption>Captured from the sample above. The navigator opens on the Inbox folder, which the sidebar selects first.</figcaption>
</figure>

`AdwSidebar` selects its first item on its own, and `activated` fires only when the user activates a row. The sample therefore names a content screen in `initialRouteName`, with `initialParams`, so the pane opens on the folder the sidebar shows as selected instead of on the placeholder.

In a split view, `navigate` selects a content route: it updates that route and removes pages above it. Choosing another folder therefore replaces the selection instead of adding another folder page. Use `push` to keep multiple copies of a content page.

A content route that is not open yet is pushed above the current one, as in a stack. In a sidebar of distinct section screens, as in a settings app, `navigate("Proxy")` from Wi-Fi therefore leaves a Back button to Wi-Fi, and `popTo` replaces only the top page, which keeps the previous section beneath a section's sub-page. Reset the content instead, keeping the sidebar's own route so the sidebar is not remounted:

```tsx
import { GtkLabel, GtkListBox, GtkListBoxRow } from "@gtkx/jsx/gtk";
import type { SplitViewScreenProps } from "@gtkx/navigation";

type SettingsParams = {
    Sections: undefined;
    Wifi: undefined;
    Proxy: undefined;
};

const sections = [
    { name: "Wifi", label: "Wi-Fi" },
    { name: "Proxy", label: "Proxy" },
] as const;

const Sections = ({
    navigation,
    route,
}: SplitViewScreenProps<SettingsParams, "Sections">) => (
    <GtkListBox
        cssClasses={["navigation-sidebar"]}
        onRowActivated={(row) => {
            const section = sections[row.getIndex()];
            if (section)
                navigation.reset({
                    index: 1,
                    routes: [route, { name: section.name }],
                });
        }}
    >
        {sections.map((section) => (
            <GtkListBoxRow key={section.name}>
                <GtkLabel label={section.label} xalign={0} />
            </GtkListBoxRow>
        ))}
    </GtkListBox>
);
```

The reset switches sections without a page transition.

The sidebar stays pinned beneath the content routes. Going back from the first content page clears the selection and restores `contentPlaceholder`, which sits below an untitled header bar so the window keeps its controls.

Content pages use the stack's headers, back controls and transition events. The first selection fills an empty pane and emits no page transition. The sidebar has its own header without a back button.

`collapseCondition` collapses the panes while an [`Adw.BreakpointCondition`](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/type_func.BreakpointCondition.parse.html) holds, measured against the navigator's size. libadwaita applies it during layout, as it applies an `AdwBreakpoint` setter, so the panes change before GTK moves keyboard focus. Setting `collapsed` from a breakpoint's `onApply` and `onUnapply` handlers lands after GTK has moved focus, and widening the window can then select the focused sidebar row. Use `collapsed` when the layout depends on application state rather than size.

As with window breakpoints, give the window a minimum size the collapsed layout fits:

```tsx
import { AdwApplicationWindow } from "@gtkx/jsx/adw";
import { NavigationContainer } from "@gtkx/navigation";

export const App = () => (
    <AdwApplicationWindow title="Mail" widthRequest={360} heightRequest={294}>
        <NavigationContainer>
            <Mail />
        </NavigationContainer>
    </AdwApplicationWindow>
);
```

`useSplitViewCollapsed()` tells the navigator's screens whether the panes are collapsed, whether `collapsed` or `collapseCondition` collapsed them. libadwaita's [`AdwSidebar`](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/class.Sidebar.html) switches to page mode with the breakpoint that collapses its split view, so a sidebar screen reads the hook instead of repeating the condition in a window breakpoint:

```tsx
import * as Adw from "@gtkx/gi/adw";
import { AdwSidebar, AdwSidebarItem, AdwSidebarSection } from "@gtkx/jsx/adw";
import {
    type SplitViewScreenProps,
    useSplitViewCollapsed,
} from "@gtkx/navigation";

const folders = ["Inbox", "Sent", "Archive"];

const Folders = ({
    navigation,
}: SplitViewScreenProps<MailParams, "Folders">) => {
    const isCollapsed = useSplitViewCollapsed();

    return (
        <AdwSidebar
            mode={isCollapsed ? Adw.SidebarMode.PAGE : Adw.SidebarMode.SIDEBAR}
            onActivated={(index) => {
                const folder = folders[index];
                if (folder) navigation.navigate("Messages", { folder });
            }}
        >
            <AdwSidebarSection>
                {folders.map((folder) => (
                    <AdwSidebarItem key={folder} title={folder} />
                ))}
            </AdwSidebarSection>
        </AdwSidebar>
    );
};
```

The value changes after libadwaita has laid out the collapsed or widened panes, so use it for how a screen presents itself rather than to collapse anything.

In a collapsed split view, Back or Escape from the first content page returns directly to the sidebar. Sizing and sidebar placement are covered by the [split view configuration reference](/v2/reference/@gtkx/navigation/type-aliases/SplitViewNavigationConfig).

Focus follows the selected content route even when the sidebar remains visible. A sidebar's `useFocusEffect` therefore stops when a content page is selected; refresh sidebar data based on the data source or navigation state instead.

## Tab view navigator

`createTabViewNavigator` renders its routes as the pages of an `AdwTabView`, with an `AdwTabBar` under the header and an optional `AdwTabOverview`. Unlike the tab navigator, it opens any number of tabs from one screen, so a document or browser window declares the screen once and opens it repeatedly:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import {
    createTabViewNavigator,
    type TabViewScreenProps,
} from "@gtkx/navigation";

type DocumentParams = { Document: { title: string } };

const Tabs = createTabViewNavigator<DocumentParams>();

const Document = ({
    route,
    navigation,
}: TabViewScreenProps<DocumentParams, "Document">) => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL}>
        <GtkLabel label={route.params.title} />
        <GtkButton
            label="Open related"
            onClicked={() =>
                navigation.openTab(
                    "Document",
                    { title: "Related" },
                    { parent: route.key },
                )
            }
        />
    </GtkBox>
);

export const Documents = () => (
    <Tabs.Navigator
        overview={{
            enableNewTab: true,
            onCreateTab: () => ({
                name: "Document",
                params: { title: "Untitled" },
            }),
        }}
        screenOptions={({ route }) => ({ title: route.params.title })}
    >
        <Tabs.Screen
            name="Document"
            component={Document}
            initialParams={{ title: "Untitled" }}
        />
    </Tabs.Navigator>
);
```

Tabs are addressed by route key. The navigation object adds [tab actions](/v2/reference/@gtkx/navigation/type-aliases/TabViewActionHelpers) such as `openTab`, `closeTab`, `selectTab` and `pinTab`, also available as `TabViewActions`. Opening with `parent` places the tab after its parent and the parent's descendants, and closing it selects that parent again. Pinned tabs stay ahead of the others; the state's `pinnedKeys` lists them.

[Screen options](/v2/reference/@gtkx/navigation/type-aliases/TabViewNavigationOptions) set the native tab page's properties, such as `title`, `icon`, `loading` and `needsAttention`. The header shows the window title unless `headerTitle` is set. Screens mount when first selected unless `lazy: false`.

`navigate` selects the last open tab of a screen and updates its params, or opens one when none is open. Give the screen a `getId` to identify tabs by their params: `navigate` and `openTab` then select the tab with the same id and open a new tab for a new id.

Native interaction flows back into the state: selecting a tab emits a cancellable `tabPress`, dragging reorders the route, and the close button dispatches `closeTab`, which `usePreventRemove` can refuse.

Closing the last tab is left unhandled, so a parent navigator or the container's `onUnhandledAction` decides whether the window closes. A tab view inside a section of the app has no window to close; set `replaceLastTab` there, and closing the last tab replaces it with a new tab of the initial route.

The overview's `open` follows the same rule as other [open-state props](/v2/guide/modals-and-portals#closing): when given, update it from `onOpenChange`, or leave it out to let the overview open and close on its own. The [tab view configuration reference](/v2/reference/@gtkx/navigation/type-aliases/TabViewNavigationConfig) lists the tab bar, overview, menu and drop target settings.

### Tab context menu

`renderMenu` declares the menu that right-clicking a tab or pressing Shift+F10 opens. It receives a ref to attach to a `GMenu` anywhere in what it returns, directly or through a component of yours that passes the ref on; the navigator renders the result outside the widget tree and uses that menu. `onSetupMenu` reports the tab the menu opens for, and `null` once it closes after the chosen action has run:

```tsx
import { GMenu, GSimpleAction } from "@gtkx/jsx/gio";
import { AdwApplicationWindow } from "@gtkx/jsx/adw";
import {
    NavigationContainer,
    TabViewActions,
    useNavigationContainerRef,
} from "@gtkx/navigation";
import { useRef } from "react";

export const DocumentWindow = () => {
    const navigation = useNavigationContainerRef<DocumentParams>();
    const menuTab = useRef<string | null>(null);

    return (
        <AdwApplicationWindow
            actions={
                <GSimpleAction
                    name="close-others"
                    onActivate={() =>
                        navigation.dispatch(
                            TabViewActions.closeOtherTabs(
                                menuTab.current ?? undefined,
                            ),
                        )
                    }
                />
            }
        >
            <NavigationContainer ref={navigation}>
                <Tabs.Navigator
                    renderMenu={(ref) => (
                        <GMenu
                            ref={ref}
                            items={[
                                {
                                    label: "Close Other Tabs",
                                    action: "win.close-others",
                                },
                            ]}
                        />
                    )}
                    onSetupMenu={(route) => {
                        menuTab.current = route?.key ?? null;
                    }}
                >
                    <Tabs.Screen name="Document" component={Document} />
                </Tabs.Navigator>
            </NavigationContainer>
        </AdwApplicationWindow>
    );
};
```

To reuse a menu model that already exists, such as one shared with another widget, pass it as `menuModel` instead. A navigator given both `renderMenu` and `menuModel` throws.

Without a tab from `onSetupMenu`, as when the same action runs from a shortcut, the actions act on the selected tab.

### Windows and transfers

libadwaita's `create-window` and `create-tab` signals expect an object before the handler returns, so the navigator creates native pages and views first and renders into them afterwards. Pass `onCreateWindow` to open a window for a tab dragged out: create an `Adw.TabView`, store it, and return it. Render the new window with its own `NavigationContainer` and a navigator that receives that view through the `view` prop; the transferred page becomes its initial route. A page dragged into another window is adopted by that navigator with its params, and its screen mounts again there, so keep tab state in params or an external store. `useTabView()` gives screens and header content the native view, `getPage(key)` and `transferTab(key, target)`.

The [Adwaita demo](https://github.com/gtkx-org/gtkx/tree/main/examples/adwaita-demo) shows the complete window lifecycle with menus, shortcuts and the overview.

## Nesting navigators

Use a navigator as a screen to nest it, for example a stack inside each drawer section. Set `headerShown: false` on the containing screen so only the inner navigator draws a header:

```tsx
import type { NavigatorScreenParams } from "@gtkx/navigation";
import { createDrawerNavigator, createStackNavigator } from "@gtkx/navigation";

type NotesParams = { List: undefined; Note: { id: string } };
type AppParams = {
    Notes: NavigatorScreenParams<NotesParams>;
    Settings: undefined;
};

const Drawer = createDrawerNavigator<AppParams>();
const Stack = createStackNavigator<NotesParams>();

const NotesStack = () => (
    <Stack.Navigator>
        <Stack.Screen
            name="List"
            component={List}
            options={{ title: "Notes" }}
        />
        <Stack.Screen name="Note" component={Note} />
    </Stack.Navigator>
);

export const App = () => (
    <Drawer.Navigator>
        <Drawer.Screen
            name="Notes"
            component={NotesStack}
            options={{ headerShown: false }}
        />
        <Drawer.Screen name="Settings" component={Settings} />
    </Drawer.Navigator>
);
```

Hiding the drawer header also hides its toggle. Add a button to the inner stack's `headerStart` that dispatches `DrawerActions.toggleDrawer()`:

```tsx
import { GtkButton } from "@gtkx/jsx/gtk";
import { DrawerActions } from "@gtkx/navigation";

<Stack.Navigator
    screenOptions={({ navigation }) => ({
        headerStart: (
            <GtkButton
                iconName="sidebar-show-symbolic"
                onClicked={() =>
                    navigation.dispatch(DrawerActions.toggleDrawer())
                }
            />
        ),
    })}
>
    <Stack.Screen name="List" component={List} />
    <Stack.Screen name="Note" component={Note} />
</Stack.Navigator>;
```

Route parameters and actions follow React Navigation's [nesting rules](https://reactnavigation.org/docs/nesting-navigators/).

## Hooks

Import React Navigation's hooks, such as [`useFocusEffect`](https://reactnavigation.org/docs/use-focus-effect/) and [`useNavigation`](https://reactnavigation.org/docs/use-navigation/), from `@gtkx/navigation`. `useTheme` returns the [container's theme](#navigationcontainer). GTKX adds [`useSplitViewCollapsed`](#split-view-navigator) for split view screens and [`useTabView`](#windows-and-transfers) for tab view screens and their header content.

## Static configuration

The navigators also accept React Navigation's [static configuration](https://reactnavigation.org/docs/static-configuration/). Import `createStaticNavigation` from `@gtkx/navigation`; the resulting component includes GTKX's `NavigationContainer`.

## Typing the root param list

Declare the root navigator once to type `useNavigation()` and navigation refs throughout the application:

```ts
import { createStackNavigator } from "@gtkx/navigation";

type RootParams = { List: undefined; Note: { id: string } };

const RootStack = createStackNavigator<RootParams>();

type RootStackType = typeof RootStack;

declare module "@react-navigation/core" {
    interface RootNavigator extends RootStackType {}
}
```

GTKX uses the interface declared by `@react-navigation/core`, so augment that module. Install it directly with `npm install @react-navigation/core@^7`: pnpm keeps transitive dependencies out of the project's `node_modules`, and TypeScript cannot augment a module it cannot resolve. Until it resolves, `navigate` from `useNavigation()` rejects every route, typed as `never`. The same pattern works with a static navigator. See React Navigation's [TypeScript guide](https://reactnavigation.org/docs/typescript/) for nested screens and inferred route parameters.

## Testing

Drive the rendered widgets with `@gtkx/testing`. Animations are disabled by default, and queries find the visible page:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { NavigationContainer } from "@gtkx/navigation";
import { render, screen, userEvent } from "@gtkx/testing";
import { expect, it } from "vitest";

it("opens a note and comes back", async () => {
    await render(
        <NavigationContainer>
            <Notes />
        </NavigationContainer>,
    );

    await userEvent.click(
        await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
            name: "Open note 42",
        }),
    );
    await screen.findByText("Showing note 42");

    await userEvent.click(
        screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Back" }),
    );
    expect(screen.queryByText("Showing note 42")).toBeNull();
});
```

For tab navigation, query the view switcher's `Gtk.AccessibleRole.TAB` and its label. `userEvent.keyboard(widget, "{Escape}")` exercises native back navigation. See [Testing](/v2/guide/testing) for setup and query behavior.
