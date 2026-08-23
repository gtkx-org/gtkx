import type {
    NavigatorTypeBagBase,
    ParamListBase,
    StaticConfig,
    StaticScreenFactory,
    TabActionHelpers,
    TabNavigationState,
    TabRouterOptions,
    TypedNavigator,
} from "@react-navigation/core";
import type { ReactNode } from "react";
import { createNavigatorFactory, createScreenFactory, TabRouter, useNavigationBuilder } from "@react-navigation/core";
import type { TabNavigationEventMap, TabNavigationOptions, TabNavigationProp, TabNavigatorProps } from "./types.js";
import { TabView } from "./tab-view.js";

/** Type bag describing the tab navigator to React Navigation's typed APIs. */
type TabTypeBag<
    ParamList extends ParamListBase = ParamListBase,
    NavigatorID extends string | undefined = string | undefined,
> = {
    /** Route names and their params. */
    ParamList: ParamList;
    /** Optional navigator id. */
    NavigatorID: NavigatorID;
    /** Shape of the navigator state. */
    State: TabNavigationState<ParamList>;
    /** Per-screen options. */
    ScreenOptions: TabNavigationOptions;
    /** Events the navigator emits. */
    EventMap: TabNavigationEventMap;
    /** Navigation object per route. */
    NavigationList: {
        [RouteName in keyof ParamList]: TabNavigationProp<ParamList, RouteName, NavigatorID>;
    };
    /** The navigator component. */
    Navigator: typeof TabNavigator;
};

/** Declares a typed screen of a tab navigator for the static configuration API. */
const createTabScreen: StaticScreenFactory<TabTypeBag> = createScreenFactory<TabTypeBag>();

/** Renders the screens of a {@link createTabNavigator} as pages of an `AdwViewStack` with a view switcher. */
function TabNavigator({ tabBarPosition, ...options }: TabNavigatorProps): ReactNode {
    const { state, descriptors, navigation, NavigationContent } = useNavigationBuilder<
        TabNavigationState<ParamListBase>,
        TabRouterOptions,
        TabActionHelpers<ParamListBase>,
        TabNavigationOptions,
        TabNavigationEventMap
    >(TabRouter, options);

    return (
        <NavigationContent>
            <TabView tabBarPosition={tabBarPosition} state={state} navigation={navigation} descriptors={descriptors} />
        </NavigationContent>
    );
}

/** Creates a tab navigator rendered with `AdwViewStack` and an `AdwViewSwitcher`. */
function createTabNavigator<
    const ParamList extends ParamListBase,
    const NavigatorID extends string | undefined = string | undefined,
    const TypeBag extends NavigatorTypeBagBase = TabTypeBag<ParamList, NavigatorID>,
    const Config extends StaticConfig<TypeBag> | undefined = undefined,
>(config?: Config): TypedNavigator<TypeBag, Config> {
    return createNavigatorFactory(TabNavigator)(config) as TypedNavigator<TypeBag, Config>;
}

export { createTabNavigator, createTabScreen, TabNavigator, type TabTypeBag };
