import type { ReactElement, ReactNode } from "react";
import { AdwBin, AdwViewStackPage } from "@gtkx/jsx/adw";
import { Component } from "react";

type ScenePageProps = {
    name: string;
    title: string;
    iconName?: string;
    badgeNumber?: number;
    needsAttention?: boolean;
    isLoaded: boolean;
    render: () => ReactElement;
};

type SceneContentProps = Pick<ScenePageProps, "isLoaded" | "render">;
type SceneContentState = { isLoaded: boolean };

const ScenePage = ({ name, title, isLoaded, render, ...page }: ScenePageProps): ReactNode => (
    <AdwViewStackPage
        name={name}
        title={title}
        iconName={page.iconName}
        badgeNumber={page.badgeNumber}
        needsAttention={page.needsAttention}
        useUnderline={false}
    >
        <AdwBin>
            <SceneContent isLoaded={isLoaded} render={render} />
        </AdwBin>
    </AdwViewStackPage>
);

class SceneContent extends Component<SceneContentProps, SceneContentState> {
    static getDerivedStateFromProps(
        props: SceneContentProps,
        state: SceneContentState,
    ): SceneContentState | null {
        return props.isLoaded && !state.isLoaded ? { isLoaded: true } : null;
    }

    override state: SceneContentState = { isLoaded: this.props.isLoaded };

    override render(): ReactNode {
        return this.state.isLoaded ? this.props.render() : null;
    }
}

export { ScenePage };
