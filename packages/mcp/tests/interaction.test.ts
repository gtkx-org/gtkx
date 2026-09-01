import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SerializedProperty, SerializedWidget } from "../src/protocol/schemas.js";
import {
    type AppSession,
    callTool,
    findWidget,
    isToolFailure,
    type QueryResult,
    queryWidgets,
    readWidgetProps,
    startAppSession,
} from "./app-session.js";

const BUTTON_LABEL = "Press me";
const EXPANDABLE_ROW = "alpha";
const CHILD_ROW = "alpha-child";
const TYPED_TEXT = "hello";
const REPLACEMENT_TEXT = "again";
const PNG_SIGNATURE = "89504e470d0a1a0a";
const session = {} as AppSession;
const counter = { labelId: "", buttonId: "", entryId: "" };

const getSignature = (bytes: Buffer): string => bytes.subarray(0, 8).toString("hex");

const queryAll = (by: string, value: string, options?: Record<string, unknown>): Promise<QueryResult> =>
    queryWidgets(session.client, by, value, options);

const queryOne = (by: string, value: string, options?: Record<string, unknown>): Promise<SerializedWidget> =>
    findWidget(session.client, by, value, options);

const readProperty = async (widgetId: string, property: string): Promise<SerializedProperty | undefined> => {
    const props = await readWidgetProps(session.client, widgetId, { properties: [property] });

    return props.properties?.[property];
};

const readClickCount = async (): Promise<number> => {
    const property = await readProperty(counter.labelId, "label");
    const groups = /^clicks: (?<count>\d+)$/.exec(String(property?.value ?? ""))?.groups;

    return Number(groups?.count);
};

const expanderFor = async (row: string): Promise<string> => {
    const label = await queryOne("text", row);
    const parent = await readProperty(label.id, "parent");
    expect(parent?.value).toBe("GtkTreeExpander");

    return parent?.widgetId ?? "";
};

beforeAll(async () => {
    Object.assign(session, await startAppSession());
    const label = await queryOne("text", "clicks: 0");
    const button = await queryOne("role", "button", { name: BUTTON_LABEL });
    const entry = await queryOne("role", "text_box");
    counter.labelId = label.id;
    counter.buttonId = button.id;
    counter.entryId = entry.id;
}, 120_000);

afterAll(async () => {
    await session.stop();
});

describe("gtkx_click", () => {
    it("clicks a button and the application renders the update", async () => {
        const before = await readClickCount();
        await callTool(session.client, "gtkx_click", { widgetId: counter.buttonId });
        expect(await readClickCount()).toBe(before + 1);
    });

    it("expands and collapses a tree row through its expander", async () => {
        const expanderId = await expanderFor(EXPANDABLE_ROW);
        await callTool(session.client, "gtkx_click", { widgetId: expanderId });
        const expanded = await queryAll("text", CHILD_ROW);
        expect(expanded.widgets.map((widget) => widget.text)).toEqual([CHILD_ROW]);
        await callTool(session.client, "gtkx_click", { widgetId: expanderId });
        const collapsed = await queryAll("text", CHILD_ROW);
        expect(collapsed.widgets).toEqual([]);
    });

    it("fails for a widget id nothing answers to", async () => {
        expect(await isToolFailure(session.client, "gtkx_click", { widgetId: "missing" })).toBe(true);
    });
});

describe("gtkx_type", () => {
    it("types into an entry and replaces its contents when asked to clear it", async () => {
        await callTool(session.client, "gtkx_type", { widgetId: counter.entryId, text: TYPED_TEXT });
        expect(await readProperty(counter.entryId, "text")).toEqual({ type: "gchararray", value: TYPED_TEXT });

        await callTool(session.client, "gtkx_type", {
            widgetId: counter.entryId,
            text: REPLACEMENT_TEXT,
            clear: true,
        });

        expect(await readProperty(counter.entryId, "text")).toEqual({ type: "gchararray", value: REPLACEMENT_TEXT });
    });
});

describe("gtkx_fire_event", () => {
    it("emits a signal on a widget", async () => {
        const before = await readClickCount();
        await callTool(session.client, "gtkx_fire_event", { widgetId: counter.buttonId, signal: "clicked" });
        expect(await readClickCount()).toBe(before + 1);
    });
});

describe("gtkx_take_screenshot", () => {
    it("captures a window as a PNG and writes it where it is asked to", async () => {
        const target = join(session.root, "shot.png");
        const result = await callTool(session.client, "gtkx_take_screenshot", { path: target });
        const image = result.content.find((entry) => entry.type === "image");
        expect(image?.mimeType).toBe("image/png");
        expect(getSignature(Buffer.from(image?.data ?? "", "base64"))).toBe(PNG_SIGNATURE);
        expect(getSignature(readFileSync(target))).toBe(PNG_SIGNATURE);
    });

    it("fails for a window id nothing answers to", async () => {
        expect(await isToolFailure(session.client, "gtkx_take_screenshot", { windowId: "missing" })).toBe(true);
    });
});
