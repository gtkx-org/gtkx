import type {
    DefaultNavigatorOptions,
    Descriptor,
    NavigationHelpers,
    NavigationProp,
    ParamListBase,
    RouteProp,
    StackActionHelpers,
    StackNavigationState,
    StackRouterOptions,
} from "@react-navigation/core";
import type { ReactNode } from "react";
import type { HeaderOptions } from "../shared/types.js";

/** Data carried by the `transitionStart` and `transitionEnd` events. */
type StackTransitionData = {
    /** Whether the page is hiding (`true`) or showing (`false`). */
    closing: boolean;
};

/** Events the stack navigator emits on top of React Navigation's core events. */
type StackNavigationEventMap = {
    /** A page starts showing or hiding. */
    transitionStart: {
        /** Which direction the page moves in. */
        data: StackTransitionData;
    };
    /** A page finished showing or hiding. */
    transitionEnd: {
        /** Which direction the page moved in. */
        data: StackTransitionData;
    };
};

/** The page below the current one, as handed to a custom `header`. */
type StackHeaderBack = {
    /** Title of the page below. */
    title: string;
};

/** Per-screen options of the stack navigator. */
type StackNavigationOptions = HeaderOptions & {
    /** Renders a custom top bar instead of the default `AdwHeaderBar`. */
    header?: (props: StackHeaderProps) => ReactNode;
    /** Whether the default header bar shows Adwaita's back button; defaults to `true`. */
    headerBackVisible?: boolean;
    /** Whether the user can pop this page with the back button, Escape, Alt+Left or a swipe; defaults to `true`. */
    canPop?: boolean;
    /** Whether pushing and popping this page animates; defaults to `"default"`. */
    animation?: "default" | "none";
};

/** Props of the stack navigator beyond the options every navigator shares. */
type StackNavigationConfig = {
    /** Whether pressing Escape pops the visible page; defaults to `true`. */
    popOnEscape?: boolean;
};

/** Navigation object of a stack screen. */
type StackNavigationProp<
    ParamList extends ParamListBase,
    RouteName extends keyof ParamList = keyof ParamList,
    NavigatorID extends string | undefined = undefined,
> = NavigationProp<
    ParamList,
    RouteName,
    NavigatorID,
    StackNavigationState<ParamList>,
    StackNavigationOptions,
    StackNavigationEventMap
> & StackActionHelpers<ParamList>;

/** Props a stack screen component receives. */
type StackScreenProps<
    ParamList extends ParamListBase,
    RouteName extends keyof ParamList = keyof ParamList,
    NavigatorID extends string | undefined = undefined,
> = {
    /** Navigation object of the screen. */
    navigation: StackNavigationProp<ParamList, RouteName, NavigatorID>;
    /** The route the screen renders. */
    route: RouteProp<ParamList, RouteName>;
};

/** Arguments of a custom stack `header` renderer. */
type StackHeaderProps = {
    /** The route whose header is rendered. */
    route: RouteProp<ParamListBase>;
    /** Navigation object of that route. */
    navigation: StackNavigationProp<ParamListBase>;
    /** Resolved options of that route. */
    options: StackNavigationOptions;
    /** The page below this one in the stack, if any. */
    back?: StackHeaderBack;
};

/** Navigation helpers of the stack navigator itself. */
type StackNavigationHelpers = NavigationHelpers<ParamListBase, StackNavigationEventMap> &
    StackActionHelpers<ParamListBase>;

/** Descriptor of one stack route. */
type StackDescriptor = Descriptor<StackNavigationOptions, StackNavigationProp<ParamListBase>, RouteProp<ParamListBase>>;
/** Descriptors of the stack routes, keyed by route key. */
type StackDescriptorMap = Record<string, StackDescriptor>;

/** Props of the stack `Navigator` component. */
type StackNavigatorProps = DefaultNavigatorOptions<
    ParamListBase,
    string | undefined,
    StackNavigationState<ParamListBase>,
    StackNavigationOptions,
    StackNavigationEventMap,
    StackNavigationProp<ParamListBase>
> &
StackRouterOptions &
StackNavigationConfig;

export type {
    StackDescriptor,
    StackDescriptorMap,
    StackHeaderBack,
    StackHeaderProps,
    StackNavigationConfig,
    StackNavigationEventMap,
    StackNavigationHelpers,
    StackNavigationOptions,
    StackNavigationProp,
    StackNavigatorProps,
    StackScreenProps,
    StackTransitionData,
};
