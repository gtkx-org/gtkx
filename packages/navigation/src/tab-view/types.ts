import type * as Adw from "@gtkx/gi/adw";
import type * as Gio from "@gtkx/gi/gio";
import type * as GObject from "@gtkx/gi/gobject";
import type { AdwTabDropProps } from "@gtkx/react/internal";
import type {
    DefaultNavigatorOptions,
    Descriptor,
    NavigationHelpers,
    NavigationProp,
    NavigationState,
    ParamListBase,
    RouteProp,
} from "@react-navigation/core";
import type { ReactNode } from "react";
import type { HeaderOptions } from "../shared/types.js";

/** Navigation state of a tab view navigator. Pinned routes come first in `routes`, in `pinnedKeys` order. */
type TabViewNavigationState<ParamList extends ParamListBase> = NavigationState<ParamList> & {
    /** Type of the router, in this case `tabview`. */
    type: "tabview";
    /** Keys of the pinned routes. */
    pinnedKeys: string[];
    /** Key of the tab each tab was opened from, by route key. */
    parents: Record<string, string>;
};

/** Options accepted when opening a tab. */
type TabViewOpenOptions = {
    /** Key of the tab the new one is opened from; the new tab follows that tab and its descendants, which are selected again when it closes. */
    parent?: string;
    /** Whether the new tab is selected; defaults to `true`. */
    select?: boolean;
    /** Position among the unpinned tabs; defaults to the end. */
    position?: number;
};

/** Actions specific to the tab view router. */
type TabViewActionType =
    | {
          type: "OPEN_TAB";
          payload: {
              name: string;
              params?: object;
              key?: string;
              parent?: string;
              select?: boolean;
              position?: number;
              pinned?: boolean;
          };
      }
    | { type: "CLOSE_TAB"; payload: { key?: string } }
    | { type: "CLOSE_OTHER_TABS"; payload: { key?: string } }
    | { type: "CLOSE_TABS_BEFORE"; payload: { key?: string } }
    | { type: "CLOSE_TABS_AFTER"; payload: { key?: string } }
    | { type: "SELECT_TAB"; payload: { key: string } }
    | { type: "REORDER_TAB"; payload: { key: string; position: number } }
    | { type: "PIN_TAB"; payload: { key: string; pinned: boolean } };

/** Action helpers added to the navigation object of tab view screens. Keys default to the selected tab. */
type TabViewActionHelpers<ParamList extends ParamListBase> = {
    /** Opens a new tab for a screen, or selects the open tab whose `getId` matches. */
    openTab<RouteName extends keyof ParamList>(
        name: RouteName,
        params?: ParamList[RouteName],
        options?: TabViewOpenOptions,
    ): void;
    /** Closes a tab. Closing the last tab is left to the parent navigator or `onUnhandledAction`. */
    closeTab(key?: string): void;
    /** Closes every unpinned tab except one. */
    closeOtherTabs(key?: string): void;
    /** Closes the unpinned tabs before one. */
    closeTabsBefore(key?: string): void;
    /** Closes the unpinned tabs after one. */
    closeTabsAfter(key?: string): void;
    /** Selects a tab. */
    selectTab(key: string): void;
    /** Moves a tab within its pinned or unpinned group. */
    reorderTab(key: string, position: number): void;
    /** Pins a tab, moving it after the other pinned tabs, or unpins it, moving it before the unpinned tabs. */
    pinTab(key: string, pinned: boolean): void;
};

/** Events the tab view navigator emits on top of React Navigation's core events. */
type TabViewNavigationEventMap = {
    /** The user selected a tab natively. */
    tabPress: {
        /** No payload. */
        data: undefined;
        /** Calling `preventDefault` keeps the current tab. */
        canPreventDefault: true;
    };
    /** The user activated the tab's indicator icon. */
    indicatorActivated: {
        /** No payload. */
        data: undefined;
    };
};

/** An icon given by theme name or as a `Gio.Icon`. */
type TabViewIcon = string | Gio.Icon;

