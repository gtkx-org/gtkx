import type {
    NavigatorTypeBagBase,
    ParamListBase,
    StaticConfig,
    StaticScreenFactory,
    TypedNavigator,
} from "@react-navigation/core";
import type { ReactNode } from "react";
import * as Adw from "@gtkx/gi/adw";
import { createNavigatorFactory, createScreenFactory, useNavigationBuilder } from "@react-navigation/core";
import { useState } from "react";
import type {
    TabViewActionHelpers,
    TabViewNavigationEventMap,
    TabViewNavigationOptions,
    TabViewNavigationProp,
    TabViewNavigationState,
    TabViewNavigatorProps,
    TabViewRouterOptions,
} from "./types.js";
import { readExistingTabs } from "./page-registry.js";
import { TabViewHost } from "./tab-view-host.js";
import { createTabViewRouter } from "./tab-view-router.js";

/** Type bag describing the tab view navigator to React Navigation's typed APIs. */
type TabViewTypeBag<
    ParamList extends ParamListBase = ParamListBase,
    NavigatorID extends string | undefined = string | undefined,
> = {
    /** Route names and their params. */
    ParamList: ParamList;
    /** Optional navigator id. */
    NavigatorID: NavigatorID;
    /** Shape of the navigator state. */
    State: TabViewNavigationState<ParamList>;
    /** Per-screen options. */
    ScreenOptions: TabViewNavigationOptions;
    /** Events the navigator emits. */
    EventMap: TabViewNavigationEventMap;
    /** Navigation object per route. */
    NavigationList: {
        [RouteName in keyof ParamList]: TabViewNavigationProp<ParamList, RouteName, NavigatorID>;
    };
    /** The navigator component. */
    Navigator: typeof TabViewNavigator;
};

/** Declares a typed screen of a tab view navigator for the static configuration API. */
const createTabViewScreen: StaticScreenFactory<TabViewTypeBag> = createScreenFactory<TabViewTypeBag>();

/** Renders each open route of a {@link createTabViewNavigator} as a page of an `Adw.TabView`. */
function TabViewNavigator({
    view: providedView,
    tabBarVisible,
    tabBarAutohide,
    tabBarExpand,
    tabBarInverted,
    overview,
    menuModel,
    extraDropTarget,
    onExtraDragDrop,
    onCreateWindow,
    onSetupMenu,
    shortcuts,
    defaultIcon,
    ...options
}: TabViewNavigatorProps): ReactNode {
    const [view] = useState(() => providedView ?? new Adw.TabView());
    const [router] = useState(() => createTabViewRouter(() => readExistingTabs(view)));
    const { state, descriptors, navigation, render } = useNavigationBuilder<
        TabViewNavigationState<ParamListBase>,
        TabViewRouterOptions,
        TabViewActionHelpers<ParamListBase>,
        TabViewNavigationOptions,
        TabViewNavigationEventMap
    >(router, options);

    return render(
        <TabViewHost
            view={view}
            state={state}
            navigation={navigation}
            descriptors={descriptors}
            tabBarVisible={tabBarVisible}
            tabBarAutohide={tabBarAutohide}
            tabBarExpand={tabBarExpand}
            tabBarInverted={tabBarInverted}
            overview={overview}
            menuModel={menuModel}
            extraDropTarget={extraDropTarget}
            onExtraDragDrop={onExtraDragDrop}
            onCreateWindow={onCreateWindow}
            onSetupMenu={onSetupMenu}
            shortcuts={shortcuts}
            defaultIcon={defaultIcon}
        />,
    );
}

/** Creates a navigator whose routes are the pages of an `Adw.TabView`, with a tab bar and an optional overview. */
function createTabViewNavigator<
    const ParamList extends ParamListBase,
    const NavigatorID extends string | undefined = string | undefined,
    const TypeBag extends NavigatorTypeBagBase = TabViewTypeBag<ParamList, NavigatorID>,
>(): TypedNavigator<TypeBag, undefined>;
/** Creates a navigator whose routes are the pages of an `Adw.TabView`, with a tab bar and an optional overview. */
function createTabViewNavigator<
    const ParamList extends ParamListBase,
    const NavigatorID extends string | undefined = string | undefined,
    const TypeBag extends NavigatorTypeBagBase = TabViewTypeBag<ParamList, NavigatorID>,
    const Config extends StaticConfig<TypeBag> = StaticConfig<TypeBag>,
>(config: Config): TypedNavigator<TypeBag, Config>;
function createTabViewNavigator<
    const TypeBag extends NavigatorTypeBagBase,
    const Config extends StaticConfig<TypeBag> | undefined,
>(config?: Config): TypedNavigator<TypeBag, Config> {
    return createNavigatorFactory(TabViewNavigator)(config) as TypedNavigator<TypeBag, Config>;
}

export { createTabViewNavigator, createTabViewScreen, TabViewNavigator, type TabViewTypeBag };
