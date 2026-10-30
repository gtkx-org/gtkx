import type { ParamListBase, RouteProp, StackNavigationState } from "@react-navigation/core";
import type { ReactNode } from "react";
import * as Adw from "@gtkx/gi/adw";
import * as Gdk from "@gtkx/gi/gdk";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import {
    AdwBreakpoint,
    AdwBreakpointBin,
    AdwHeaderBar,
    AdwNavigationPage,
    AdwNavigationSplitView,
    AdwToolbarView,
} from "@gtkx/jsx/adw";
import { GtkEventControllerKey } from "@gtkx/jsx/gtk";
import { StackActions } from "@react-navigation/core";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
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

const collapsedValue = (): GObject.Value => {
    const value = new GObject.Value();
    value.init(GObject.TYPE_BOOLEAN);
    value.setBoolean(true);

    return value;
};

const useCollapseBreakpoint = (
    viewRef: ViewRef,
    collapseCondition: string | undefined,
): { breakpoint: ReactNode; isCollapsed: boolean } => {
    const [breakpoint, setBreakpoint] = useState<Adw.Breakpoint | null>(null);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const condition = useMemo(
        () => (collapseCondition === undefined ? null : Adw.BreakpointCondition.parse(collapseCondition)),
        [collapseCondition],
    );

    useLayoutEffect(() => {
        const view = viewRef.current;

        if (breakpoint === null || view === null) {
            return;
        }

        breakpoint.addSetter(view, "collapsed", collapsedValue());
    }, [viewRef, breakpoint]);

    return {
        breakpoint:
            condition === null ? null : (
                <AdwBreakpoint
                    ref={setBreakpoint}
                    condition={condition}
                    onApply={() => {
                        setIsCollapsed(true);
                    }}
                    onUnapply={() => {
                        setIsCollapsed(false);
                    }}
                />
            ),
        isCollapsed,
    };
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
    useCallback(
        (isShown: boolean | null) => {
            if (isShown === null || isShown === hasContent(navigation.getState())) {
                return;
            }

            if (!isShown) {
                popContent(navigation);
            }

            settleShowContent(viewRef, isShown, hasContent(navigation.getState()));
        },
        [viewRef, navigation],
    );

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

    const topBar =
        options.header === undefined ? (
            <HeaderBar options={options} showBackButton={false} />
        ) : (
            <>{options.header({ route, navigation, options, back: undefined })}</>
        );

    return (
        <AdwNavigationPage title={options.title ?? route.name}>
            <AdwToolbarView topBar={topBar}>{descriptor.render()}</AdwToolbarView>
        </AdwNavigationPage>
    );
};

const SplitView = (props: SplitViewProps): ReactNode => {
    const { state, navigation, descriptors, describe, contentPlaceholder, collapseCondition } = props;
    const { sidebarPosition = "start", minSidebarWidth, maxSidebarWidth } = props;
    const viewRef = useRef<Adw.NavigationSplitView | null>(null);
    const onShowContentChanged = useContentSync(viewRef, navigation);
    const collapseBreakpoint = useCollapseBreakpoint(viewRef, collapseCondition);
    const sidebar = requireDescriptor(descriptors, state.routes[0]?.key ?? "");
    const collapsed = collapseCondition === undefined ? (props.collapsed ?? false) : undefined;
    const isCollapsed = collapsed ?? collapseBreakpoint.isCollapsed;

    // AdwBreakpointBin warns without a size request; the window's size request sets the smallest supported size.
    return (
        <AdwBreakpointBin widthRequest={1} heightRequest={1} breakpoints={collapseBreakpoint.breakpoint}>
            <AdwNavigationSplitView
                ref={viewRef}
                collapsed={collapsed}
                showContent={hasContent(state)}
                sidebarPosition={PACK_TYPES[sidebarPosition]}
                minSidebarWidth={minSidebarWidth}
                maxSidebarWidth={maxSidebarWidth}
                sidebarWidthFraction={props.sidebarWidthFraction}
                onNotifyShowContent={onShowContentChanged}
                sidebar={<SidebarPage descriptor={sidebar} />}
            >
                <AdwNavigationPage
                    title={contentTitle(state, descriptors)}
                    controllers={isCollapsed && props.popOnEscape === false ? <EscapeGuard /> : null}
                >
                    {hasContent(state) ? (
                        <StackView
                            offset={1}
                            popOnEscape={props.popOnEscape}
                            state={state}
                            navigation={navigation}
                            descriptors={descriptors}
                            describe={describe}
                        />
                    ) : (
                        <AdwToolbarView topBar={<AdwHeaderBar showTitle={false} />}>
                            {contentPlaceholder}
                        </AdwToolbarView>
                    )}
                </AdwNavigationPage>
            </AdwNavigationSplitView>
        </AdwBreakpointBin>
    );
};

export { SplitView };
