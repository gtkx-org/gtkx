import type { StaticParamList } from "@react-navigation/core";
import type { ComponentType, ReactNode } from "react";
import { NavigationContainer, type NavigationContainerProps } from "./navigation-container.js";

/** Props of the component returned by {@link createStaticNavigation}. */
type StaticNavigationProps<ParamList extends object = ReactNavigation.RootParamList> = Omit<
    NavigationContainerProps<ParamList>,
    "children"
>;

/** The part of a static navigator config {@link createStaticNavigation} consumes. */
type StaticNavigationTree = {
    /** Static screen and group declarations used to infer the root param list. */
    readonly config: {
        /** Screens declared by the static navigator. */
        readonly screens?: Record<string, unknown>;
        /** Groups declared by the static navigator. */
        readonly groups?: Record<string, { screens: Record<string, unknown> }>;
    };
    /** Returns the component rendering the configured navigator. */
    getComponent: () => ComponentType;
};

/** Turns a static navigator config into a root component: a {@link NavigationContainer} around the tree. */
function createStaticNavigation<const Tree extends StaticNavigationTree>(
    tree: Tree,
): ComponentType<StaticNavigationProps<StaticParamList<Tree>>> {
    const TreeComponent = tree.getComponent();

    const StaticNavigation = (props: StaticNavigationProps<StaticParamList<Tree>>): ReactNode => (
        <NavigationContainer {...props}>
            <TreeComponent />
        </NavigationContainer>
    );

    return StaticNavigation;
}

export { createStaticNavigation, type StaticNavigationProps, type StaticNavigationTree };
