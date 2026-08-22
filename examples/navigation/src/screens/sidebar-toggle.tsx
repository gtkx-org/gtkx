import type { ReactNode } from "react";
import { GtkButton } from "@gtkx/jsx/gtk";
import { DrawerActions, useNavigation } from "@gtkx/navigation";

const SidebarToggle = (): ReactNode => {
    const navigation = useNavigation();

    return (
        <GtkButton
            iconName="sidebar-show-symbolic"
            tooltipText="Toggle Sidebar"
            accessibleLabel="Toggle Sidebar"
            onClicked={() => {
                navigation.dispatch(DrawerActions.toggleDrawer());
            }}
        />
    );
};

export { SidebarToggle };
