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

| Navigator | Use it for | Native surface |
| --- | --- | --- |
| [Stack](#stack-navigator) | Moving through a sequence of pages | `AdwNavigationView` |
| [Tabs](#tab-navigator) | Switching between a few peer sections | `AdwViewStack` and a view switcher |
| [Drawer](#drawer-navigator) | Choosing an application section from a sidebar | `AdwOverlaySplitView` |
| [Split view](#split-view-navigator) | Keeping a selection beside its detail pages | `AdwNavigationSplitView` |

Scaffolded applications already generate the Adwaita bindings these navigators need. The package re-exports React Navigation's core hooks, actions and types. Use its [navigation documentation](https://reactnavigation.org/docs/navigation-object/) for those shared concepts and the [GTKX reference](/v2/reference/@gtkx/navigation/) for navigator options.

## NavigationContainer

`NavigationContainer` hosts the navigation tree. Render it once, inside the window, around the root navigator:

```tsx
import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
import { NavigationContainer } from "@gtkx/navigation";
import { quit } from "@gtkx/react";

export const App = () => (
    <AdwApplication>
        <AdwApplicationWindow title="Notes" defaultWidth={800} defaultHeight={600} onCloseRequest={quit}>
            <NavigationContainer>
                <Notes />
            </NavigationContainer>
        </AdwApplicationWindow>
    </AdwApplication>
);
```

The container's default theme follows Adwaita's current dark and high-contrast settings. Pass `theme` to override the values supplied to `useTheme` and screen options; this does not change the native color scheme.

State restoration and navigation outside the tree use React Navigation's [container API](https://reactnavigation.org/docs/navigation-container/).

## Stack navigator

`createStackNavigator` renders an `AdwNavigationView`. Define the route parameters to type-check screens, `navigate` calls, and `route.params`:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { createStackNavigator, type StackScreenProps } from "@gtkx/navigation";

type NotesParams = { List: undefined; Note: { id: string } };

const Stack = createStackNavigator<NotesParams>();

const List = ({ navigation }: StackScreenProps<NotesParams, "List">) => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL}>
        <GtkButton label="Open note 42" onClicked={() => navigation.navigate("Note", { id: "42" })} />
    </GtkBox>
);

const Note = ({ route, navigation }: StackScreenProps<NotesParams, "Note">) => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL}>
        <GtkLabel>{`Showing note ${route.params.id}`}</GtkLabel>
        <GtkButton label="Done" onClicked={() => navigation.goBack()} />
    </GtkBox>
);

export const Notes = () => (
    <Stack.Navigator initialRouteName="List">
        <Stack.Screen name="List" component={List} options={{ title: "Notes" }} />
        <Stack.Screen name="Note" component={Note} options={({ route }) => ({ title: `Note ${route.params.id}` })} />
    </Stack.Navigator>
);
```

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
            <GtkEntry placeholderText="Write something" onChanged={(entry) => setText(entry.text)} />
            {pending && (
                <AdwAlertDialog
                    heading="Discard draft?"
                    body="The text you wrote will be lost."
                    defaultResponse="keep"
                    closeResponse="keep"
                    responses={[
                        { id: "keep", label: "Keep Editing" },
                        { id: "discard", label: "Discard", appearance: Adw.ResponseAppearance.DESTRUCTIVE },
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

Dispatch the action supplied to the callback after confirmation. React Navigation documents the rest of the [removal guard lifecycle](https://reactnavigation.org/docs/preventing-going-back/).

### Transition events

Stack screens emit `transitionStart` and `transitionEnd` from their native page signals. Their `closing` value distinguishes a page leaving from one arriving. Screen `listeners` can observe them whether animation is enabled or disabled.

## Tab navigator

`createTabNavigator` renders an `AdwViewStack`. The switcher occupies the header title by default; `tabBarPosition="bottom"` puts an `AdwViewSwitcherBar` below the content:

```tsx
import { createTabNavigator } from "@gtkx/navigation";

type MailParams = { Inbox: undefined; Archive: undefined };

const Tabs = createTabNavigator<MailParams>();

