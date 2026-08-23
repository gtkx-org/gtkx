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
import { createNavigatorFactory, createScreenFactory, StackRouter, useNavigationBuilder } from "@react-navigation/core";
import type {
    StackNavigationEventMap,
    StackNavigationOptions,
    StackNavigationProp,
    StackNavigatorProps,
} from "./types.js";
import { StackView } from "./stack-view.js";

/** Type bag describing the stack navigator to React Navigation's typed APIs. */
type StackTypeBag<
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
    ScreenOptions: StackNavigationOptions;
    /** Events the navigator emits. */
    EventMap: StackNavigationEventMap;
    /** Navigation object per route. */
    NavigationList: {
        [RouteName in keyof ParamList]: StackNavigationProp<ParamList, RouteName, NavigatorID>;
    };
    /** The navigator component. */
    Navigator: typeof StackNavigator;
};

/** Declares a typed screen of a stack navigator for the static configuration API. */
const createStackScreen: StaticScreenFactory<StackTypeBag> = createScreenFactory<StackTypeBag>();

/** Renders the screens of a {@link createStackNavigator} as pages of an `AdwNavigationView`. */
function StackNavigator({ popOnEscape, ...options }: StackNavigatorProps): ReactNode {
    const { state, describe, descriptors, navigation, NavigationContent } = useNavigationBuilder<
        StackNavigationState<ParamListBase>,
        StackRouterOptions,
        StackActionHelpers<ParamListBase>,
        StackNavigationOptions,
        StackNavigationEventMap
    >(StackRouter, options);

    return (
        <NavigationContent>
            <StackView
                popOnEscape={popOnEscape}
                state={state}
                navigation={navigation}
                descriptors={descriptors}
                describe={describe}
            />
        </NavigationContent>
    );
}

/** Creates a stack navigator rendered with `AdwNavigationView`: pushes and pops animate like native Adwaita pages. */
function createStackNavigator<
    const ParamList extends ParamListBase,
    const NavigatorID extends string | undefined = string | undefined,
    const TypeBag extends NavigatorTypeBagBase = StackTypeBag<ParamList, NavigatorID>,
    const Config extends StaticConfig<TypeBag> | undefined = undefined,
>(config?: Config): TypedNavigator<TypeBag, Config> {
    return createNavigatorFactory(StackNavigator)(config) as TypedNavigator<TypeBag, Config>;
}

export { createStackNavigator, createStackScreen, StackNavigator, type StackTypeBag };
