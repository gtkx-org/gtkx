import { GtkLabel } from "@gtkx/jsx/gtk";
import { createElement, memo } from "react";

type LabelValue = { text: string };
const observations = { renders: 0 };

const TypescriptLabel = memo(({ value }: { value: LabelValue }) => {
    observations.renders += value.text.length > 0 ? 1 : 0;

    return createElement(GtkLabel, { label: value.text });
});

const TypescriptBanner = () => {
    "use memo";

    const value: LabelValue = { text: "typescript" };

    return createElement(TypescriptLabel, { value });
};

const getTypescriptRenders = (): number => observations.renders;

export { getTypescriptRenders, TypescriptBanner };
