import type { NavigationState } from "@react-navigation/core";
import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkImage, GtkLabel, GtkListBox } from "@gtkx/jsx/gtk";
import { CommonActions } from "@react-navigation/core";
import { useCallback } from "react";
import type { DrawerContentProps, DrawerDescriptor, DrawerNavigationHelpers } from "./types.js";
import { requireDescriptor } from "../shared/routes.js";

type RowActivated = (row: Gtk.ListBoxRow) => void;

const didNavigateToRow = (navigation: DrawerNavigationHelpers, state: NavigationState, rowIndex: number): boolean => {
    const route = state.routes[rowIndex];

    if (route === undefined) {
        return false;
    }

    const event = navigation.emit({ type: "drawerItemPress", target: route.key, canPreventDefault: true });

    if (event.defaultPrevented) {
        return false;
    }

    navigation.dispatch({ ...CommonActions.navigate(route.name, route.params), target: state.key });

    return true;
};

const useDrawerItemPress = (navigation: DrawerNavigationHelpers): RowActivated =>
    useCallback((row: Gtk.ListBoxRow) => {
        const state = navigation.getState();
        didNavigateToRow(navigation, state, row.getIndex());
    }, [navigation]);

const DrawerItem = ({ descriptor }: { descriptor: DrawerDescriptor }): ReactNode => {
    const { route, options } = descriptor;

    return (
        <GtkBox spacing={12}>
            {options.drawerIcon === undefined ? null : <GtkImage iconName={options.drawerIcon} />}
            <GtkLabel label={options.drawerLabel ?? options.title ?? route.name} xalign={0} />
        </GtkBox>
    );
};

/** Lists the drawer routes as rows of a `GtkListBox`; activating a row navigates to its route. */
const DrawerItemList = ({ state, navigation, descriptors }: DrawerContentProps): ReactNode => {
    const onRowActivated = useDrawerItemPress(navigation);

    return (
        <GtkListBox
            cssClasses={["navigation-sidebar"]}
            selectedIndex={state.index}
            selectionMode={Gtk.SelectionMode.SINGLE}
            onRowActivated={onRowActivated}
        >
            {state.routes.map((route) => (
                <DrawerItem key={route.key} descriptor={requireDescriptor(descriptors, route.key)} />
            ))}
        </GtkListBox>
    );
};

export { DrawerItemList };
