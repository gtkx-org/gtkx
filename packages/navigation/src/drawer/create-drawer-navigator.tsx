import type {
    DrawerActionHelpers,
    DrawerNavigationState,
    DrawerRouterOptions,
    NavigatorTypeBagBase,
    ParamListBase,
    StaticConfig,
    StaticScreenFactory,
    TypedNavigator,
} from "@react-navigation/core";
import type { ReactNode } from "react";
import { createNavigatorFactory, createScreenFactory, useNavigationBuilder } from "@react-navigation/core";
import { useEffect, useState } from "react";
import type { DrawerRouterFactory } from "./drawer-router.js";
import type {
    DrawerNavigationEventMap,
    DrawerNavigationOptions,
    DrawerNavigationProp,
    DrawerNavigatorProps,
} from "./types.js";
import { createDrawerRouter } from "./drawer-router.js";
import { DrawerView } from "./drawer-view.js";

/** Type bag describing the drawer navigator to React Navigation's typed APIs. */
type DrawerTypeBag<
    ParamList extends ParamListBase = ParamListBase,
    NavigatorID extends string | undefined = string | undefined,
> = {
    /** Route names and their params. */
    ParamList: ParamList;
    /** Optional navigator id. */
    NavigatorID: NavigatorID;
    /** Shape of the navigator state. */
    State: DrawerNavigationState<ParamList>;
    /** Per-screen options. */
    ScreenOptions: DrawerNavigationOptions;
    /** Events the navigator emits. */
    EventMap: DrawerNavigationEventMap;
    /** Navigation object per route. */
    NavigationList: {
        [RouteName in keyof ParamList]: DrawerNavigationProp<ParamList, RouteName, NavigatorID>;
    };
    /** The navigator component. */
    Navigator: typeof DrawerNavigator;
};

/** Declares a typed screen of a drawer navigator for the static configuration API. */
const createDrawerScreen: StaticScreenFactory<DrawerTypeBag> = createScreenFactory<DrawerTypeBag>();

const useDrawerRouter = (isCollapsed: boolean): DrawerRouterFactory => {
    const [flag] = useState(() => {
        let isCurrent = isCollapsed;

        return {
            read: () => isCurrent,
            update: (isNext: boolean) => {
                isCurrent = isNext;
            },
        };
    });

    const [createRouter] = useState(() => createDrawerRouter(flag.read));

    useEffect(() => {
        flag.update(isCollapsed);
    }, [flag, isCollapsed]);

    return createRouter;
};

/** Renders the screens of a {@link createDrawerNavigator} beside a sidebar in an `AdwOverlaySplitView`. */
function DrawerNavigator({
    drawerContent,
    collapsed,
    sidebarPosition,
    pinSidebar,
    minSidebarWidth,
    maxSidebarWidth,
    sidebarWidthFraction,
    defaultStatus,
    ...options
}: DrawerNavigatorProps): ReactNode {
    const createRouter = useDrawerRouter(collapsed === true);

    const { state, descriptors, navigation, NavigationContent } = useNavigationBuilder<
        DrawerNavigationState<ParamListBase>,
        DrawerRouterOptions,
        DrawerActionHelpers<ParamListBase>,
        DrawerNavigationOptions,
        DrawerNavigationEventMap
    >(createRouter, { ...options, defaultStatus: defaultStatus ?? (collapsed === true ? "closed" : "open") });

    return (
        <NavigationContent>
            <DrawerView
                state={state}
                navigation={navigation}
                descriptors={descriptors}
                drawerContent={drawerContent}
                collapsed={collapsed}
                sidebarPosition={sidebarPosition}
                pinSidebar={pinSidebar}
                minSidebarWidth={minSidebarWidth}
                maxSidebarWidth={maxSidebarWidth}
                sidebarWidthFraction={sidebarWidthFraction}
            />
        </NavigationContent>
    );
}

/** Creates a drawer navigator rendered with `AdwOverlaySplitView`: a sidebar listing the screens beside the content. */
function createDrawerNavigator<
    const ParamList extends ParamListBase,
    const NavigatorID extends string | undefined = string | undefined,
    const TypeBag extends NavigatorTypeBagBase = DrawerTypeBag<ParamList, NavigatorID>,
    const Config extends StaticConfig<TypeBag> | undefined = undefined,
>(config?: Config): TypedNavigator<TypeBag, Config> {
    return createNavigatorFactory(DrawerNavigator)(config) as TypedNavigator<TypeBag, Config>;
}

export { createDrawerNavigator, createDrawerScreen, DrawerNavigator, type DrawerTypeBag };
