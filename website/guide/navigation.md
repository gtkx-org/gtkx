---
title: "Navigation"
description: "Stack, tab, drawer, and split view navigation with @gtkx/navigation: React Navigation's core rendered with libadwaita's navigation view, view stack, and split views."
---

# Navigation

`@gtkx/navigation` brings [React Navigation](https://reactnavigation.org) to GTKX. It is React Navigation 7's core, `@react-navigation/core` and `@react-navigation/routers`, with navigators drawn by libadwaita: a stack is an `AdwNavigationView`, tabs are an `AdwViewStack` behind an `AdwViewSwitcher`, a drawer is an `AdwOverlaySplitView`, and a split view is an `AdwNavigationSplitView`. There is no React Native in it. The hooks, actions, and types are the ones the React Navigation docs describe, and the package re-exports all of `@react-navigation/core`, so one import covers everything. It installs separately:

```bash
npm install @gtkx/navigation
```

Every navigator draws itself with libadwaita widgets, so the package needs `@gtkx/jsx/adw`, which exists once `Adw-1` is in your `libraries`. `npm create gtkx` binds `Gtk-4.0` alone, so add it in `gtkx.config.ts`:

```diff
 export default defineConfig({
-    libraries: ["Gtk-4.0"],
+    libraries: ["Gtk-4.0", "Adw-1"],
     applicationId: "com.example.notes",
 });
```

Changing that list invalidates the generated bindings, so run codegen again: the next `gtkx dev`, `gtkx build`, or `gtkx codegen` regenerates them for you.

The navigators, their options, and the re-exported core API are in the [@gtkx/navigation reference](/reference/@gtkx/navigation/).

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

It takes `initialState` to restore a saved state, `onStateChange` to observe every change, `onReady` for the first render, and `onUnhandledAction` for an action no navigator handled. A `ref`, created with `createNavigationContainerRef` or `useNavigationContainerRef`, exposes the same navigation API outside the tree: `ref.current?.navigate("Note", { id: "42" })` from a menu action or a notification handler.

The container hands a `theme` to `useTheme` and to option callbacks. The default one tracks Adwaita's style manager live, so it is `{ dark, highContrast }` for the application as it is right now. Pass `theme` to override it, or `DefaultTheme` and `DarkTheme` for the two fixed ones.

## Stack navigator

`createStackNavigator` renders its screens as pages of an `AdwNavigationView`, so pushing and popping animate the way native Adwaita pages do. Type the param list once, and every screen, `navigate` call, and `route.params` read is checked against it:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { createStackNavigator, type StackScreenProps } from "@gtkx/navigation";

type NotesParams = { List: undefined; Note: { id: string } };

const Stack = createStackNavigator<NotesParams>();

const List = ({ navigation }: StackScreenProps<NotesParams, "List">) => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL}>
        <GtkButton
            label="Open note 42"
            onClicked={() => {
                navigation.navigate("Note", { id: "42" });
            }}
        />
    </GtkBox>
);

const Note = ({ route, navigation }: StackScreenProps<NotesParams, "Note">) => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL}>
        <GtkLabel>{`Showing note ${route.params.id}`}</GtkLabel>
        <GtkButton
            label="Done"
            onClicked={() => {
                navigation.goBack();
            }}
        />
    </GtkBox>
);

