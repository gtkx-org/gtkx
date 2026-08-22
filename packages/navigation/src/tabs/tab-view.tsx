import type { ParamListBase, TabNavigationState } from "@react-navigation/core";
import type { ReactElement, ReactNode } from "react";
import * as Adw from "@gtkx/gi/adw";
import { AdwToolbarView, AdwViewStack, AdwViewSwitcher, AdwViewSwitcherBar, AdwWindowTitle } from "@gtkx/jsx/adw";
import { CommonActions } from "@react-navigation/core";
import { useCallback, useState } from "react";
import type { TabDescriptor, TabDescriptorMap, TabNavigationConfig, TabNavigationHelpers } from "./types.js";
import { HeaderBar } from "../shared/header-bar.js";
import { getFocusedRoute, requireDescriptor } from "../shared/routes.js";
import { ScenePage } from "../shared/scene-page.js";
import { useLoadedRoutes } from "../shared/use-loaded-routes.js";
import { usePopToTopOnBlur } from "../shared/use-pop-to-top-on-blur.js";

type TabViewProps = TabNavigationConfig & {
    state: TabNavigationState<ParamListBase>;
    navigation: TabNavigationHelpers;
    descriptors: TabDescriptorMap;
};

type TabHeaderProps = {
    descriptor: TabDescriptor;
    viewSwitcher: ReactElement | undefined;
};

type TabPageProps = {
    descriptor: TabDescriptor;
    isLoaded: boolean;
};

const useTabSelection = (
    stack: Adw.ViewStack | null,
    navigation: TabNavigationHelpers,
): ((name: string | null) => void) =>
    useCallback((name: string | null) => {
        const current = navigation.getState();
        const focusedKey = getFocusedRoute(current).key;
        const route = current.routes.find((candidate) => candidate.key === name);

        if (stack === null || route === undefined || route.key === focusedKey) {
            return;
        }

        const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });

        if (event.defaultPrevented) {
            stack.setVisibleChildName(focusedKey);

            return;
        }

        navigation.dispatch({ ...CommonActions.navigate(route.name, route.params), target: current.key });
    }, [stack, navigation]);

const defaultTabHeader = ({ descriptor, viewSwitcher }: TabHeaderProps): ReactElement => (
    <HeaderBar
        options={descriptor.options}
        titleWidget={viewSwitcher ?? <AdwWindowTitle title={descriptor.options.title ?? descriptor.route.name} />}
    />
);

const TabHeader = (props: TabHeaderProps): ReactNode => {
    const { descriptor, viewSwitcher } = props;
    const { route, options, navigation } = descriptor;

    if (options.headerShown === false) {
        return <>{viewSwitcher}</>;
    }

    return (
        <>
            {options.header === undefined
                ? defaultTabHeader(props)
                : options.header({ route, navigation, options, viewSwitcher })}
        </>
    );
};

const TabPage = ({ descriptor, isLoaded }: TabPageProps): ReactNode => {
    const { route, options } = descriptor;

    return (
        <ScenePage
            name={route.key}
            title={options.tabBarLabel ?? options.title ?? route.name}
            iconName={options.tabBarIcon}
            badgeNumber={options.tabBarBadge}
            needsAttention={options.needsAttention}
            isLoaded={isLoaded || options.lazy === false}
            render={() => descriptor.render()}
        />
    );
};

const TabView = ({ state, navigation, descriptors, tabBarPosition = "top" }: TabViewProps): ReactNode => {
    const [stack, setStack] = useState<Adw.ViewStack | null>(null);
    const focused = getFocusedRoute(state);
    const descriptor = requireDescriptor(descriptors, focused.key);
    const loaded = useLoadedRoutes(focused.key, state.preloadedRouteKeys);
    const onVisibleChildChanged = useTabSelection(stack, navigation);

    const viewSwitcher = stack === null
        ? undefined
        : <AdwViewSwitcher stack={stack} policy={Adw.ViewSwitcherPolicy.WIDE} />;

    const hasSwitcherBar = tabBarPosition === "bottom" && stack !== null;
    usePopToTopOnBlur(state, descriptors, navigation);

    return (
        <AdwToolbarView
            topBar={(
                <TabHeader descriptor={descriptor} viewSwitcher={tabBarPosition === "top" ? viewSwitcher : undefined} />
            )}
            bottomBar={hasSwitcherBar ? <AdwViewSwitcherBar stack={stack} reveal /> : undefined}
        >
            <AdwViewStack
                ref={setStack}
                visibleChildName={focused.key}
                enableTransitions={descriptor.options.animation === "fade"}
                onNotifyVisibleChildName={onVisibleChildChanged}
            >
                {state.routes.map((route) => (
                    <TabPage
                        key={route.key}
                        descriptor={requireDescriptor(descriptors, route.key)}
                        isLoaded={loaded.has(route.key)}
                    />
                ))}
            </AdwViewStack>
        </AdwToolbarView>
    );
};

export { TabView };
