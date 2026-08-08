import type { ReactNode } from "react";
import * as Gio from "@gtkx/gi/gio";
import { GtkApplication } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createAppIdFactory } from "./unique-name.js";

type ApplicationRenderResult = {
    rerender: (element: ReactNode) => Promise<void>;
};

type ApplicationRenderer = (element: ReactNode) => Promise<ApplicationRenderResult>;

const createApplicationRenderer = (prefix: string): ApplicationRenderer => {
    const uniqueAppId = createAppIdFactory(prefix);

    return async (element) => {
        const appId = uniqueAppId();

        const inApplication = (child: ReactNode): ReactNode => (
            <GtkApplication applicationId={appId} flags={Gio.ApplicationFlags.NON_UNIQUE}>
                {child}
            </GtkApplication>
        );

        const { rerender } = await render(inApplication(element), { container: rootElement });

        return {
            rerender: async (next: ReactNode) => {
                await rerender(inApplication(next));
            },
        };
    };
};

export { createApplicationRenderer };
