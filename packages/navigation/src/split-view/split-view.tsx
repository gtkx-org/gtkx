import type * as Adw from "@gtkx/gi/adw";
import type { ParamListBase, RouteProp, StackNavigationState } from "@react-navigation/core";
import type { ReactNode } from "react";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwNavigationPage, AdwNavigationSplitView, AdwToolbarView } from "@gtkx/jsx/adw";
import { GtkEventControllerKey } from "@gtkx/jsx/gtk";
import { StackActions } from "@react-navigation/core";
import { useCallback, useRef } from "react";
import type {
    SplitViewDescriptor,
    SplitViewDescriptorMap,
    SplitViewNavigationConfig,
    SplitViewNavigationHelpers,
} from "./types.js";
import { HeaderBar } from "../shared/header-bar.js";
import { requireDescriptor } from "../shared/routes.js";
import { StackView } from "../stack/stack-view.js";

type ViewRef = { current: Adw.NavigationSplitView | null };

type SplitViewProps = SplitViewNavigationConfig & {
    state: StackNavigationState<ParamListBase>;
    navigation: SplitViewNavigationHelpers;
    descriptors: SplitViewDescriptorMap;
    describe: (route: RouteProp<ParamListBase>, isPlaceholder: boolean) => SplitViewDescriptor;
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

const settleShowContent = (viewRef: ViewRef, isShown: boolean, isSettled: boolean): void => {
    if (isSettled !== isShown && viewRef.current !== null) {
        viewRef.current.setShowContent(isSettled);
    }
};

const useContentSync = (
    viewRef: ViewRef,
    navigation: SplitViewNavigationHelpers,
): ((isShown: boolean | null) => void) =>
    useCallback((isShown: boolean | null) => {
        if (isShown === null || isShown === hasContent(navigation.getState())) {
            return;
        }

        if (!isShown) {
            popContent(navigation);
        }

        settleShowContent(viewRef, isShown, hasContent(navigation.getState()));
    }, [viewRef, navigation]);

const EscapeGuard = (): ReactNode => (
    <GtkEventControllerKey
        propagationPhase={Gtk.PropagationPhase.CAPTURE}
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

const SplitView = (props: SplitViewProps): ReactNode => {
    const { state, navigation, descriptors, describe, contentPlaceholder } = props;
    const { collapsed = false, sidebarPosition = "start", minSidebarWidth, maxSidebarWidth } = props;
    const viewRef = useRef<Adw.NavigationSplitView | null>(null);
    const onShowContentChanged = useContentSync(viewRef, navigation);
    const sidebar = requireDescriptor(descriptors, state.routes[0]?.key ?? "");

    return (
        <AdwNavigationSplitView
            ref={viewRef}
            collapsed={collapsed}
            showContent={hasContent(state)}
            sidebarPosition={PACK_TYPES[sidebarPosition]}
            minSidebarWidth={minSidebarWidth}
            maxSidebarWidth={maxSidebarWidth}
            sidebarWidthFraction={props.sidebarWidthFraction}
            onNotifyShowContent={onShowContentChanged}
            controllers={props.popOnEscape === false ? <EscapeGuard /> : null}
            sidebar={<SidebarPage descriptor={sidebar} />}
        >
            <AdwNavigationPage title={contentTitle(state, descriptors)}>
                {hasContent(state)
                    ? (
                            <StackView
                                offset={1}
                                popOnEscape={props.popOnEscape}
                                state={state}
                                navigation={navigation}
                                descriptors={descriptors}
                                describe={describe}
                            />
                        )
                    : <>{contentPlaceholder}</>}
            </AdwNavigationPage>
        </AdwNavigationSplitView>
    );
};

export { SplitView };
