---
title: "GTKX 1.4: Introducing @gtkx/navigation"
description: "GTKX 1.4 adds @gtkx/navigation, React Navigation 7's core rendered with native libadwaita stack, tab, drawer, and split view navigators. Routes and params stay typed, while native back controls, adaptive layouts, hooks, actions, and static configuration all share one navigation state."
image: /tasks-screenshot.png
---

# GTKX 1.4

<p class="post-date">August 25, 2026</p>

GTKX 1.4 is out. The headline is [`@gtkx/navigation`](/guide/navigation), React Navigation rendered by native libadwaita widgets, with stack, tab, drawer, and adaptive split view navigators. The release also adds opt-in resource and icon imports, controlled list-box selection, explicit minimum library versions for packages, and another round of native-boundary fixes. Read the [`changelog`](https://github.com/gtkx-org/gtkx/releases/tag/v1.4.0) for the full list of changes.

<picture>
  <source srcset="/tasks-screenshot.webp" type="image/webp" />
  <img src="/tasks-screenshot.png" width="900" height="600" loading="lazy" alt="The Tasks app: an adaptive Adwaita window with a sidebar of smart views and colored user lists on the left, and a boxed task list on the right." />
</picture>

*The tutorial's Tasks app now expresses its sidebar, content, and task detail as one `createSplitViewNavigator` tree.*

## React Navigation, drawn by Adwaita

React Navigation has a useful split at its center. The core owns routes, params, actions, events, focus, nesting, state persistence, and the static and dynamic configuration APIs. A renderer decides what those ideas look like on a platform.

`@gtkx/navigation` supplies that renderer for GTK. There is no React Native in the package:

- `createStackNavigator` renders an `AdwNavigationView`.
- `createTabNavigator` renders an `AdwViewStack` with an `AdwViewSwitcher` or `AdwViewSwitcherBar`.
- `createDrawerNavigator` renders an `AdwOverlaySplitView`.
- `createSplitViewNavigator` renders an `AdwNavigationSplitView` with a navigation stack in its content pane.

That means the navigation state follows React Navigation while every visible control follows the GNOME platform. Pages use Adwaita's transitions. Header bars use its back buttons. Tabs have view-switcher accessibility. A drawer can become an overlay, and a master/detail view can fold to one pane at a breakpoint.

Install the package separately:

```bash
npm install @gtkx/navigation
```

The renderer needs libadwaita bindings, so an app scaffolded with GTK alone adds `Adw-1` and lets codegen refresh the store:

```diff
 export default defineConfig({
-    libraries: ["Gtk-4.0"],
+    libraries: ["Gtk-4.0", "Adw-1"],
     applicationId: "com.example.notes",
 });
```

## One typed navigation tree

Routes are typed once, where the navigator is created. A screen receives the matching route params and navigation object, and calls to `navigate` are checked against the same map:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { createStackNavigator, NavigationContainer, type StackScreenProps } from "@gtkx/navigation";

type NotesParams = { List: undefined; Note: { id: string } };

const Stack = createStackNavigator<NotesParams>();

const List = ({ navigation }: StackScreenProps<NotesParams, "List">) => (
    <GtkButton
        label="Open note 42"
        onClicked={() => {
            navigation.navigate("Note", { id: "42" });
        }}
    />
);

const Note = ({ route }: StackScreenProps<NotesParams, "Note">) => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL}>
        <GtkLabel>{`Showing note ${route.params.id}`}</GtkLabel>
    </GtkBox>
);