export const Mail = ({ unread }: { unread: number }) => (
    <Tabs.Navigator tabBarPosition="bottom" screenOptions={{ animation: "fade" }}>
        <Tabs.Screen
            name="Inbox"
            component={Inbox}
            options={{ tabBarIcon: "mail-inbox-symbolic", tabBarBadge: unread, needsAttention: unread > 0 }}
        />
        <Tabs.Screen
            name="Archive"
            component={Archive}
            options={{ tabBarLabel: "Archived", tabBarIcon: "folder-symbolic", lazy: false }}
        />
    </Tabs.Navigator>
);
```

The switcher uses each screen's label, icon, badge and attention options. Tabs mount when first focused unless `lazy: false` is set. Set `animation: "fade"` for a crossfade.

With a top switcher, leave the header's title widget available for it. To supply `headerTitle`, move the switcher to the bottom or place it explicitly through a custom `header`. Hiding the header leaves a top switcher visible on its own.

User selection emits `tabPress`, which a screen listener can prevent. Programmatic selection uses React Navigation's tab actions. The [tab options reference](/v2/reference/@gtkx/navigation/type-aliases/TabNavigationOptions) covers the remaining settings.

## Drawer navigator

`createDrawerNavigator` uses an `AdwOverlaySplitView`. Its sidebar lists the screens and marks the focused one; a button in the content header toggles the sidebar:

```tsx
import { createDrawerNavigator } from "@gtkx/navigation";

type AppParams = { Inbox: undefined; Settings: undefined };

const Drawer = createDrawerNavigator<AppParams>();

export const App = ({ isNarrow }: { isNarrow: boolean }) => (
    <Drawer.Navigator collapsed={isNarrow} sidebarPosition="start">
        <Drawer.Screen name="Inbox" component={Inbox} options={{ drawerIcon: "mail-inbox-symbolic" }} />
        <Drawer.Screen
            name="Settings"
            component={Settings}
            options={{ drawerLabel: "Preferences", drawerIcon: "emblem-system-symbolic" }}
        />
    </Drawer.Navigator>
);
```

Set `collapsed` when the layout needs an overlay sidebar; the sidebar then closes after a selection. In a wide layout it stays beside the content. `defaultStatus` controls its initial visibility, and `pinSidebar` preserves visibility across collapse changes.

Native opening and dismissal update the drawer's navigation state, so gestures and React Navigation's drawer actions stay in sync. See the [drawer configuration reference](/v2/reference/@gtkx/navigation/type-aliases/DrawerNavigationConfig) for sizing and placement.

`drawerContent` can wrap the default `DrawerItemList` with application-specific content:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { AdwHeaderBar, AdwToolbarView, AdwWindowTitle } from "@gtkx/jsx/adw";
import { GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { type DrawerContentProps, DrawerItemList } from "@gtkx/navigation";

const Sidebar = (props: DrawerContentProps) => (
    <AdwToolbarView topBar={<AdwHeaderBar titleWidget={<AdwWindowTitle title="Mail" />} />}>
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

```tsx
import { AdwStatusPage } from "@gtkx/jsx/adw";
import { GtkButton } from "@gtkx/jsx/gtk";
import { createSplitViewNavigator, type SplitViewScreenProps } from "@gtkx/navigation";

type MailParams = { Folders: undefined; Messages: { folder: string }; Message: { id: string } };

const Split = createSplitViewNavigator<MailParams>();

const Folders = ({ navigation }: SplitViewScreenProps<MailParams, "Folders">) => (
    <GtkButton label="Inbox" onClicked={() => navigation.navigate("Messages", { folder: "inbox" })} />
);

