import { rootElement } from "@gtkx/react";
import { render, type RenderResult } from "@gtkx/testing";
import { App } from "../src/app.js";
import { createApplicationIdFactory } from "./test-utils.js";

const createAppRenderer = (prefix: string): () => Promise<RenderResult> => {
    const nextApplicationId = createApplicationIdFactory(prefix);

    return async () => await render(<App applicationId={nextApplicationId()} />, { container: rootElement });
};

export { createAppRenderer };