export const Notes = () => (
    <NavigationContainer>
        <Stack.Navigator>
            <Stack.Screen name="List" component={List} options={{ title: "Notes" }} />
            <Stack.Screen name="Note" component={Note} options={{ title: "Note" }} />
        </Stack.Navigator>
    </NavigationContainer>
);
```

`NavigationContainer` owns the root state and accepts the React Navigation container API: `initialState`, `onStateChange`, `onReady`, and refs for navigation from a menu action or notification. The package re-exports `@react-navigation/core`, so `useNavigation`, `useRoute`, `useIsFocused`, `useFocusEffect`, `usePreventRemove`, actions, route types, and container refs all come from the same import as the navigators.

The dynamic JSX API above is not the only shape. React Navigation's static configuration works too, including inferred params, with `createStaticNavigation` turning the declared tree into a component.

## Native back is still navigation

A stack page can leave through `navigation.goBack()`, but users do not need an app-specific button. The header bar's back button, Escape, Alt+Left, a mouse back button, and Adwaita's edge swipe all pop the same route.

The native view and the router stay synchronized in both directions. When a native gesture starts a pop, it dispatches through React Navigation first. `usePreventRemove` can stop it and show a discard dialog; dispatching the action saved by that callback carries the page through. Transition events come from the page's actual show and hide signals, so they describe the animation on screen rather than a timer beside it.

Screen options shape native headers. `title` names the page, `headerStart` and `headerEnd` pack widgets into its `AdwHeaderBar`, `headerShown` removes it for a screen hosting a nested navigator, and `header` replaces it entirely. The stack also exposes `push`, `replace`, `pop`, `popTo`, and `popToTop`, along with `StackActions` for dispatch outside a stack screen.

## Tabs and drawers keep their platform behavior

Tabs are pages of an `AdwViewStack`, not buttons made to resemble tabs. Put the switcher in the header or in an `AdwViewSwitcherBar` below the content, choose an icon and badge per screen, and mount a lazy screen only when it is first opened. A `tabPress` event can prevent a switch, and `popToTopOnBlur` resets a nested stack when its tab loses focus.

The drawer uses an `AdwOverlaySplitView`, with screen routes in its sidebar and the active screen in its content pane. `collapsed` turns the sidebar from a fixed pane into an overlay; `openDrawer`, `closeDrawer`, `toggleDrawer`, and `DrawerActions` update the same state that a swipe or sidebar dismissal updates. `drawerContent` can replace the sidebar while `DrawerItemList` keeps the default route list inside a custom shell.

Navigators nest as single widgets. A drawer or tab screen can host a stack, and the outer screen hides its header so only the inner page's header remains. Actions bubble through the tree, which is why a stack page can dispatch `DrawerActions.toggleDrawer()` without reaching through widget refs.

## A split view is more than a drawer

`createSplitViewNavigator` models the master/detail layout used throughout GNOME. Its first screen is the sidebar; every other screen belongs to the content stack. Navigating from a folder list to `Messages` selects that route and its params, pushing it when it is absent and returning to it when it is already below the current detail page. Popping the first content route reveals a `contentPlaceholder` rather than removing the sidebar.

An `AdwBreakpoint` drives the navigator's `collapsed` prop. Side by side, the sidebar and focused content route occupy separate panes. Folded, Adwaita combines them into one navigation view, and Back returns from the first content page to the sidebar in one native transition. The route state stays the same model in either layout; the window changing width does not require a second navigation system.

That is now how the [GTKX tutorial](/tutorial/) builds Tasks. Its selected smart view or user list is a content route with params, an open task is the next page, and the sidebar's highlight is derived from navigation state. The same tree works wide, narrow, under keyboard shortcuts, and in tests.

## Test what the user can reach

Navigation does not need navigator-specific test machinery. [`@gtkx/testing`](/guide/testing) clicks the visible header button, list row, or tab, types into the screen, or sends Escape to the window. A push or pop is complete immediately under the default test render because animations are disabled, so the assertion is simply what has appeared and what is no longer mapped.

The [`navigation`](https://github.com/gtkx-org/gtkx/tree/main/examples/navigation) example is a small mail-style app that nests a drawer, a stack, and tabs. Its tests open a message, start a reply, attempt to leave it, answer the discard dialog, switch drawer sections and tabs, and toggle Adwaita's color scheme through the same controls a user sees.

## Also in 1.4

The new `future.v2ResourceImports` flag moves application data into the module graph. A relative `?resource` import bundles a file and returns its GResource path, `?icon` bundles an SVG, PNG, or XPM into the application's private icon theme and returns its icon name, and `?url` is for an API that needs a real file. Settings schemas remain query-free relative imports. Development refreshes the registered resource bundle as those files change, while a production build emits and registers `gtkx.gresource` beside the app. New projects start with the flag on; the [configuration guide](/guide/configuration-and-codegen) covers the migration from `#data/*`.