export const Mail = ({ isNarrow }: { isNarrow: boolean }) => (
    <Split.Navigator
        collapsed={isNarrow}
        minSidebarWidth={220}
        maxSidebarWidth={300}
        sidebarWidthFraction={0.25}
        contentPlaceholder={(
            <AdwStatusPage
                iconName="mail-unread-symbolic"
                title="No Folder Selected"
                description="Pick a folder to read what is in it."
            />
        )}
    >
        <Split.Screen name="Folders" component={Folders} options={{ title: "Mail" }} />
        <Split.Screen name="Messages" component={Messages} options={({ route }) => ({ title: route.params.folder })} />
        <Split.Screen name="Message" component={Message} options={{ headerEnd: <GtkButton label="Reply" /> }} />
    </Split.Navigator>
);
```

In a split view, `navigate` selects a content route: it updates that route and removes pages above it. Choosing another folder therefore replaces the selection instead of adding another folder page. Use `push` to keep multiple copies of a content page.

The sidebar stays pinned beneath the content routes. Going back from the first content page clears the selection and restores `contentPlaceholder`. An `initialRouteName` naming a content screen opens that screen instead of starting with the placeholder.

Content pages use the stack's headers, back controls and transition events. The first selection fills an empty pane and emits no page transition. The sidebar has its own header without a back button.

Drive `collapsed` from a window breakpoint so the panes adapt to the available width:

```tsx
import * as Adw from "@gtkx/gi/adw";
import { AdwApplicationWindow, AdwBreakpoint } from "@gtkx/jsx/adw";
import { NavigationContainer } from "@gtkx/navigation";
import { useState } from "react";

export const App = () => {
    const [isNarrow, setIsNarrow] = useState(false);

    return (
        <AdwApplicationWindow
            title="Mail"
            breakpoints={(
                <AdwBreakpoint
                    condition={Adw.BreakpointCondition.parse("max-width: 500sp")}
                    onApply={() => setIsNarrow(true)}
                    onUnapply={() => setIsNarrow(false)}
                />
            )}
        >
            <NavigationContainer>
                <Mail isNarrow={isNarrow} />
            </NavigationContainer>
        </AdwApplicationWindow>
    );
};
```

In a collapsed split view, Back or Escape from the first content page returns directly to the sidebar. Sizing and sidebar placement are covered by the [split view configuration reference](/v2/reference/@gtkx/navigation/type-aliases/SplitViewNavigationConfig).

Focus follows the selected content route even when the sidebar remains visible. A sidebar's `useFocusEffect` therefore stops when a content page is selected; refresh sidebar data based on the data source or navigation state instead.

## Nesting navigators

Use a navigator as a screen to nest it, for example a stack inside each drawer section. Set `headerShown: false` on the containing screen so only the inner navigator draws a header:

```tsx
import type { NavigatorScreenParams } from "@gtkx/navigation";
import { createDrawerNavigator, createStackNavigator } from "@gtkx/navigation";

type NotesParams = { List: undefined; Note: { id: string } };
type AppParams = { Notes: NavigatorScreenParams<NotesParams>; Settings: undefined };

const Drawer = createDrawerNavigator<AppParams>();
const Stack = createStackNavigator<NotesParams>();

const NotesStack = () => (
    <Stack.Navigator>
        <Stack.Screen name="List" component={List} options={{ title: "Notes" }} />
        <Stack.Screen name="Note" component={Note} />
    </Stack.Navigator>
);

export const App = () => (
    <Drawer.Navigator>
        <Drawer.Screen name="Notes" component={NotesStack} options={{ headerShown: false }} />
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
                onClicked={() => navigation.dispatch(DrawerActions.toggleDrawer())}
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

Use the hooks re-exported from `@gtkx/navigation`. React Navigation documents [screen focus effects](https://reactnavigation.org/docs/use-focus-effect/) and [navigation access](https://reactnavigation.org/docs/use-navigation/). GTKX's `useTheme` value follows the Adwaita state described above.

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

GTKX uses the interface declared by `@react-navigation/core`, so augment that module. The same pattern works with a static navigator. See React Navigation's [TypeScript guide](https://reactnavigation.org/docs/typescript/) for nested screens and inferred route parameters.

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

    await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Open note 42" }));
    await screen.findByText("Showing note 42");

    await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Back" }));
    expect(screen.queryByText("Showing note 42")).toBeNull();
});
```

For tab navigation, query the view switcher's `Gtk.AccessibleRole.TAB` and its label. `userEvent.keyboard(widget, "{Escape}")` exercises native back navigation. See [Testing](/v2/guide/testing) for setup and query behavior.

## Next

Continue with [CSS](/v2/guide/css) to style these pages with the `style` prop and GTK4's own CSS engine.
