import type { ElementType, ReactNode } from "react";
import { isRecord } from "@gtkx/utils";
import { rootElement } from "../reconciler/root-element.js";
import { createPortal } from "../reconciler/root.js";

const createRootPortalComponent =
    (Component: ElementType): ((props: unknown) => ReactNode) =>
        (props: unknown): ReactNode =>
            createPortal(<Component {...(isRecord(props) ? props : {})} />, rootElement);

export { createRootPortalComponent };
