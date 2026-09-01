---
title: "Navigation"
description: "Build typed native navigation with React Navigation."
---

# Navigation

`@gtkx/navigation` renders React Navigation 7 with libadwaita widgets.

```bash
npm install @gtkx/navigation
```

Choose a stack for drill-down screens, tabs for a few peers, a drawer for many top-level sections, or a split view for master-detail navigation. Start with a stack unless the information architecture requires persistent peers or panes.

## Build a typed stack

Mount one `NavigationContainer` inside the application window, then define route parameters once:

```tsx
import { GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { NavigationContainer, createStackNavigator, type StackScreenProps } from "@gtkx/navigation";

type Routes = { List: undefined; Note: { id: string } };
const Stack = createStackNavigator<Routes>();

const List = ({ navigation }: StackScreenProps<Routes, "List">) => (
    <GtkButton label="Open note" onClicked={() => navigation.navigate("Note", { id: "42" })} />
);

const Note = ({ route }: StackScreenProps<Routes, "Note">) => <GtkLabel label={`Note ${route.params.id}`} />;

const Notes = () => (
    <NavigationContainer>
        <Stack.Navigator initialRouteName="List">
            <Stack.Screen name="List" component={List} options={{ title: "Notes" }} />
            <Stack.Screen name="Note" component={Note} />
        </Stack.Navigator>
    </NavigationContainer>
);
```

Each screen renders one root widget. Native Back controls, Escape, Alt+Left, mouse buttons, and edge gestures follow the same pop path. Use `usePreventRemove` for unsaved work.

## Adapt and compose

Drive drawer or split-view `collapsed` from an `AdwBreakpoint`; the [adaptive navigation tutorial](/tutorial/an-adaptive-layout) shows the pattern. Nest navigators as screens, hide the outer header, and type child routes with `NavigatorScreenParams`.

Use `initialState` and `onStateChange` to persist navigation state. A container ref is appropriate for application actions and notifications outside the React tree; user interactions should normally call the screen's `navigation` object.

Test through visible controls and native Back behavior. The [navigation reference](/reference/@gtkx/navigation/) documents navigator options, hooks, events, and actions; React Navigation's [nesting guide](https://reactnavigation.org/docs/nesting-navigators/) covers the shared model.
