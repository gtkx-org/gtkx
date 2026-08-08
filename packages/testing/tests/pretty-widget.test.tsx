import { GtkButton } from "@gtkx/jsx/gtk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { logWidget, prettyWidget, render, screen } from "../src/index.js";
import { VBox } from "./widget-fixtures.js";

function spyOnConsoleLog() {
    return vi.spyOn(console, "log").mockImplementation(vi.fn());
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe("logWidget", () => {
    it("logs the formatted widget tree", async () => {
        const { container } = await render(<GtkButton label="Logged" />);
        const log = spyOnConsoleLog();
        logWidget(container);
        expect(log).toHaveBeenCalledTimes(1);
        expect(log.mock.calls[0]?.[0]).toContain("button");
    });

    it("logs each widget of an array", async () => {
        const { container } = await render(
            <VBox>
                <GtkButton label="One" />
                <GtkButton label="Two" />
            </VBox>,
        );

        const log = spyOnConsoleLog();
        logWidget([container, container]);
        expect(log).toHaveBeenCalledTimes(2);
    });

    it("honors formatting options", async () => {
        const { container } = await render(<GtkButton label="Truncated" />);
        const log = spyOnConsoleLog();
        logWidget(container, { maxLength: 0 });
        expect(log).toHaveBeenCalledWith("");
    });
});

describe("RenderResult.debug", () => {
    it("defaults to the base element", async () => {
        const { debug } = await render(<GtkButton label="Default" />);
        const log = spyOnConsoleLog();
        debug();
        expect(log).toHaveBeenCalledTimes(1);
        expect(log.mock.calls[0]?.[0]).toContain("button");
    });

    it("accepts an explicit widget and options", async () => {
        const { container, debug } = await render(<GtkButton label="Explicit" />);
        const log = spyOnConsoleLog();
        debug(container, { maxLength: 0 });
        expect(log).toHaveBeenCalledWith("");
    });
});

describe("screen.debug", () => {
    it("logs the current screen root", async () => {
        await render(<GtkButton label="Screen" />);
        const log = spyOnConsoleLog();
        screen.debug();
        expect(log).toHaveBeenCalledTimes(1);
    });
});

describe("prettyWidget maxDepth", () => {
    it("summarizes descendants past maxDepth and renders them in full otherwise", async () => {
        const { container } = await render(
            <VBox>
                <VBox>
                    <GtkButton label="Deep" />
                </VBox>
            </VBox>,
        );

        const shallow = prettyWidget(container, { maxDepth: 1 });
        expect(shallow).toContain("child widget");
        expect(shallow).toContain("hidden");
        expect(shallow).not.toContain("Deep");
        expect(prettyWidget(container)).toContain("Deep");
    });
});
