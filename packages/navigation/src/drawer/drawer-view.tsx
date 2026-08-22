import type * as Adw from "@gtkx/gi/adw";
import type { DrawerNavigationState, ParamListBase } from "@react-navigation/core";
import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import {
    AdwHeaderBar,
    AdwOverlaySplitView,
    AdwToolbarView,
    AdwViewStack,
    AdwWindowTitle,
} from "@gtkx/jsx/adw";
import { GtkButton, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { DrawerActions } from "@react-navigation/core";
import { useCallback, useEffect, useRef } from "react";
import type {
    DrawerContentProps,
    DrawerDescriptor,
    DrawerDescriptorMap,
    DrawerNavigationConfig,
    DrawerNavigationHelpers,
} from "./types.js";
import { HeaderBar } from "../shared/header-bar.js";
import { getFocusedRoute, requireDescriptor } from "../shared/routes.js";
import { ScenePage } from "../shared/scene-page.js";
import { useLoadedRoutes } from "../shared/use-loaded-routes.js";
import { usePopToTopOnBlur } from "../shared/use-pop-to-top-on-blur.js";
import { DrawerCollapsedContext } from "./drawer-collapsed-context.js";
import { DrawerItemList } from "./drawer-item-list.js";
import { getDrawerStatus } from "./drawer-status.js";

type DrawerViewProps = DrawerNavigationConfig & {
    state: DrawerNavigationState<ParamListBase>;
    navigation: DrawerNavigationHelpers;
    descriptors: DrawerDescriptorMap;
};

type DrawerHeaderProps = {
    descriptor: DrawerDescriptor;
    navigation: DrawerNavigationHelpers;
};

type DrawerPageProps = {
    descriptor: DrawerDescriptor;
    isLoaded: boolean;
};

const PACK_TYPES = { start: Gtk.PackType.START, end: Gtk.PackType.END } as const;

const useSidebarSync = (navigation: DrawerNavigationHelpers): ((isShown: boolean | null) => void) =>
    useCallback((isShown: boolean | null) => {
        const current = navigation.getState();
        const isOpen = getDrawerStatus(current) === "open";

        if (isShown === null || isShown === isOpen) {
            return;
        }

        const action = isShown ? DrawerActions.openDrawer() : DrawerActions.closeDrawer();
        navigation.dispatch({ ...action, target: current.key });
    }, [navigation]);

const useCloseOnNavigate = (
    state: DrawerNavigationState<ParamListBase>,
    navigation: DrawerNavigationHelpers,
    isCollapsed: boolean,
): void => {
    const focusedKey = getFocusedRoute(state).key;
    const previousKeyRef = useRef(focusedKey);

    useEffect(() => {
        const hasChanged = previousKeyRef.current !== focusedKey;
        previousKeyRef.current = focusedKey;

        if (hasChanged && isCollapsed && getDrawerStatus(navigation.getState()) === "open") {
            navigation.dispatch({ ...DrawerActions.closeDrawer(), target: navigation.getState().key });
        }
    }, [focusedKey, isCollapsed, navigation]);
};

const DrawerContent = (props: DrawerContentProps): ReactNode => (
    <AdwToolbarView topBar={<AdwHeaderBar />}>
        <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.NEVER}>
            <DrawerItemList {...props} />
        </GtkScrolledWindow>
    </AdwToolbarView>
);

const DrawerToggle = ({ navigation }: { navigation: DrawerNavigationHelpers }): ReactNode => (
    <GtkButton
        iconName="sidebar-show-symbolic"
        tooltipText="Toggle Sidebar"
        accessibleLabel="Toggle Sidebar"
        onClicked={() => {
            navigation.dispatch(DrawerActions.toggleDrawer());
        }}
    />
);

const DrawerHeader = ({ descriptor, navigation }: DrawerHeaderProps): ReactNode => {
    const { route, options } = descriptor;

    if (options.headerShown === false) {
        return null;
    }

    if (options.header !== undefined) {
        return <>{options.header({ route, navigation: descriptor.navigation, options })}</>;
    }

    return (
        <HeaderBar
            options={options}
            start={<DrawerToggle navigation={navigation} />}
            titleWidget={<AdwWindowTitle title={options.title ?? route.name} />}
        />
    );
};

const DrawerPage = ({ descriptor, isLoaded }: DrawerPageProps): ReactNode => {
    const { route, options } = descriptor;

    return (
        <ScenePage
            name={route.key}
            title={options.title ?? route.name}
            isLoaded={isLoaded || options.lazy === false}
            render={() => descriptor.render()}
        />
    );
};

const DrawerView = ({ state, navigation, descriptors, drawerContent, ...config }: DrawerViewProps): ReactNode => {
    const { collapsed = false, sidebarPosition = "start", pinSidebar, minSidebarWidth, maxSidebarWidth } = config;
    const viewRef = useRef<Adw.OverlaySplitView | null>(null);
    const focused = getFocusedRoute(state);
    const descriptor = requireDescriptor(descriptors, focused.key);
    const loaded = useLoadedRoutes(focused.key, state.preloadedRouteKeys);
    const onShowSidebarChanged = useSidebarSync(navigation);
    const contentProps = { state, navigation, descriptors };
    const sidebar = drawerContent === undefined ? <DrawerContent {...contentProps} /> : drawerContent(contentProps);
    usePopToTopOnBlur(state, descriptors, navigation);
    useCloseOnNavigate(state, navigation, collapsed);

    useEffect(() => {
        const view = viewRef.current;

        if (view !== null) {
            onShowSidebarChanged(view.getShowSidebar());
        }
    }, [collapsed, onShowSidebarChanged]);

    return (
        <DrawerCollapsedContext value={collapsed}>
            <AdwOverlaySplitView
                ref={viewRef}
                collapsed={collapsed}
                showSidebar={getDrawerStatus(state) === "open"}
                sidebarPosition={PACK_TYPES[sidebarPosition]}
                pinSidebar={pinSidebar}
                minSidebarWidth={minSidebarWidth}
                maxSidebarWidth={maxSidebarWidth}
                sidebarWidthFraction={config.sidebarWidthFraction}
                onNotifyShowSidebar={onShowSidebarChanged}
                sidebar={<>{sidebar}</>}
            >
                <AdwToolbarView topBar={<DrawerHeader descriptor={descriptor} navigation={navigation} />}>
                    <AdwViewStack visibleChildName={focused.key}>
                        {state.routes.map((route) => (
                            <DrawerPage
                                key={route.key}
                                descriptor={requireDescriptor(descriptors, route.key)}
                                isLoaded={loaded.has(route.key)}
                            />
                        ))}
                    </AdwViewStack>
                </AdwToolbarView>
            </AdwOverlaySplitView>
        </DrawerCollapsedContext>
    );
};

export { DrawerView };