export const Notes = () => (
    <Stack.Navigator initialRouteName="List">
        <Stack.Screen name="List" component={List} options={{ title: "Notes" }} />
        <Stack.Screen name="Note" component={Note} options={({ route }) => ({ title: `Note ${route.params.id}` })} />
    </Stack.Navigator>
);
```

A screen renders one root widget. The navigator places it in a container that takes a single child, so a screen with several widgets wraps them in a `GtkBox`. `Stack.Screen` takes the screen as `component`, as a `children` render callback that receives the same `route` and `navigation`, or as `getComponent` for a lazy import; `initialParams` fills in params a `navigate` call leaves out.

`navigation.navigate` goes to a route, pushing it when it is not already on the stack. `push` always pushes a new page, `goBack` and `pop` pop one, `popTo` pops to a named route, `popToTop` returns to the first page, and `replace` swaps the current page. The same actions are available as `StackActions` for `navigation.dispatch`. Pushes and pops animate; `replace` and `reset` switch pages without a transition.

### Headers

Every page gets an `AdwHeaderBar` above its content, with the `title` option, which defaults to the route name, and Adwaita's back button. The header options shape it:

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

`headerTitle` replaces the title: a string becomes an `AdwWindowTitle`, an element is used as the title widget. `headerStart` and `headerEnd` pack widgets at either end of the bar. `headerBackVisible: false` hides the back button while leaving the page poppable, and `headerShown: false` removes the header bar altogether, which is the right choice for a screen that hosts another navigator. `header` replaces the whole bar; it receives `{ route, navigation, options, back }`, where `back` carries the title of the page below, when there is one:

```tsx
import { AdwHeaderBar, AdwWindowTitle } from "@gtkx/jsx/adw";

<Stack.Navigator
    screenOptions={{
        header: ({ options, route, back }) => (
            <AdwHeaderBar
                showBackButton={back !== undefined}
                titleWidget={<AdwWindowTitle title={options.title ?? route.name} subtitle={back?.title ?? ""} />}
            />
        ),
    }}
>
    <Stack.Screen name="List" component={List} />
    <Stack.Screen name="Note" component={Note} />
</Stack.Navigator>;
```

`screenOptions` on the navigator applies to every screen, as an object or as a callback that receives `{ route, navigation, theme }`; a screen's own `options` win over it.

### Native back controls

Users pop a page the way they pop any Adwaita page: the header bar's back button, Escape, Alt+Left, the mouse back button, and a swipe from the edge all work without wiring. `popOnEscape={false}` on the navigator turns the Escape key off, and `canPop: false` on a screen makes its page stay put against all of them. `animation: "none"` on a screen pushes and pops it without the transition.

A native pop dispatches `StackActions.pop()` through the navigator, so it takes the same route as `navigation.goBack()`, and `usePreventRemove` sees it. When a listener prevents the removal, the page slides back into place and the callback runs with the action that was attempted:

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

Dispatching the saved action carries the pop through: React Navigation marks the action it handed to the callback as already offered to this screen, so re-dispatching it skips the guard.

### Transition events

A stack screen emits `transitionStart` when its page starts showing or hiding and `transitionEnd` when the move is over; `data.closing` is `true` on the way out. Subscribe with `navigation.addListener` inside the screen, or with `listeners` on the screen element:

```tsx
<Stack.Screen
    name="Note"
    component={Note}
    listeners={{
        transitionEnd: ({ data }) => {
            if (!data.closing) {
                markAsRead();
            }
        },
    }}
/>;
```

The events fire at the page's own show and hide signals, so they follow the real transition, animated or not.

## Tab navigator

`createTabNavigator` renders its screens as pages of an `AdwViewStack`, switched from an `AdwViewSwitcher`. With the default `tabBarPosition` of `"top"` the switcher is the header bar's title widget; with `"bottom"` it is an `AdwViewSwitcherBar` below the content:

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

`tabBarLabel` is the switcher's label, defaulting to `title`, then to the route name; `tabBarIcon` is an icon name; `tabBarBadge` is the badge number, hidden at `0`; and `needsAttention` highlights the tab. `lazy`, on by default, mounts a screen the first time its tab is focused, so a heavy tab costs nothing until it is opened; `lazy: false` mounts it at startup. `animation: "fade"` crossfades between pages, and the default `"none"` switches instantly. `popToTopOnBlur` pops a nested stack back to its first screen when the tab loses focus. The router's `backBehavior` decides what `goBack` does across tabs, as in React Navigation.

Tabs share the stack's header options. `headerShown`, `headerStart`, and `headerEnd` apply to the focused tab's header bar, and a custom `header` receives `{ route, navigation, options, viewSwitcher }`, where `viewSwitcher` is the element to place in the bar when the switcher belongs at the top. With `headerShown: false` a top switcher stays as the top bar on its own. `headerTitle` is the bar's title widget, which is where a top switcher goes, so it replaces the switcher; set it only with `tabBarPosition="bottom"`, or place the switcher yourself in a custom `header`.

Selecting a tab emits `tabPress` before the switch, and `preventDefault` keeps the current tab:

```tsx
<Tabs.Screen
    name="Archive"
    component={Archive}
    listeners={{
        tabPress: (event) => {
            if (!isSignedIn) {
                event.preventDefault();
            }
        },
    }}
