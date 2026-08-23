import type {
    NavigationContainerProps as CoreContainerProps,
    NavigationContainerRef,
    ParamListBase,
} from "@react-navigation/core";
import type { ReactNode, Ref } from "react";
import { BaseNavigationContainer } from "@react-navigation/core";
import { useAdwaitaTheme } from "./theme.js";

/** Props of {@link NavigationContainer}. */
type NavigationContainerProps<ParamList extends object = ReactNavigation.RootParamList> = Omit<
    CoreContainerProps,
    "navigationInChildEnabled" | "theme"
> & {
    /** Theme handed to `useTheme` and option callbacks; defaults to the live Adwaita style state. */
    theme?: ReactNavigation.Theme;
    /** Receives the container's imperative navigation API. */
    ref?: Ref<NavigationContainerRef<ParamList>>;
};

/** The {@link NavigationContainer} component, generic over the root param list. */
type NavigationContainerComponent = <ParamList extends object = ReactNavigation.RootParamList>(
    props: NavigationContainerProps<ParamList>,
) => ReactNode;

/** Hosts the navigation tree: render it once at the root, around the navigators. */
const NavigationContainer: NavigationContainerComponent = NavigationContainerInner as NavigationContainerComponent;

function NavigationContainerInner({ ref, theme, ...rest }: NavigationContainerProps<ParamListBase>): ReactNode {
    const adwaitaTheme = useAdwaitaTheme();

    return <BaseNavigationContainer {...rest} ref={ref} theme={theme ?? adwaitaTheme} />;
}

export { NavigationContainer, type NavigationContainerComponent, type NavigationContainerProps };
