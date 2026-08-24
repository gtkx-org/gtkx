import type { ParamListBase, RouteProp, StackNavigationState } from "@react-navigation/core";
import type { ReactNode } from "react";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwNavigationPage, AdwNavigationSplitView, AdwToolbarView } from "@gtkx/jsx/adw";
import { GtkEventControllerKey } from "@gtkx/jsx/gtk";
import { StackActions } from "@react-navigation/core";
import { useCallback } from "react";
import type {
    SplitViewDescriptor,
    SplitViewDescriptorMap,
    SplitViewNavigationConfig,
    SplitViewNavigationHelpers,
} from "./types.js";
import { HeaderBar } from "../shared/header-bar.js";
import { requireDescriptor } from "../shared/routes.js";
import { StackView } from "../stack/stack-view.js";

type SplitViewProps = SplitViewNavigationConfig & {
    state: StackNavigationState<ParamListBase>;
    navigation: SplitViewNavigationHelpers;
    descriptors: SplitViewDescriptorMap;
    describe: (route: RouteProp<ParamListBase>, isPlaceholder: boolean) => SplitViewDescriptor;
};

type ContentPageProps = Pick<SplitViewProps, "state" | "navigation" | "descriptors" | "describe" |
    "contentPlaceholder" | "popOnEscape"> & {
        collapsed: boolean;
        focusedContent?: SplitViewDescriptor;
    };

const PACK_TYPES = { start: Gtk.PackType.START, end: Gtk.PackType.END } as const;
const CONTENT_TITLE = "Content";
const ESCAPE_KEYVAL = Gdk.KEY_Escape;

const hasContent = (state: { routes: readonly unknown[] }): boolean => state.routes.length > 1;

const contentTitle = (state: StackNavigationState<ParamListBase>, descriptors: SplitViewDescriptorMap): string => {
    const route = state.routes[state.index];

    if (route === undefined || state.index === 0) {
        return state.routeNames[1] ?? CONTENT_TITLE;
    }

    return descriptors[route.key]?.options.title ?? route.name;
};

const popContent = (navigation: SplitViewNavigationHelpers): void => {
    const state = navigation.getState();
    navigation.dispatch({ ...StackActions.pop(state.routes.length - 1), target: state.key });
};

const useContentSync = (navigation: SplitViewNavigationHelpers): ((isShown: boolean | null) => void) =>
    useCallback((isShown: boolean | null) => {
        if (isShown === null || isShown === hasContent(navigation.getState())) {
            return;
        }

        if (!isShown) {
            popContent(navigation);
        }
    }, [navigation]);

const EscapeGuard = (): ReactNode => (
    <GtkEventControllerKey
        propagationPhase={Gtk.PropagationPhase.BUBBLE}
        onKeyPressed={(keyval) => keyval === ESCAPE_KEYVAL}
    />
);

const SidebarPage = ({ descriptor }: { descriptor: SplitViewDescriptor }): ReactNode => {
    const { route, options, navigation } = descriptor;

    if (options.headerShown === false) {
        return <AdwNavigationPage title={options.title ?? route.name}>{descriptor.render()}</AdwNavigationPage>;
    }

    const topBar = options.header === undefined
        ? <HeaderBar options={options} showBackButton={false} />
        : <>{options.header({ route, navigation, options, back: undefined })}</>;

    return (
        <AdwNavigationPage title={options.title ?? route.name}>
            <AdwToolbarView topBar={topBar}>{descriptor.render()}</AdwToolbarView>
        </AdwNavigationPage>
    );
};

const SplitContent = ({
    state,
    navigation,
    descriptors,
    describe,
    contentPlaceholder,
    popOnEscape,
}: Pick<ContentPageProps, "state" | "navigation" | "descriptors" | "describe" |
"contentPlaceholder" | "popOnEscape">): ReactNode => hasContent(state)
    ? (
            <StackView
                offset={1}
                popOnEscape={popOnEscape}
                state={state}
                navigation={navigation}
                descriptors={descriptors}
                describe={describe}
            />
        )
    : <>{contentPlaceholder}</>;

const ContentPage = (props: ContentPageProps): ReactNode => {
    const { state, descriptors, focusedContent, collapsed, popOnEscape } = props;
    const canPop = focusedContent?.options.canPop ?? true;

    return (
        <AdwNavigationPage
            title={contentTitle(state, descriptors)}
            canPop={canPop}
            controllers={collapsed && popOnEscape === false ? <EscapeGuard /> : null}
        >
            <SplitContent {...props} />
        </AdwNavigationPage>
    );
};

const SplitView = (props: SplitViewProps): ReactNode => {
    const { state, navigation, descriptors, describe, contentPlaceholder } = props;
    const { collapsed = false, sidebarPosition = "start", minSidebarWidth, maxSidebarWidth } = props;
    const onShowContentChanged = useContentSync(navigation);
    const sidebar = requireDescriptor(descriptors, state.routes[0]?.key ?? "");
    const contentRoute = state.index > 0 ? state.routes[state.index] : undefined;
    const focusedContent = contentRoute === undefined ? undefined : requireDescriptor(descriptors, contentRoute.key);

    return (
        <AdwNavigationSplitView
            collapsed={collapsed}
            showContent={hasContent(state)}
            sidebarPosition={collapsed ? Gtk.PackType.START : PACK_TYPES[sidebarPosition]}
            minSidebarWidth={minSidebarWidth}
            maxSidebarWidth={maxSidebarWidth}
            sidebarWidthFraction={props.sidebarWidthFraction}
            onNotifyShowContent={onShowContentChanged}
            sidebar={<SidebarPage descriptor={sidebar} />}
        >
            <ContentPage
                state={state}
                navigation={navigation}
                descriptors={descriptors}
                describe={describe}
                contentPlaceholder={contentPlaceholder}
                popOnEscape={props.popOnEscape}
                collapsed={collapsed}
                focusedContent={focusedContent}
            />
        </AdwNavigationSplitView>
    );
};

export { SplitView };
