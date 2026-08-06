import type { ElementType, ReactNode } from "react";
import { isRecord } from "@gtkx/utils";
import type { Container } from "../reconciler/host-config.js";
import { rootElement } from "../reconciler/root-element.js";
import { createPortal } from "../reconciler/root.js";

const useRootContainer = (): Container => rootElement;

const createPortaledComponent =
    (Component: ElementType, useContainer: () => Container = useRootContainer): ((props: unknown) => ReactNode) =>
        (props: unknown): ReactNode =>
            createPortal(<Component {...(isRecord(props) ? props : {})} />, useContainer());

export { createPortaledComponent };
