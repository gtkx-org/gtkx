import { cpSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, vi } from "vitest";
import { callText, createProject, type McpServer, startServer } from "./app-session.js";

const REFERENCE_TIMEOUT = 120_000;
const REQUEST_OPTIONS = { timeout: REFERENCE_TIMEOUT };
const CONFIGURED_PROPS_FIXTURE = fileURLToPath(
    new URL("../../cli/tests/fixtures/configured-props/@audit", import.meta.url),
);
const PROPS_MODULE = "@audit/element-props";

const writePropsConfig = (root: string, exportName = "AliasProps", moduleName = PROPS_MODULE): void => {
    const config = {
        applicationId: "org.gtkx.configuredprops",
        elements: { config: { GtkButton: { props: { module: moduleName, export: exportName } } } },
    };
    writeFileSync(join(root, "gtkx.config.mjs"), `export default ${JSON.stringify(config)};\n`);
};

const createConfiguredProject = (): string => {
    const root = createProject();
    cpSync(CONFIGURED_PROPS_FIXTURE, join(root, "node_modules", "@audit"), { recursive: true });
    writePropsConfig(root);

    return root;
};

const referenceSession = () => {
    vi.setConfig({ testTimeout: 600_000, expect: { poll: { timeout: REFERENCE_TIMEOUT } } });
    const state = { project: "", server: {} as McpServer };
    const listApi = (args: Record<string, unknown> = {}): Promise<string> =>
        callText(state.server.client, "gtkx_list_api", args, REQUEST_OPTIONS);
    const searchApi = (args: Record<string, unknown>): Promise<string> =>
        callText(state.server.client, "gtkx_search_api", args, REQUEST_OPTIONS);
    const apiDocs = (args: Record<string, unknown>): Promise<string> =>
        callText(state.server.client, "gtkx_get_api_docs", args, REQUEST_OPTIONS);
    const readResource = async (uri: string): Promise<string> => {
        const result = await state.server.client.readResource({ uri }, REQUEST_OPTIONS);
        const [entry] = result.contents;

        return entry && "text" in entry ? entry.text : "";
    };

    beforeAll(async () => {
        state.project = createProject();
        state.server = await startServer(state.project);
    }, 120_000);

    afterAll(async () => {
        await state.server.stop();
        rmSync(state.project, { recursive: true, force: true });
    });

    return { apiDocs, listApi, readResource, searchApi, state };
};

export {
    createConfiguredProject,
    PROPS_MODULE,
    referenceSession,
    REQUEST_OPTIONS,
    writePropsConfig,
};