Application icons move to the top-level `applicationIcon` config, shared by development, builds, and every deployment target. It accepts one image or a full icon-theme tree, preserving symbolic and size variants through packaging. When the option is absent, GTKX uses an application-ID-named SVG, PNG, or XPM from the project root only when exactly one matches.

`GtkListBox` gains a controlled `selectedIndex` prop. An index selects that row, and `-1` or `null` clears the selection. GTKX waits until children exist, suppresses the `row-selected` caused by its own write, and restores the requested selection if the widget drifts, which lets a sidebar derive its highlight directly from the active route.

For packaged applications, `deploy.minimumLibraryVersions` can write explicit Debian and RPM constraints such as `libgtk-4-1 (>= 4.14)` and `gtk4 >= 4.14`. Codegen records the expanded library inventory so a skipped deploy build still knows which libraries the app actually bound.

At the native boundary, struct field descriptors can be bound once and reused, borrowed callback structs now point at the caller's value only for the lifetime of that call, signal and property names with escaped or digit-boundary spellings resolve correctly, and a GTKX prop write suppresses only its own `notify` rather than secondary property changes the widget emits in reaction.

## Upgrading

There are a few migrations outside the opt-in resource flag.

`deploy.icons` has moved beside `applicationId` as `applicationIcon`. A project that relied on 1.3's implicit `data/icons` directory must now set `applicationIcon: "data/icons"` or put exactly one `<applicationId>.svg`, `.png`, or `.xpm` in the project root. Multiple root matches require an explicit choice, and deploying without an icon still fails.

Automatic Debian and RPM mappings remain for GTK and libadwaita; dependencies for GtkSourceView, WebKitGTK, and other GIR libraries now belong in `deploy.depends`, where the project can name the right distribution packages instead of GTKX guessing them. A deployment using `--skip-build` must rebuild once: the build metadata containing packages and schemas has changed in 1.4.

`GtkApplication` and `AdwApplication` now default `resourceBasePath` to the resource tree derived from the `applicationId` in `gtkx.config.ts`. If the application element overrides `applicationId`, also pass `resourceBasePath` when it should use a different resource tree.

Signal keys passed to `registerClass({ signals })` must now use GLib's lowercase spelling. Rename `dataChanged` to `data-changed` or `data_changed`; the corresponding JavaScript default-handler method remains `onDataChanged`.

Cairo no longer exports allocation-sensitive entry points whose ownership cannot be represented safely: `ScaledFont.textToGlyphs`, `FontFace.createForFtFace`, `FontFace.createForPattern`, `Surface.mapToImage`, and `Surface.unmapImage`. Use PangoCairo for shaping and rich text layout, and modify surfaces by drawing through a `Context`.

A struct or boxed value lent to a callback now aliases the native caller's memory. Mutating it during the callback reaches the caller, and accessing it after the callback returns throws. Code that kept one of those wrappers beyond the call should copy the data it needs while the callback is active.

## What's next

The next package on the [roadmap](https://github.com/orgs/gtkx-org/projects/1) is [`@gtkx/forms`](https://github.com/gtkx-org/gtkx/issues/480), bringing React Hook Form's state model to Adwaita form controls. If something else would help more, the [issue tracker](https://github.com/gtkx-org/gtkx/issues) is where it gets argued about.
