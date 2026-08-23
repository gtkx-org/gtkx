import type {
    NavigatorTypeBagBase,
    ParamListBase,
    StackActionHelpers,
    StackNavigationState,
    StackRouterOptions,
    StaticConfig,
    StaticScreenFactory,
    TypedNavigator,
} from "@react-navigation/core";
import type { ReactNode } from "react";
import { createNavigatorFactory, createScreenFactory, useNavigationBuilder } from "@react-navigation/core";
import type {
    SplitViewNavigationEventMap,
    SplitViewNavigationOptions,
    SplitViewNavigationProp,
    SplitViewNavigatorProps,
} from "./types.js";
import { splitViewRouter } from "./split-view-router.js";
import { SplitView } from "./split-view.js";

/** Type bag describing the split view navigator to React Navigation's typed APIs. */
type SplitViewTypeBag<
    ParamList extends ParamListBase = ParamListBase,
    NavigatorID extends string | undefined = string | undefined,
> = {
    /** Route names and their params. */
    ParamList: ParamList;
    /** Optional navigator id. */
    NavigatorID: NavigatorID;
    /** Shape of the navigator state. */
    State: StackNavigationState<ParamList>;
    /** Per-screen options. */
    ScreenOptions: SplitViewNavigationOptions;
    /** Events the navigator emits. */
    EventMap: SplitViewNavigationEventMap;
    /** Navigation object per route. */
    NavigationList: {
        [RouteName in keyof ParamList]: SplitViewNavigationProp<ParamList, RouteName, NavigatorID>;
    };
    /** The navigator component. */
    Navigator: typeof SplitViewNavigator;
};

/** Declares a typed screen of a split view navigator for the static configuration API. */
const createSplitViewScreen: StaticScreenFactory<SplitViewTypeBag> = createScreenFactory<SplitViewTypeBag>();

/** Renders the screens of a {@link createSplitViewNavigator} in an `AdwNavigationSplitView`. */
function SplitViewNavigator({
    collapsed,
    contentPlaceholder,
    sidebarPosition,
    minSidebarWidth,
    maxSidebarWidth,
    sidebarWidthFraction,
    popOnEscape,
    ...options
}: SplitViewNavigatorProps): ReactNode {
    const { state, describe, descriptors, navigation, NavigationContent } = useNavigationBuilder<
        StackNavigationState<ParamListBase>,
        StackRouterOptions,
        StackActionHelpers<ParamListBase>,
        SplitViewNavigationOptions,
        SplitViewNavigationEventMap
    >(splitViewRouter, options);

    return (
        <NavigationContent>
            <SplitView
                state={state}
                navigation={navigation}
                descriptors={descriptors}
                describe={describe}
                collapsed={collapsed}
                contentPlaceholder={contentPlaceholder}
                sidebarPosition={sidebarPosition}
                minSidebarWidth={minSidebarWidth}
                maxSidebarWidth={maxSidebarWidth}
                sidebarWidthFraction={sidebarWidthFraction}
                popOnEscape={popOnEscape}
            />
        </NavigationContent>
    );
}

/**
 * Creates a master/detail navigator rendered with `AdwNavigationSplitView`: the first screen fills the sidebar
 * pane, the rest are a stack in the content pane, and a narrow window collapses the two into one.
 */
function createSplitViewNavigator<
    const ParamList extends ParamListBase,
    const NavigatorID extends string | undefined = string | undefined,
    const TypeBag extends NavigatorTypeBagBase = SplitViewTypeBag<ParamList, NavigatorID>,
    const Config extends StaticConfig<TypeBag> | undefined = undefined,
>(config?: Config): TypedNavigator<TypeBag, Config> {
    return createNavigatorFactory(SplitViewNavigator)(config) as TypedNavigator<TypeBag, Config>;
}

export { createSplitViewNavigator, createSplitViewScreen, SplitViewNavigator, type SplitViewTypeBag };
