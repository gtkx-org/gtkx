import type { ComponentType, ReactNode } from "react";
import { NavigationContainer, type NavigationContainerProps } from "./navigation-container.js";

/** Props of the component returned by {@link createStaticNavigation}. */
type StaticNavigationProps = Omit<NavigationContainerProps, "children">;

/** The part of a static navigator config {@link createStaticNavigation} consumes. */
type StaticNavigationTree = {
    /** Returns the component rendering the configured navigator. */
    getComponent: () => ComponentType;
};

/** Turns a static navigator config into a root component: a {@link NavigationContainer} around the tree. */
function createStaticNavigation(tree: StaticNavigationTree): ComponentType<StaticNavigationProps> {
    const Tree = tree.getComponent();

    const StaticNavigation = (props: StaticNavigationProps): ReactNode => (
        <NavigationContainer {...props}>
            <Tree />
        </NavigationContainer>
    );

    return StaticNavigation;
}

export { createStaticNavigation, type StaticNavigationProps, type StaticNavigationTree };
