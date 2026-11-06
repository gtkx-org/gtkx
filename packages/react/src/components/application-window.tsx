import type * as Gtk from "@gtkx/gi/gtk";
import { type ElementType, type ReactNode, use } from "react";
import { ApplicationContext } from "../hooks/use-application.js";
import { createPortaledComponent } from "./portaled.js";
import { createPresentedWindowComponent } from "./window.js";

const useWindowApplication = (): Gtk.Application => {
    const application = use(ApplicationContext);

    if (!application) {
        throw new Error(
            "Application windows must be rendered inside an application element such as <AdwApplication>, which they register with",
        );
    }

    return application;
};

const createApplicationWindowComponent = (Component: ElementType): ((props: unknown) => ReactNode) =>
    createPortaledComponent(createPresentedWindowComponent(Component), useWindowApplication);

/** @internal */
export { createApplicationWindowComponent };
