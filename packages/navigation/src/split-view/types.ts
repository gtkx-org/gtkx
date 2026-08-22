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
import type { StackNavigationEventMap, StackNavigationOptions } from "../stack/types.js";

/** Events the split view navigator emits: the stack's transition events, from the content pane. */
type SplitViewNavigationEventMap = StackNavigationEventMap;
/** Per-screen options of the split view navigator, the same ones a stack screen takes. */
type SplitViewNavigationOptions = StackNavigationOptions;

/** Navigation object of a split view screen. */
type SplitViewNavigationProp<
    ParamList extends ParamListBase,
    RouteName extends keyof ParamList = keyof ParamList,
    NavigatorID extends string | undefined = undefined,
> = NavigationProp<
    ParamList,
    RouteName,
    NavigatorID,
    StackNavigationState<ParamList>,
    SplitViewNavigationOptions,
    SplitViewNavigationEventMap
> & StackActionHelpers<ParamList>;

/** Props a split view screen component receives. */
type SplitViewScreenProps<
    ParamList extends ParamListBase,
    RouteName extends keyof ParamList = keyof ParamList,
    NavigatorID extends string | undefined = undefined,
> = {
    /** Navigation object of the screen. */
    navigation: SplitViewNavigationProp<ParamList, RouteName, NavigatorID>;
    /** The route the screen renders. */
    route: RouteProp<ParamList, RouteName>;
};

/** Navigation helpers of the split view navigator itself. */
type SplitViewNavigationHelpers = NavigationHelpers<ParamListBase, SplitViewNavigationEventMap> &
    StackActionHelpers<ParamListBase>;

/** Descriptor of one split view route. */
type SplitViewDescriptor = Descriptor<
    SplitViewNavigationOptions,
    SplitViewNavigationProp<ParamListBase>,
    RouteProp<ParamListBase>
>;

/** Descriptors of the split view routes, keyed by route key. */
type SplitViewDescriptorMap = Record<string, SplitViewDescriptor>;

/** Props of the split view navigator beyond the options every navigator shares. */
type SplitViewNavigationConfig = {
    /** Whether the panes stack into one instead of sitting side by side; defaults to `false`. */
    collapsed?: boolean;
    /** Fills the content pane while no content route is open; defaults to nothing. */
    contentPlaceholder?: ReactNode;
    /** Which side the sidebar sits on; defaults to `"start"`. */
    sidebarPosition?: "start" | "end";
    /** Minimum sidebar width, in the unit libadwaita uses for the split view. */
    minSidebarWidth?: number;
    /** Maximum sidebar width, in the unit libadwaita uses for the split view. */
    maxSidebarWidth?: number;
    /** Preferred sidebar width as a fraction of the total width. */
    sidebarWidthFraction?: number;
    /** Whether pressing Escape pops the visible content page; defaults to `true`. */
    popOnEscape?: boolean;
};

/** Props of the split view `Navigator` component. */
type SplitViewNavigatorProps = DefaultNavigatorOptions<
    ParamListBase,
    string | undefined,
    StackNavigationState<ParamListBase>,
    SplitViewNavigationOptions,
    SplitViewNavigationEventMap,
    SplitViewNavigationProp<ParamListBase>
> &
StackRouterOptions &
SplitViewNavigationConfig;

export type {
    SplitViewDescriptor,
    SplitViewDescriptorMap,
    SplitViewNavigationConfig,
    SplitViewNavigationEventMap,
    SplitViewNavigationHelpers,
    SplitViewNavigationOptions,
    SplitViewNavigationProp,
    SplitViewNavigatorProps,
    SplitViewScreenProps,
};