/** Per-screen options of the tab view navigator. */
type TabViewNavigationOptions = HeaderOptions & {
    /** Renders a custom top bar instead of the default `AdwHeaderBar`. */
    header?: (props: TabViewHeaderProps) => ReactNode;
    /** Icon shown in the tab; `null` shows the view's default icon. */
    icon?: TabViewIcon | null;
    /** Tooltip of the tab; supports Pango markup. */
    tooltip?: string;
    /** Search keyword for the tab overview. */
    keyword?: string;
    /** Whether the tab shows a loading spinner instead of its icon. */
    loading?: boolean;
    /** Whether the tab is highlighted as needing attention. */
    needsAttention?: boolean;
    /** Indicator icon shown at the end of the tab. */
    indicatorIcon?: TabViewIcon | null;
    /** Whether clicking the indicator emits `indicatorActivated`. */
    indicatorActivatable?: boolean;
    /** Tooltip of the indicator icon; supports Pango markup. */
    indicatorTooltip?: string;
    /** Whether the overview thumbnail stays live while the tab is not selected. */
    liveThumbnail?: boolean;
    /** Horizontal alignment of the overview thumbnail, from 0 to 1. */
    thumbnailXalign?: number;
    /** Vertical alignment of the overview thumbnail, from 0 to 1. */
    thumbnailYalign?: number;
    /** Whether the screen mounts on first selection instead of as soon as the tab opens; defaults to `true`. */
    lazy?: boolean;
};

/** The screen a new tab opens, as returned by the overview's `onCreateTab`. */
type TabViewTarget = {
    /** Name of the screen to open. */
    name: string;
    /** Params of the new tab. */
    params?: object;
};

/** Settings of the `AdwTabOverview` rendered around the view. */
type TabViewOverviewConfig = {
    /**
     * Whether the overview is open. When given, the overview follows it: the user opening or closing the overview
     * calls `onOpenChange`, and a value the app does not update is restored. Leave it out to let the overview open
     * and close on its own.
     */
    open?: boolean;
    /** Called when the overview opens or closes natively. */
    onOpenChange?: (open: boolean) => void;
    /** Whether the overview shows a new tab button; defaults to `false`. */
    enableNewTab?: boolean;
    /** Whether the overview offers search; defaults to `true`. */
    enableSearch?: boolean;
    /** Returns the screen the new tab button opens. */
    onCreateTab?: () => TabViewTarget;
};

/** Additional drop target of the tab bar and overview. */
type TabViewExtraDropTarget = NonNullable<AdwTabDropProps["extraDropTarget"]>;

/** Props of the tab view navigator beyond the options every navigator shares. */
type TabViewNavigationConfig = {
    /** A view created before the navigator renders, such as one returned from a `create-window` handler. */
    view?: Adw.TabView;
    /** Whether the tab bar renders; defaults to `true`. */
    tabBarVisible?: boolean;
    /** Whether the tab bar hides with a single tab; defaults to `true`. */
    tabBarAutohide?: boolean;
    /** Whether tabs expand to fill the bar; defaults to `true`. */
    tabBarExpand?: boolean;
    /** Whether close buttons sit at the start of tabs; defaults to `false`. */
    tabBarInverted?: boolean;
    /** Renders an `AdwTabOverview` around the view. */
    overview?: TabViewOverviewConfig;
    /** An existing menu model to use as the tabs' context menu. Use `renderMenu` to declare the menu in JSX instead. */
    menuModel?: Gio.MenuModel | null;
    /**
     * Renders the tabs' context menu. Attach `ref` to a `GMenu`, or to any menu model element, anywhere in the
     * returned tree; the navigator renders the tree outside the widget hierarchy and uses that model. A navigator
     * given both `renderMenu` and a `menuModel` throws.
     */
    renderMenu?: (ref: (menu: Gio.MenuModel | null) => void) => ReactNode;
    /** Additional content accepted by drops on tabs. */
    extraDropTarget?: TabViewExtraDropTarget | null;
    /** Handles content dropped on a tab; returns whether the drop was accepted. */
    onExtraDragDrop?: (route: RouteProp<ParamListBase>, value: GObject.Value) => boolean;
    /** Returns the view of a new window when a tab is dragged out of this one. */
    onCreateWindow?: () => Adw.TabView | null;
    /** Called with the tab whose context menu opens, or `null` when it closes, after the chosen menu action has run. */
    onSetupMenu?: (route: RouteProp<ParamListBase> | null) => void;
    /** Keyboard shortcuts the view handles. */
    shortcuts?: Adw.TabViewShortcuts;
    /** Icon of tabs without an `icon` option. */
    defaultIcon?: TabViewIcon | null;
};