/>;
```

`navigation.navigate("Archive")` and `navigation.jumpTo("Archive")` switch tabs from code.

## Drawer navigator

`createDrawerNavigator` renders its screens beside a sidebar in an `AdwOverlaySplitView`. The sidebar lists the screens, the focused one selected, and the content header bar starts with a button that toggles the sidebar:

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

`drawerLabel` is the row's text, defaulting to `title`, then to the route name, and `drawerIcon` is the icon name shown next to it. `lazy` and `popToTopOnBlur` work as they do for tabs, and the header options shape the content's header bar in the same way.

`collapsed` makes the sidebar overlay the content instead of sitting beside it, and closes it after a row is activated; `pinSidebar` stops collapsing and uncollapsing from changing whether the sidebar is shown, leaving that to `defaultStatus` and the drawer actions. `sidebarPosition` puts it at the `"start"` or the `"end"`, and `minSidebarWidth`, `maxSidebarWidth`, and `sidebarWidthFraction` size it. The drawer starts open, or closed when `collapsed`; `defaultStatus` sets it explicitly. While it is not collapsed the sidebar is a pane rather than an overlay, so navigating leaves it in place and `goBack` from a screen never reopens it.

The drawer's open state is navigation state. `navigation.openDrawer()`, `closeDrawer()`, and `toggleDrawer()` on a drawer screen's navigation object change it, as does dispatching `DrawerActions.toggleDrawer()` from any screen nested below the drawer, and a user dragging or dismissing the sidebar dispatches the same actions back, so the split view and the state never disagree.

`drawerContent` replaces the whole sidebar. It receives `{ state, navigation, descriptors }`, and `DrawerItemList` renders the default list from those same props, so a custom sidebar can keep the list and add a header or footer around it:

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

`createSplitViewNavigator` renders an `AdwNavigationSplitView`: a sidebar of data beside a stack of content pages, the master and detail layout of Adwaita's own list applications, folded into a single pane on a window too narrow for two. The first screen declared is the sidebar and stays in its pane; every other screen is a page of the content stack, drawn by the same `AdwNavigationView` the stack navigator uses:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { AdwStatusPage } from "@gtkx/jsx/adw";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { createSplitViewNavigator, type SplitViewScreenProps } from "@gtkx/navigation";

type MailParams = { Folders: undefined; Messages: { folder: string }; Message: { id: string } };

const Split = createSplitViewNavigator<MailParams>();

const Folders = ({ navigation }: SplitViewScreenProps<MailParams, "Folders">) => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL}>
        <GtkButton
            label="Inbox"
            onClicked={() => {
                navigation.navigate("Messages", { folder: "inbox" });
            }}
        />
        <GtkButton
            label="Archive"
            onClicked={() => {
                navigation.navigate("Messages", { folder: "archive" });
            }}
        />
    </GtkBox>
);

const Messages = ({ route, navigation }: SplitViewScreenProps<MailParams, "Messages">) => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL}>
        <GtkLabel>{`Messages in ${route.params.folder}`}</GtkLabel>
        <GtkButton
            label="Open the first one"
            onClicked={() => {
                navigation.navigate("Message", { id: "1" });
            }}
        />
        <GtkButton
            label="Clear selection"
            onClicked={() => {
                navigation.goBack();
            }}
        />
    </GtkBox>
);

const Message = ({ route }: SplitViewScreenProps<MailParams, "Message">) => (
    <GtkLabel>{`Message ${route.params.id}`}</GtkLabel>
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

Selecting something in the sidebar is a `navigate` to a content route carrying the selection as params. In this navigator `navigate` selects: it returns to the named route with the new params and drops whatever sat above it, so picking a second folder swaps what the content pane shows instead of piling a page on top of it, and it opens a route that is not on the stack yet by pushing it. Use `push` where a second copy of a page is the point. The sidebar route is pinned at the bottom of the stack, so `pop`, `popToTop`, `replace`, and `reset` reach only the content pages and the sidebar never leaves; `goBack` from the first content page empties the content stack and brings the placeholder back.

`contentPlaceholder` is what fills the content pane while no content route is open, which is where the navigator starts. `AdwStatusPage` is the Adwaita convention for that state, an icon over a title and a line of explanation, centered in the pane.

The screen options are the stack's, and they mean the same thing here. `title` names the page and its header bar, `headerTitle`, `headerStart`, and `headerEnd` shape that bar, `header` replaces it, `headerShown: false` removes it, `headerBackVisible: false` hides its back button, `canPop: false` keeps a content page in place, and `animation: "none"` drops its transition. The sidebar gets a header bar of its own from its options, without a back button. Content pages emit `transitionStart` and `transitionEnd` the way stack pages do, with `data.closing` set on the way out, for the pushes and pops within the content stack. The first selection is not one of those: it fills an empty pane rather than moving between pages, so it reports no transition.

`collapsed` folds the two panes into one, and Adwaita decides when from an `AdwBreakpoint` on the window:

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
                    onApply={() => {
                        setIsNarrow(true);
                    }}
                    onUnapply={() => {
                        setIsNarrow(false);
                    }}
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

Once collapsed, libadwaita holds both panes in one navigation view, so the back button and Escape at the first content page return to the sidebar in a single press rather than stepping through an empty pane. The navigator hears the split view giving up its content and pops the stack to match, which is all the narrow case needs.

`minSidebarWidth`, `maxSidebarWidth`, and `sidebarWidthFraction` size the sidebar pane, `sidebarPosition` puts it at the `"start"` or the `"end"`, and `popOnEscape={false}` turns the Escape key off for the content pages as it does for a stack. `initialRouteName` naming a content screen opens that screen at startup, with the sidebar underneath it, in place of the placeholder.

Focus follows the stack rather than the panes. Side by side, the focused route is the open content page, so `useIsFocused` in the sidebar reads `false` while its widgets sit in plain view, and a `useFocusEffect` there stops as soon as something is selected. A sidebar that reloads itself watches its data, or `useNavigationState`, instead of its own focus.

The drawer navigator answers a different question. Its sidebar is a list of the navigator's own screens and overlays the content once the window is narrow, so it moves between an app's top level sections; the split view's sidebar is a screen with its own widgets and its own state, in a pane that collapses into the content rather than covering it, so it pairs a list with whatever that list selects.

## Nesting navigators

A navigator is a single widget, so it is a valid screen of another navigator. The usual shape is a drawer or tabs at the root and a stack inside each section. Each navigator draws its own header bar, so set `headerShown: false` on the screen that hosts the nested one, and only the inner bar shows:

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

Hiding the drawer's header bar hides its toggle button too. The stack's pages put their own in `headerStart`, dispatching `DrawerActions.toggleDrawer()`, which bubbles up from the stack to the drawer:

```tsx
import { GtkButton } from "@gtkx/jsx/gtk";
import { DrawerActions } from "@gtkx/navigation";

