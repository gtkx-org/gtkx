import { rmSync } from "node:fs";
import { expect } from "vitest";
import { isToolFailure } from "./app-session.js";
import {
    createConfiguredProject,
    type referenceSession,
    REQUEST_OPTIONS,
    writePropsConfig,
} from "./reference-session.js";

type InvalidProps = {
    title: string;
    module: string;
    exported: string;
};

const expectConfiguredPropsRejection = async (
    session: ReturnType<typeof referenceSession>,
    { module, exported }: InvalidProps,
): Promise<void> => {
    const { apiDocs, state } = session;
    const project = createConfiguredProject();
    const request = { symbol: "GtkButton", projectRoot: project };

    try {
        expect(await apiDocs(request)).toContain("### `auditCaption`");
        writePropsConfig(project, exported, module);
        await expect.poll(
            () => isToolFailure(state.server.client, "gtkx_get_api_docs", request, REQUEST_OPTIONS),
        ).toBe(true);
        writePropsConfig(project);
        await expect.poll(() => apiDocs(request)).toContain("### `auditCaption`");
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
};

export { type InvalidProps, expectConfiguredPropsRejection };
