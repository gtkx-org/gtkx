import type { ReactElement, ReactNode } from "react";
import { AdwBin, AdwViewStackPage } from "@gtkx/jsx/adw";

type ScenePageProps = {
    name: string;
    title: string;
    iconName?: string;
    badgeNumber?: number;
    needsAttention?: boolean;
    isLoaded: boolean;
    render: () => ReactElement;
};

const ScenePage = ({ name, title, isLoaded, render, ...page }: ScenePageProps): ReactNode => (
    <AdwViewStackPage
        name={name}
        title={title}
        iconName={page.iconName}
        badgeNumber={page.badgeNumber}
        needsAttention={page.needsAttention}
        useUnderline={false}
    >
        <AdwBin>{isLoaded ? render() : null}</AdwBin>
    </AdwViewStackPage>
);

export { ScenePage };
