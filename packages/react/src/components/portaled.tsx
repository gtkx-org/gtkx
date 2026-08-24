import type { ElementType, ReactNode } from "react";
import { isRecord } from "@gtkx/utils";
import type { ContainerTarget } from "../reconciler/host-config.js";
import { rootElement } from "../reconciler/root-element.js";
import { createPortal } from "../reconciler/root.js";

const useRootContainer = (): ContainerTarget => rootElement;

const createPortaledComponent =
    (Component: ElementType, useContainer: () => ContainerTarget = useRootContainer): ((props: unknown) => ReactNode) =>
        (props: unknown): ReactNode =>
            createPortal(<Component {...(isRecord(props) ? props : {})} />, useContainer());

export { createPortaledComponent };