<Stack.Navigator
    screenOptions={({ navigation }) => ({
        headerStart: (
            <GtkButton
                iconName="sidebar-show-symbolic"
                onClicked={() => {
                    navigation.dispatch(DrawerActions.toggleDrawer());
                }}
            />
        ),
    })}
>
    <Stack.Screen name="List" component={List} />
    <Stack.Screen name="Note" component={Note} />
</Stack.Navigator>;
```

Navigating into a nested navigator takes the `NavigatorScreenParams` form: `navigation.navigate("Notes", { screen: "Note", params: { id: "42" } })`.

## Hooks

The hooks come from `@react-navigation/core` and work unchanged. `useNavigation` returns the navigation object of the nearest screen, `useRoute` its route, `useIsFocused` whether that screen is the focused one, and `useFocusEffect` runs an effect while it is, cleaning up when it loses focus, so a screen can poll only while it is on screen:

```tsx
import { useFocusEffect } from "@gtkx/navigation";
import { useCallback } from "react";

const Inbox = () => {
    useFocusEffect(
        useCallback(() => {
            const timer = setInterval(refresh, 30_000);

            return () => {
                clearInterval(timer);
            };
        }, []),
    );

    return <Messages />;
};
```

`useNavigationState` selects from the navigator's state, and `usePreventRemove` is the guard shown above. `useTheme` returns the container's theme, `{ dark, highContrast }` by default, and re-renders when Adwaita's style manager changes, which is where a screen picks a symbolic icon variant or a color for a drawing.

## Static configuration

React Navigation's static API describes the tree as an object, and `createStaticNavigation` turns it into a component that renders a `NavigationContainer` around it. Params are inferred from each screen's `route.params` prop type:

```tsx
import type { StaticScreenProps } from "@gtkx/navigation";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { createStackNavigator, createStaticNavigation } from "@gtkx/navigation";

