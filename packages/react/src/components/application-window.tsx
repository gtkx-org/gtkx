import type * as Gtk from "@gtkx/gi/gtk";
import { type ElementType, type ReactNode, use } from "react";
import { ApplicationContext } from "../hooks/use-application.js";
import { createPortaledComponent } from "./portaled.js";
import { createPresentedWindowComponent } from "./window.js";

const useApplicationContainer = (): Gtk.Application => {
    const application = use(ApplicationContext);

    if (!application) {
        throw new Error("GtkApplicationWindow requires a GtkApplication ancestor");
    }

    return application;
};

const createApplicationWindowComponent = (Component: ElementType): ((props: unknown) => ReactNode) =>
    createPortaledComponent(createPresentedWindowComponent(Component), useApplicationContainer);

/** @internal */
export { createApplicationWindowComponent };
