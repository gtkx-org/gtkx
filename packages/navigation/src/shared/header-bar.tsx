import type { ReactElement, ReactNode } from "react";
import { AdwHeaderBar, AdwWindowTitle } from "@gtkx/jsx/adw";
import type { HeaderOptions } from "./types.js";

type HeaderBarProps = {
    options: HeaderOptions;
    titleWidget?: ReactElement;
    start?: ReactNode;
    showBackButton?: boolean;
};

const resolveTitleWidget = (options: HeaderOptions, fallback: ReactElement | undefined): ReactElement | undefined => {
    if (typeof options.headerTitle === "string") {
        return <AdwWindowTitle title={options.headerTitle} />;
    }

    return options.headerTitle ?? fallback;
};

const HeaderBar = ({ options, titleWidget, start, showBackButton }: HeaderBarProps): ReactNode => (
    <AdwHeaderBar
        showBackButton={showBackButton ?? true}
        titleWidget={resolveTitleWidget(options, titleWidget)}
        start={(
            <>
                {start}
                {options.headerStart}
            </>
        )}
        end={options.headerEnd}
    />
);

export { HeaderBar };
