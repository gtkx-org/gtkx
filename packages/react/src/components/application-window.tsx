import type { ElementType, ReactNode } from "react";
import { useApplication } from "../hooks/use-application.js";
import { createPortaledComponent } from "./portaled.js";
import { createPresentedWindowComponent } from "./window.js";

const createApplicationWindowComponent = (Component: ElementType): ((props: unknown) => ReactNode) =>
    createPortaledComponent(createPresentedWindowComponent(Component), useApplication);

/** @internal */
export { createApplicationWindowComponent };
