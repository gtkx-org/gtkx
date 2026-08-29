---
title: "Navigation"
description: "Build typed stack, tab, drawer, and split-view navigation with @gtkx/navigation."
---

# Navigation

`@gtkx/navigation` renders React Navigation 7 with native libadwaita widgets. Install it separately:

```bash
npm install @gtkx/navigation
```

The package re-exports React Navigation's core hooks, actions, and types. GTKX-specific components and options are in the [API reference](/reference/@gtkx/navigation/).

## Choose a navigator

| Navigator | Use it for | Native widget |
| --- | --- | --- |
| Stack | A drill-down flow with Back navigation | `AdwNavigationView` |
| Tabs | A few peer destinations | `AdwViewStack` and `AdwViewSwitcher` |
| Drawer | Top-level sections in a sidebar | `AdwOverlaySplitView` |
| Split view | A master list beside detail pages | `AdwNavigationSplitView` |

Start with a stack unless the information architecture clearly calls for persistent peers or a master-detail layout.

## Mount the root

Render one `NavigationContainer` inside the application window:

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

Use `initialState` and `onStateChange` when navigation state must survive restarts. A ref from `createNavigationContainerRef` or `useNavigationContainerRef` lets a notification or application action navigate from outside the tree.

## Build a typed stack

Define route names and parameters once. Screen props and navigation calls then share the same checks:

```tsx
import { GtkButton } from "@gtkx/jsx/gtk";
import { createStackNavigator, type StackScreenProps } from "@gtkx/navigation";

type NotesParams = {
    List: undefined;
    Note: { id: string };
};

const Stack = createStackNavigator<NotesParams>();

const List = ({ navigation }: StackScreenProps<NotesParams, "List">) => (
    <GtkButton label="Open note 42" onClicked={() => navigation.navigate("Note", { id: "42" })} />
);

const Note = ({ route, navigation }: StackScreenProps<NotesParams, "Note">) => (
    <GtkButton label={`Note ${route.params.id}`} onClicked={() => navigation.goBack()} />
);

export const Notes = () => (
    <Stack.Navigator initialRouteName="List">
        <Stack.Screen name="List" component={List} options={{ title: "Notes" }} />
        <Stack.Screen
            name="Note"
            component={Note}
            options={({ route }) => ({ title: `Note ${route.params.id}` })}
        />
    </Stack.Navigator>
);
```

Each screen renders one root widget. `navigate` selects a route, `push` always adds a page, and `goBack` returns to the previous page. The default header supplies the title and native back controls; use `headerStart`, `headerEnd`, or a custom `header` only when the screen needs them. See [`StackNavigationOptions`](/reference/@gtkx/navigation/type-aliases/StackNavigationOptions) and [`StackNavigationConfig`](/reference/@gtkx/navigation/type-aliases/StackNavigationConfig) for the complete surface.

Escape, Alt+Left, the mouse back button, edge swipes, and the header button follow the same pop path. Use `usePreventRemove` when unsaved work must show a confirmation dialog; after confirmation, dispatch the action supplied to the callback.

## Add top-level navigation

Tabs keep a small set of peer destinations visible:

```tsx
import { createTabNavigator } from "@gtkx/navigation";

type MailParams = { Inbox: undefined; Archive: undefined };
const Tabs = createTabNavigator<MailParams>();

export const Mail = () => (
    <Tabs.Navigator tabBarPosition="bottom">
        <Tabs.Screen name="Inbox" component={Inbox} options={{ tabBarIcon: "mail-inbox-symbolic" }} />
        <Tabs.Screen name="Archive" component={Archive} options={{ tabBarIcon: "folder-symbolic" }} />
    </Tabs.Navigator>
);
```

A drawer works for a larger set of top-level sections. Drive `collapsed` from an `AdwBreakpoint` so the sidebar overlays narrow windows:

```tsx
import { createDrawerNavigator } from "@gtkx/navigation";

type AppParams = { Inbox: undefined; Settings: undefined };
const Drawer = createDrawerNavigator<AppParams>();

<Drawer.Navigator collapsed={isNarrow}>
    <Drawer.Screen name="Inbox" component={Inbox} options={{ drawerIcon: "mail-inbox-symbolic" }} />
    <Drawer.Screen name="Settings" component={Settings} options={{ drawerIcon: "emblem-system-symbolic" }} />
</Drawer.Navigator>;
```

A split view reserves its first screen for the master pane and puts later screens in the detail stack:

```tsx
import { createSplitViewNavigator } from "@gtkx/navigation";

type SplitParams = { Folders: undefined; Messages: { folder: string }; Message: { id: string } };
const Split = createSplitViewNavigator<SplitParams>();

<Split.Navigator collapsed={isNarrow} contentPlaceholder={<EmptySelection />}>
    <Split.Screen name="Folders" component={Folders} />
    <Split.Screen name="Messages" component={Messages} />
    <Split.Screen name="Message" component={Message} />
</Split.Navigator>;
```

Selecting from the master screen navigates to a detail route. In a wide window the panes stay side by side; once collapsed, native Back returns from the detail to the master. The [adaptive-layout tutorial](/tutorial/an-adaptive-layout) shows the breakpoint pattern. Complete options live in the [`TabNavigationConfig`](/reference/@gtkx/navigation/type-aliases/TabNavigationConfig), [`DrawerNavigationConfig`](/reference/@gtkx/navigation/type-aliases/DrawerNavigationConfig), and [`SplitViewNavigationConfig`](/reference/@gtkx/navigation/type-aliases/SplitViewNavigationConfig) pages.

## Nest navigators

A navigator can be another navigator's screen. Hide the outer header so only one header bar is visible, and use `NavigatorScreenParams` to type routes into the child:

```tsx
import { createDrawerNavigator, type NavigatorScreenParams } from "@gtkx/navigation";

type NotesParams = { List: undefined; Note: { id: string } };
type AppParams = { Notes: NavigatorScreenParams<NotesParams>; Settings: undefined };

const Drawer = createDrawerNavigator<AppParams>();

<Drawer.Navigator>
    <Drawer.Screen name="Notes" component={NotesStack} options={{ headerShown: false }} />
    <Drawer.Screen name="Settings" component={Settings} />
</Drawer.Navigator>;
```

Navigate directly into the child with `navigation.navigate("Notes", { screen: "Note", params: { id: "42" } })`. Hooks such as `useNavigation`, `useRoute`, `useIsFocused`, and `useFocusEffect` always refer to the nearest screen.

## Test the workflow

Drive navigation through the widgets a user sees. `render` disables animations by default, so the destination is ready as soon as the click resolves:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { NavigationContainer } from "@gtkx/navigation";
import { render, screen, userEvent } from "@gtkx/testing";
import { expect, it } from "vitest";

it("opens a note and returns", async () => {
    await render(
        <NavigationContainer>
            <Notes />
        </NavigationContainer>,
    );

    await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Open note 42" }));
    await screen.findByText("Note 42");

    await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Back" }));
    expect(screen.queryByText("Note 42")).toBeNull();
});
```

Use `userEvent.keyboard(widget, "{Escape}")` for native keyboard back navigation. Reach for a container ref inside `act` only when the behavior has no user-facing trigger.

## Next

Continue with [CSS](/guide/css), or use the [navigation API reference](/reference/@gtkx/navigation/) for every option, action, event, hook, and type.