/** Options of the tab view router. */
type TabViewRouterOptions = {
    /** Screen of the tab opened when the view starts empty; defaults to the first screen. */
    initialRouteName?: string;
    /**
     * Whether closing the last tab replaces it with a new tab of the initial route, instead of leaving that close
     * unhandled for a parent navigator or the container's `onUnhandledAction`. Use it for a tab view inside a section
     * of the app rather than a window of its own; defaults to `false`.
     */
    replaceLastTab?: boolean;
};

/** Navigation object of a tab view screen. */
type TabViewNavigationProp<
    ParamList extends ParamListBase,
    RouteName extends keyof ParamList = keyof ParamList,
    NavigatorID extends string | undefined = undefined,
> = NavigationProp<
    ParamList,
    RouteName,
    NavigatorID,
    TabViewNavigationState<ParamList>,
    TabViewNavigationOptions,
    TabViewNavigationEventMap
> &
    TabViewActionHelpers<ParamList>;

/** Props a tab view screen component receives. */
type TabViewScreenProps<
    ParamList extends ParamListBase,
    RouteName extends keyof ParamList = keyof ParamList,
    NavigatorID extends string | undefined = undefined,
> = {
    /** Navigation object of the screen. */
    navigation: TabViewNavigationProp<ParamList, RouteName, NavigatorID>;
    /** The route the screen renders. */
    route: RouteProp<ParamList, RouteName>;
};

/** Arguments of a custom tab view `header` renderer. */
type TabViewHeaderProps = {
    /** The selected route. */
    route: RouteProp<ParamListBase>;
    /** Navigation object of the selected route. */
    navigation: TabViewNavigationProp<ParamListBase>;
    /** Resolved options of the selected route. */
    options: TabViewNavigationOptions;
};

/** Navigation helpers of the tab view navigator itself. */
type TabViewNavigationHelpers = NavigationHelpers<ParamListBase, TabViewNavigationEventMap> &
    TabViewActionHelpers<ParamListBase>;

/** Descriptor of one tab view route. */
type TabViewDescriptor = Descriptor<
    TabViewNavigationOptions,
    TabViewNavigationProp<ParamListBase>,
    RouteProp<ParamListBase>
>;
/** Descriptors of the tab view routes, keyed by route key. */
type TabViewDescriptorMap = Record<string, TabViewDescriptor>;

/** Props of the tab view `Navigator` component. */
type TabViewNavigatorProps = DefaultNavigatorOptions<
    ParamListBase,
    string | undefined,
    TabViewNavigationState<ParamListBase>,
    TabViewNavigationOptions,
    TabViewNavigationEventMap,
    TabViewNavigationProp<ParamListBase>
> &
    TabViewRouterOptions &
    TabViewNavigationConfig;

export type {
    TabViewActionHelpers,
    TabViewActionType,
    TabViewDescriptor,
    TabViewDescriptorMap,
    TabViewExtraDropTarget,
    TabViewHeaderProps,
    TabViewIcon,
    TabViewNavigationConfig,
    TabViewNavigationEventMap,
    TabViewNavigationHelpers,
    TabViewNavigationOptions,
    TabViewNavigationProp,
    TabViewNavigationState,
    TabViewNavigatorProps,
    TabViewOpenOptions,
    TabViewOverviewConfig,
    TabViewRouterOptions,
    TabViewScreenProps,
    TabViewTarget,
};
