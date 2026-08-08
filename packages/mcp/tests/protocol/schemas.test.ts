import { describe, expect, it } from "vitest";
import { ServerRequestParamsSchemas } from "../../src/protocol/schemas.js";

describe("ServerRequestParamsSchemas", () => {
    it("validates a widget.query payload with a by enum and no applicationId", () => {
        const parsed = ServerRequestParamsSchemas["widget.query"].safeParse({
            by: "role",
            value: "BUTTON",
            options: { exact: true },
        });

        expect(parsed.success).toBe(true);
    });

    it("rejects a widget.query payload with an unknown by value", () => {
        const parsed = ServerRequestParamsSchemas["widget.query"].safeParse({ by: "id", value: "x" });
        expect(parsed.success).toBe(false);
    });

    it("requires widgetId for widget.getProps", () => {
        expect(ServerRequestParamsSchemas["widget.getProps"].safeParse({}).success).toBe(false);
        expect(ServerRequestParamsSchemas["widget.getProps"].safeParse({ widgetId: "3" }).success).toBe(true);
    });

    it("makes the widget.getProps property list optional", () => {
        const schema = ServerRequestParamsSchemas["widget.getProps"];
        expect(schema.safeParse({ widgetId: "3" }).data?.properties).toBeUndefined();
        expect(schema.safeParse({ widgetId: "3", properties: ["collapsed"] }).success).toBe(true);
        expect(schema.safeParse({ widgetId: "3", properties: "collapsed" }).success).toBe(false);
    });

    it("accepts an empty payload for app.getWindows", () => {
        expect(ServerRequestParamsSchemas["app.getWindows"].safeParse({}).success).toBe(true);
    });

    it("makes the screenshot windowId optional", () => {
        expect(ServerRequestParamsSchemas["widget.screenshot"].safeParse({}).success).toBe(true);
        expect(ServerRequestParamsSchemas["widget.screenshot"].safeParse({ windowId: "1" }).success).toBe(true);
    });
});
