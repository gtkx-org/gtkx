import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SerializedWidget } from "../src/protocol/schemas.js";
import { DEFAULT_SUBTREE_DEPTH, MAX_SUBTREE_WIDGETS } from "../src/protocol/schemas.js";
import {
    APPLICATION_ID,
    type AppSession,
    callJson,
    callText,
    findWidget,
    isToolFailure,
    type QueryResult,
    queryWidgets,
    readWidgetProps,
    startAppSession,
    type WidgetProps,
} from "./app-session.js";

type AppEntry = { applicationId: string; pid: number; windows?: { id: string; title: string | null }[] };

const BUTTON_LABEL = "Press me";
const CHAIN_DEPTH = 10;
const WIDE_CHILDREN = 60;
const session = {} as AppSession;

const queryAll = (by: string, value: string, options?: Record<string, unknown>): Promise<QueryResult> =>
    queryWidgets(session.client, by, value, options);

const queryOne = (by: string, value: string, options?: Record<string, unknown>): Promise<SerializedWidget> =>
    findWidget(session.client, by, value, options);

const readProps = (widgetId: string, options: Record<string, unknown> = {}): Promise<WidgetProps> =>
    readWidgetProps(session.client, widgetId, options);

const descendantAt = (node: SerializedWidget, depth: number): SerializedWidget => {
    let current = node;

    for (let level = 0; level < depth; level += 1) {
        const [child] = current.children;

        if (child === undefined) {
            throw new Error(`Expected a descendant ${String(depth)} levels below ${node.type}`);
        }

        current = child;
    }

    return current;
};

const isProcessRunning = (pid: number): boolean => {
    try {
        return pid > 0 && process.kill(pid, 0);
    } catch {
        return false;
    }
};

const countNodes = (node: SerializedWidget): number =>
    node.children.reduce((total, child) => total + countNodes(child), 1);

beforeAll(async () => {
    Object.assign(session, await startAppSession());
}, 120_000);

afterAll(async () => {
    await session.stop();
});

describe("gtkx_list_apps", () => {
    it("lists the connected application with its open windows", async () => {
        const apps = await callJson<AppEntry[]>(session.client, "gtkx_list_apps");
        const [app] = apps;
        expect(app?.applicationId).toBe(APPLICATION_ID);
        expect(isProcessRunning(app?.pid ?? 0)).toBe(true);
        expect(app?.pid).not.toBe(session.pid);
        expect(app?.windows).toEqual([{ id: "0", title: "Probe" }]);
    });
});

describe("gtkx_get_widget_tree", () => {
    it("renders the whole widget tree with ids, roles and text", async () => {
        const tree = await callText(session.client, "gtkx_get_widget_tree");
        expect(tree).toContain("<ApplicationWindow");
        expect(tree).toContain('role="button"');
        expect(tree).toContain(BUTTON_LABEL);
    });

    it("renders one subtree, summarizing what a depth limit left out", async () => {
        const button = await queryOne("role", "button", { name: BUTTON_LABEL });
        const tree = await callText(session.client, "gtkx_get_widget_tree", { rootId: button.id, maxDepth: 0 });
        expect(tree).toContain("<Button");
        expect(tree).not.toContain("<Label");
        expect(tree).toContain("1 child widget");
    });

    it("fails for a root id no widget answers to", async () => {
        expect(await isToolFailure(session.client, "gtkx_get_widget_tree", { rootId: "missing" })).toBe(true);
    });
});

describe("gtkx_query_widgets", () => {
    it("finds a widget by role, by text and by name", async () => {
        const byRole = await queryOne("role", "button", { name: BUTTON_LABEL });
        const byText = await queryOne("text", "clicks: 0");
        const byName = await queryOne("name", "wide");
        expect(byRole.type).toBe("Button");
        expect(byText.type).toBe("Label");
        expect(byText.cssClasses).toEqual(["dim-label", "heading"]);
        expect(byName.type).toBe("Box");
    });

    it("returns a match without its descendants, counting the children it left out", async () => {
        const button = await queryOne("role", "button", { name: BUTTON_LABEL });
        const label = await queryOne("text", "clicks: 0");
        expect(button.children).toEqual([]);
        expect(button.hiddenChildren).toBe(1);
        expect(label.hiddenChildren).toBeUndefined();
    });

    it("reports no matches for text nothing renders", async () => {
        const result = await queryAll("text", "nothing renders this");
        expect(result.widgets).toEqual([]);
    });
});

describe("gtkx_get_widget_props", () => {
    it("returns the widget summary on its own when no properties are asked for", async () => {
        const button = await queryOne("role", "button", { name: BUTTON_LABEL });
        const props = await readProps(button.id);
        expect(props.text).toBe(BUTTON_LABEL);
        expect(props.role).toBe("button");
        expect(props.properties).toBeUndefined();
        expect(props.children.map((child) => child.type)).toEqual(["Label"]);
    });

    it("reads string, string array, enum and widget-valued properties under either spelling", async () => {
        const label = await queryOne("text", "clicks: 0");
        const props = await readProps(label.id, { properties: ["label", "cssClasses", "parent"] });
        expect(props.properties?.label).toEqual({ type: "gchararray", value: "clicks: 0" });
        expect(props.properties?.["css-classes"]).toEqual({ type: "GStrv", value: ["dim-label", "heading"] });
        const parent = props.properties?.parent;
        expect(parent?.value).toBe("GtkBox");
        const parentProps = await readProps(parent?.widgetId ?? "", { properties: ["orientation"] });

        expect(parentProps.properties?.orientation).toEqual({
            type: "GtkOrientation",
            value: "GTK_ORIENTATION_VERTICAL",
        });
    });

    it("bounds the subtree by depth, counting the direct children it left out", async () => {
        const chain = await queryOne("name", "chain");
        const bounded = await readProps(chain.id);
        expect(descendantAt(bounded, DEFAULT_SUBTREE_DEPTH).children).toEqual([]);
        expect(descendantAt(bounded, DEFAULT_SUBTREE_DEPTH).hiddenChildren).toBe(1);
        const deeper = await readProps(chain.id, { maxDepth: CHAIN_DEPTH });
        expect(descendantAt(deeper, CHAIN_DEPTH).text).toBe("deep");
    });

    it("bounds the subtree by widget count however deep it is asked to go", async () => {
        const wide = await queryOne("name", "wide");
        const props = await readProps(wide.id, { maxDepth: 1000 });
        expect(countNodes(props)).toBe(MAX_SUBTREE_WIDGETS);
        expect(props.hiddenChildren).toBe(WIDE_CHILDREN - MAX_SUBTREE_WIDGETS + 1);
    });

    it("fails for an unknown widget id, an unreadable property and an unknown application", async () => {
        const label = await queryOne("text", "clicks: 0");
        expect(await isToolFailure(session.client, "gtkx_get_widget_props", { widgetId: "missing" })).toBe(true);

        expect(await isToolFailure(session.client, "gtkx_get_widget_props", {
            widgetId: label.id,
            properties: ["collapsed"],
        })).toBe(true);

        expect(await isToolFailure(session.client, "gtkx_get_widget_props", {
            applicationId: "org.gtkx.absent",
            widgetId: label.id,
        })).toBe(true);
    });
});

describe("gtkx_get_widget_props - properties without an accessor", () => {
    it("reads a read-only property whose name a method shadows", async () => {
        const button = await queryOne("role", "button", { name: BUTTON_LABEL });
        const props = await readProps(button.id, { properties: ["hasFocus"] });
        expect(props.properties?.["has-focus"]?.type).toBe("gboolean");
    });
});
