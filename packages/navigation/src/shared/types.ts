import type { ReactElement, ReactNode } from "react";

/** Header options shared by every navigator. */
type HeaderOptions = {
    /** Title of the screen, shown in the header bar; defaults to the route name. */
    title?: string;
    /** Whether to render a header bar above the screen; defaults to `true`. */
    headerShown?: boolean;
    /** Replaces the header bar title: a string becomes an `AdwWindowTitle`, an element is used as the title widget. */
    headerTitle?: string | ReactElement;
    /** Widgets packed at the start of the header bar. */
    headerStart?: ReactNode;
    /** Widgets packed at the end of the header bar. */
    headerEnd?: ReactNode;
};

export type { HeaderOptions };
