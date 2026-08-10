import type { SerializedWidget } from "@gtkx/mcp/internal";
import { dispatch } from "@gtkx/cli/internal";
import { GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { contextFor } from "./dispatch-context.js";

type QueryResult = { widgets: SerializedWidget[]; searched: string; hint?: string };

const BUTTON_LABEL = "Inspect me";
const PLAIN_TEXT = "Nothing inside";

const queryWidgets = async (params: object): Promise<QueryResult> =>
    await dispatch("widget.query", params, contextFor()) as QueryResult;

const getMatch = (result: QueryResult): SerializedWidget => {
    const [match] = result.widgets;

    if (match === undefined) {
        throw new Error(`Expected a match in ${JSON.stringify(result)}`);
    }

    return match;
};

const queryButton = async (): Promise<SerializedWidget> => {
    await render(<GtkButton label={BUTTON_LABEL} />);
    const result = await queryWidgets({ by: "role", value: "button", options: { name: BUTTON_LABEL } });

    return getMatch(result);
};

describe("widget.query matches", () => {
    it("returns a match without its descendants", async () => {
        const match = await queryButton();
        expect(match.type).toBe("Button");
        expect(match.children).toEqual([]);
    });

    it("counts the direct children it left out", async () => {
        const match = await queryButton();
        expect(match.hiddenChildren).toBe(1);
    });

    it("leaves hiddenChildren off a match that has nothing inside it", async () => {
        await render(<GtkLabel>{PLAIN_TEXT}</GtkLabel>);
        const result = await queryWidgets({ by: "text", value: PLAIN_TEXT });
        const match = getMatch(result);
        expect(match.type).toBe("Label");
        expect(match.hiddenChildren).toBeUndefined();
    });
});
