import * as Gio from "@gtkx/gi/gio";
import { GtkApplication } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { render, type RenderResult } from "@gtkx/testing";
import { Demo } from "../src/app.js";
import { createApplicationIdFactory } from "./test-utils.js";

const createAppRenderer = (prefix: string): () => Promise<RenderResult> => {
    const nextApplicationId = createApplicationIdFactory(prefix);

    return async () =>
        await render(
            <GtkApplication applicationId={nextApplicationId()} flags={Gio.ApplicationFlags.NON_UNIQUE}>
                <Demo />
            </GtkApplication>,
            { container: rootElement },
        );
};

export { createAppRenderer };
