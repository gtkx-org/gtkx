import type { ReactElement, ReactNode } from "react";
import { AdwBin, AdwViewStackPage } from "@gtkx/jsx/adw";
import { useHasLoaded } from "./use-has-loaded.js";

type ScenePageProps = {
    name: string;
    title: string;
    iconName?: string;
    badgeNumber?: number;
    needsAttention?: boolean;
    useUnderline?: boolean;
    isFocused: boolean;
    isLoaded: boolean;
    render: () => ReactElement;
};

const ScenePage = ({ name, title, isFocused, isLoaded, render, ...page }: ScenePageProps): ReactNode => {
    const hasLoaded = useHasLoaded(isLoaded);

    return (
        <AdwViewStackPage
            name={name}
            title={title}
            iconName={page.iconName}
            badgeNumber={page.badgeNumber}
            needsAttention={page.needsAttention}
            accessibleHidden={!isFocused}
            useUnderline={page.useUnderline ?? false}
        >
            <AdwBin>{hasLoaded ? render() : null}</AdwBin>
        </AdwViewStackPage>
    );
};

export { ScenePage };
