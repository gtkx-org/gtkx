import type {
    DefaultNavigatorOptions,
    Descriptor,
    DrawerActionHelpers,
    DrawerNavigationState,
    DrawerRouterOptions,
    NavigationHelpers,
    NavigationProp,
    ParamListBase,
    RouteProp,
} from "@react-navigation/core";
import type { ReactNode } from "react";
import type { HeaderOptions } from "../shared/types.js";

/** Events the drawer navigator emits on top of React Navigation's core events. */
type DrawerNavigationEventMap = {
    /** The user activated an item in the sidebar. */
    drawerItemPress: {
        /** No payload. */
        data: undefined;
        /** Calling `preventDefault` keeps the current screen. */
        canPreventDefault: true;
    };
};

/** Per-screen options of the drawer navigator. */
type DrawerNavigationOptions = HeaderOptions & {
    /** Renders a custom top bar instead of the default `AdwHeaderBar`. */
    header?: (props: DrawerHeaderProps) => ReactNode;
    /** Label shown in the sidebar; defaults to `title`, then to the route name. */
    drawerLabel?: string;
    /** Icon name shown next to the sidebar label. */
    drawerIcon?: string;
    /** Whether the screen mounts on first focus instead of at startup; defaults to `true`. */
    lazy?: boolean;
    /** Whether a nested stack pops to its first screen when this screen loses focus; defaults to `false`. */
    popToTopOnBlur?: boolean;
};

/** Navigation object of a drawer screen. */
type DrawerNavigationProp<
    ParamList extends ParamListBase,
    RouteName extends keyof ParamList = keyof ParamList,
    NavigatorID extends string | undefined = undefined,
> = NavigationProp<
    ParamList,
    RouteName,
    NavigatorID,
    DrawerNavigationState<ParamList>,
    DrawerNavigationOptions,
    DrawerNavigationEventMap
> & DrawerActionHelpers<ParamList>;

/** Props a drawer screen component receives. */
type DrawerScreenProps<
    ParamList extends ParamListBase,
    RouteName extends keyof ParamList = keyof ParamList,
    NavigatorID extends string | undefined = undefined,
> = {
    /** Navigation object of the screen. */
    navigation: DrawerNavigationProp<ParamList, RouteName, NavigatorID>;
    /** The route the screen renders. */
    route: RouteProp<ParamList, RouteName>;
};

/** Arguments of a custom drawer `header` renderer. */
type DrawerHeaderProps = {
    /** The focused route. */
    route: RouteProp<ParamListBase>;
    /** Navigation object of the focused route. */
    navigation: DrawerNavigationProp<ParamListBase>;
    /** Resolved options of the focused route. */
    options: DrawerNavigationOptions;
};

/** Navigation helpers of the drawer navigator itself. */
type DrawerNavigationHelpers = NavigationHelpers<ParamListBase, DrawerNavigationEventMap> &
    DrawerActionHelpers<ParamListBase>;

/** Descriptor of one drawer route. */
type DrawerDescriptor = Descriptor<
    DrawerNavigationOptions,
    DrawerNavigationProp<ParamListBase>,
    RouteProp<ParamListBase>
>;

/** Descriptors of the drawer routes, keyed by route key. */
type DrawerDescriptorMap = Record<string, DrawerDescriptor>;

/** Arguments of a custom `drawerContent` renderer and props of {@link DrawerItemList}. */
type DrawerContentProps = {
    /** State of the drawer navigator. */
    state: DrawerNavigationState<ParamListBase>;
    /** Navigation helpers of the drawer navigator. */
    navigation: DrawerNavigationHelpers;
    /** Descriptors of the drawer routes. */
    descriptors: DrawerDescriptorMap;
};

/** Props of the drawer navigator beyond the options every navigator shares. */
type DrawerNavigationConfig = {
    /** Renders the sidebar; defaults to a header bar above a {@link DrawerItemList}. */
    drawerContent?: (props: DrawerContentProps) => ReactNode;
    /** Whether the sidebar overlays the content instead of sitting beside it; defaults to `false`. */
    collapsed?: boolean;
    /** Which side the sidebar sits on; defaults to `"start"`. */
    sidebarPosition?: "start" | "end";
    /** Whether collapsing and uncollapsing leave the sidebar's visibility alone; defaults to `false`. */
    pinSidebar?: boolean;
    /** Minimum sidebar width, in the unit libadwaita uses for the split view. */
    minSidebarWidth?: number;
    /** Maximum sidebar width, in the unit libadwaita uses for the split view. */
    maxSidebarWidth?: number;
    /** Preferred sidebar width as a fraction of the total width. */
    sidebarWidthFraction?: number;
};

/** Props of the drawer `Navigator` component. */
type DrawerNavigatorProps = DefaultNavigatorOptions<
    ParamListBase,
    string | undefined,
    DrawerNavigationState<ParamListBase>,
    DrawerNavigationOptions,
    DrawerNavigationEventMap,
    DrawerNavigationProp<ParamListBase>
> &
DrawerRouterOptions &
DrawerNavigationConfig;

export type {
    DrawerContentProps,
    DrawerDescriptor,
    DrawerDescriptorMap,
    DrawerHeaderProps,
    DrawerNavigationConfig,
    DrawerNavigationEventMap,
    DrawerNavigationHelpers,
    DrawerNavigationOptions,
    DrawerNavigationProp,
    DrawerNavigatorProps,
    DrawerScreenProps,
};
