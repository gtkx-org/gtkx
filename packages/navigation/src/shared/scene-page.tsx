import type { ReactElement, ReactNode } from "react";
import { AdwBin, AdwViewStackPage } from "@gtkx/jsx/adw";
import { useState } from "react";

type ScenePageProps = {
    name: string;
    title: string;
    iconName?: string;
    badgeNumber?: number;
    needsAttention?: boolean;
    isLoaded: boolean;
    render: () => ReactElement;
};

const ScenePage = ({ name, title, isLoaded, render, ...page }: ScenePageProps): ReactNode => {
    const [hasLoaded, setHasLoaded] = useState(isLoaded);

    if (isLoaded && !hasLoaded) {
        setHasLoaded(true);
    }

    return (
        <AdwViewStackPage
            name={name}
            title={title}
            iconName={page.iconName}
            badgeNumber={page.badgeNumber}
            needsAttention={page.needsAttention}
            useUnderline={false}
        >
            <AdwBin>{hasLoaded ? render() : null}</AdwBin>
        </AdwViewStackPage>
    );
};

export { ScenePage };
