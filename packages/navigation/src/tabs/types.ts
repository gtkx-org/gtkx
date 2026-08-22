import type {
    DefaultNavigatorOptions,
    Descriptor,
    NavigationHelpers,
    NavigationProp,
    ParamListBase,
    RouteProp,
    TabActionHelpers,
    TabNavigationState,
    TabRouterOptions,
} from "@react-navigation/core";
import type { ReactNode } from "react";
import type { HeaderOptions } from "../shared/types.js";

/** Events the tab navigator emits on top of React Navigation's core events. */
type TabNavigationEventMap = {
    /** The user selected a tab in the view switcher. */
    tabPress: {
        /** No payload. */
        data: undefined;
        /** Calling `preventDefault` keeps the current tab. */
        canPreventDefault: true;
    };
};

/** Per-screen options of the tab navigator. */
type TabNavigationOptions = HeaderOptions & {
    /** Renders a custom top bar instead of the default `AdwHeaderBar`. */
    header?: (props: TabHeaderProps) => ReactNode;
    /** Label shown in the view switcher; defaults to `title`, then to the route name. */
    tabBarLabel?: string;
    /** Icon name shown in the view switcher. */
    tabBarIcon?: string;
    /** Badge number shown in the view switcher; `0` hides the badge. */
    tabBarBadge?: number;
    /** Whether the view switcher highlights the tab as needing attention. */
    needsAttention?: boolean;
    /** Whether the screen mounts on first focus instead of at startup; defaults to `true`. */
    lazy?: boolean;
    /** Whether a nested stack pops to its first screen when this tab loses focus; defaults to `false`. */
    popToTopOnBlur?: boolean;
    /** Whether switching to this tab crossfades; defaults to `"none"`. */
    animation?: "fade" | "none";
};

/** Props of the tab navigator beyond the options every navigator shares. */
type TabNavigationConfig = {
    /** Where the view switcher sits: in the header bar or in a bar below the content; defaults to `"top"`. */
    tabBarPosition?: "top" | "bottom";
};

/** Navigation object of a tab screen. */
type TabNavigationProp<
    ParamList extends ParamListBase,
    RouteName extends keyof ParamList = keyof ParamList,
    NavigatorID extends string | undefined = undefined,
> = NavigationProp<
    ParamList,
    RouteName,
    NavigatorID,
    TabNavigationState<ParamList>,
    TabNavigationOptions,
    TabNavigationEventMap
> & TabActionHelpers<ParamList>;

/** Props a tab screen component receives. */
type TabScreenProps<
    ParamList extends ParamListBase,
    RouteName extends keyof ParamList = keyof ParamList,
    NavigatorID extends string | undefined = undefined,
> = {
    /** Navigation object of the screen. */
    navigation: TabNavigationProp<ParamList, RouteName, NavigatorID>;
    /** The route the screen renders. */
    route: RouteProp<ParamList, RouteName>;
};

/** Arguments of a custom tab `header` renderer. */
type TabHeaderProps = {
    /** The focused route. */
    route: RouteProp<ParamListBase>;
    /** Navigation object of the focused route. */
    navigation: TabNavigationProp<ParamListBase>;
    /** Resolved options of the focused route. */
    options: TabNavigationOptions;
    /** The view switcher to place in the header when `tabBarPosition` is `"top"`. */
    viewSwitcher: ReactNode;
};

/** Navigation helpers of the tab navigator itself. */
type TabNavigationHelpers = NavigationHelpers<ParamListBase, TabNavigationEventMap> & TabActionHelpers<ParamListBase>;
/** Descriptor of one tab route. */
type TabDescriptor = Descriptor<TabNavigationOptions, TabNavigationProp<ParamListBase>, RouteProp<ParamListBase>>;
/** Descriptors of the tab routes, keyed by route key. */
type TabDescriptorMap = Record<string, TabDescriptor>;

/** Props of the tab `Navigator` component. */
type TabNavigatorProps = DefaultNavigatorOptions<
    ParamListBase,
    string | undefined,
    TabNavigationState<ParamListBase>,
    TabNavigationOptions,
    TabNavigationEventMap,
    TabNavigationProp<ParamListBase>
> &
TabRouterOptions &
TabNavigationConfig;

export type {
    TabDescriptor,
    TabDescriptorMap,
    TabHeaderProps,
    TabNavigationConfig,
    TabNavigationEventMap,
    TabNavigationHelpers,
    TabNavigationOptions,
    TabNavigationProp,
    TabNavigatorProps,
    TabScreenProps,
};
