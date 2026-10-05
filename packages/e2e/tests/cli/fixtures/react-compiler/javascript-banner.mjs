import { GtkLabel } from "@gtkx/jsx/gtk";
import { createElement, memo } from "react";

const observations = { renders: 0 };

const JavascriptLabel = memo(({ value }) => {
    observations.renders += value.text.length > 0 ? 1 : 0;

    return createElement(GtkLabel, { label: value.text });
});

const JavascriptBanner = () => {
    "use memo";

    const value = { text: "javascript" };

    return createElement(JavascriptLabel, { value });
};

const getJavascriptRenders = () => observations.renders;

export { getJavascriptRenders, JavascriptBanner };
