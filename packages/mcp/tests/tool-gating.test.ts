import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { APPLICATION_ID, createProject, type McpServer, startServer } from "./app-session.js";

type Annotations = { readOnlyHint?: boolean; openWorldHint?: boolean };
type ListedTool = { name: string; annotations?: Annotations };

const LIBRARIES = ["GtkSource-5", "WebKit-6.0"];
const ACTION_TOOLS = ["gtkx_click", "gtkx_type", "gtkx_fire_event"];
const CONFIG_NAME = "gtkx.config.mjs";
const state: { servers: McpServer[]; projects: string[] } = { servers: [], projects: [] };

const configSource = (mcp: string): string =>
    `export default { applicationId: ${JSON.stringify(APPLICATION_ID)}, ` +
    `libraries: ${JSON.stringify(LIBRARIES)}${mcp} };\n`;

const projectWith = (mcp: string): string => {
    const root = createProject();
    state.projects.push(root);
    writeFileSync(join(root, CONFIG_NAME), configSource(mcp));

    return root;
};

const getTools = async (root: string, args: string[] = []): Promise<ListedTool[]> => {
    const server = await startServer(root, undefined, args);
    state.servers.push(server);
    const { tools } = await server.client.listTools();

    return tools as ListedTool[];
};

const getNames = (tools: ListedTool[]): string[] => tools.map((tool) => tool.name);

afterEach(async () => {
    const servers = [...state.servers];
    state.servers.length = 0;
    await Promise.all(servers.map((server) => server.stop()));

    for (const project of state.projects) {
        rmSync(project, { recursive: true, force: true });
    }

    state.projects.length = 0;
});

describe("gtkx-mcp tool gating", () => {
    it("registers every tool and annotates them as local and read-only where they are", async () => {
        const tools = await getTools(projectWith(""));
        const names = getNames(tools);
        expect(names).toEqual(expect.arrayContaining([...ACTION_TOOLS, "gtkx_get_widget_tree", "gtkx_search_api"]));
        expect(tools.every((tool) => tool.annotations?.openWorldHint === false)).toBe(true);
        const tree = tools.find((tool) => tool.name === "gtkx_get_widget_tree");
        const click = tools.find((tool) => tool.name === "gtkx_click");
        expect(tree?.annotations?.readOnlyHint).toBe(true);
        expect(click?.annotations?.readOnlyHint).toBe(false);
    });

    it("leaves out the tools that drive the app when the config asks for read-only", async () => {
        const names = getNames(await getTools(projectWith(", mcp: { readOnly: true }")));
        expect(names).toContain("gtkx_get_widget_tree");

        for (const name of ACTION_TOOLS) {
            expect(names).not.toContain(name);
        }
    });

    it("selects tools by pattern, with a leading bang excluding", async () => {
        const names = getNames(await getTools(projectWith(', mcp: { tools: ["gtkx_*_api", "!gtkx_list_api"] }')));
        expect(names).toEqual(["gtkx_search_api"]);
    });

    it("lets command line flags win over the config", async () => {
        const root = projectWith(', mcp: { tools: ["gtkx_list_apps"] }');
        const names = getNames(await getTools(root, ["--tools", "gtkx_search_api,gtkx_list_api"]));
        expect(names).toEqual(expect.arrayContaining(["gtkx_search_api", "gtkx_list_api"]));
        expect(names).not.toContain("gtkx_list_apps");
    });
});
