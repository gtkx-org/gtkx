import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton } from "@gtkx/jsx/gtk";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { logWidget, render, screen } from "../src/index.js";

afterEach(() => {
    vi.restoreAllMocks();
});

const VBox = ({ children }: { children: ReactNode }) => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL}>{children}</GtkBox>
);

describe("logWidget", () => {
    it("logs the formatted widget tree", async () => {
        const { container } = await render(<GtkButton label="Logged" />);
        const log = vi.spyOn(console, "log").mockImplementation(() => {});

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
        const log = vi.spyOn(console, "log").mockImplementation(() => {});

        logWidget([container, container]);

        expect(log).toHaveBeenCalledTimes(2);
    });

    it("honors formatting options", async () => {
        const { container } = await render(<GtkButton label="Truncated" />);
        const log = vi.spyOn(console, "log").mockImplementation(() => {});

        logWidget(container, { maxLength: 0 });

        expect(log).toHaveBeenCalledWith("");
    });
});

describe("RenderResult.debug", () => {
    it("defaults to the base element", async () => {
        const { debug } = await render(<GtkButton label="Default" />);
        const log = vi.spyOn(console, "log").mockImplementation(() => {});

        debug();

        expect(log).toHaveBeenCalledTimes(1);
        expect(log.mock.calls[0]?.[0]).toContain("button");
    });

    it("accepts an explicit widget and options", async () => {
        const { container, debug } = await render(<GtkButton label="Explicit" />);
        const log = vi.spyOn(console, "log").mockImplementation(() => {});

        debug(container, { maxLength: 0 });

        expect(log).toHaveBeenCalledWith("");
    });
});

describe("screen.debug", () => {
    it("logs the current screen root", async () => {
        await render(<GtkButton label="Screen" />);
        const log = vi.spyOn(console, "log").mockImplementation(() => {});

        screen.debug();

        expect(log).toHaveBeenCalledTimes(1);
    });
});