const Note = ({ route }: StaticScreenProps<{ id: string }>) => <GtkLabel>{`Note ${route.params.id}`}</GtkLabel>;

const RootStack = createStackNavigator({
    initialRouteName: "List",
    screens: {
        List: { screen: List, options: { title: "Notes" } },
        Note,
    },
});

const Navigation = createStaticNavigation(RootStack);

export const App = () => <Navigation onReady={() => console.log("ready")} />;
```

`Navigation` takes the container's props. `createStackScreen`, `createTabScreen`, `createDrawerScreen`, and `createSplitViewScreen` declare one screen's config with the matching navigator's options typed, for a tree assembled across modules.

## Typing the root param list

`useNavigation()`, a container `ref`, and the static API's `navigate` calls are typed against the root param list, which is empty until the app declares it: with nothing declared, `navigate` from `useNavigation()` accepts no route name at all. Declare it once through the `RootNavigator` interface, as the React Navigation docs describe:

```ts
import { createStackNavigator } from "@gtkx/navigation";

type RootParams = { List: undefined; Note: { id: string } };

const RootStack = createStackNavigator<RootParams>();

type RootStackType = typeof RootStack;

declare module "@react-navigation/core" {
    interface RootNavigator extends RootStackType {}
}
```

The augmentation names `@react-navigation/core` because that is the module declaring the interface. It works for a navigator created with the static API too, where the param list is inferred from the `screens`. A screen that belongs to one nested navigator names that navigator's param list instead, `useNavigation<StackNavigationProp<NotesParams>>()`, and a screen component typed with `StackScreenProps`, `TabScreenProps`, `DrawerScreenProps`, or `SplitViewScreenProps` already has its `navigation` and `route` typed without either.

## Testing

Navigation tests drive the widgets the way a user does. `render` from `@gtkx/testing` disables animations unless it is given `areAnimationsEnabled: true`, so a push or a pop is complete as soon as the click resolves, and only the visible page is mapped: query it with `findByText`, and assert the one that left with `queryByText` returning `null`. The back button answers to the role `BUTTON` and the name `Back`; a view switcher's tabs answer to the role `TAB` and their label:

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

it("switches tabs from the view switcher", async () => {
    await render(
        <NavigationContainer>
            <Mail unread={0} />
        </NavigationContainer>,
    );

    await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.TAB, { name: "Archived" }));
    await screen.findByText("Nothing archived");
});
```

`userEvent.keyboard(widget, "{Escape}")` pops a page the way the key does, and a container `ref` inside `act` drives navigation imperatively when no button is involved.

## Next

Continue with [CSS](/guide/css) to style these pages with the `style` prop and GTK4's own CSS engine.
