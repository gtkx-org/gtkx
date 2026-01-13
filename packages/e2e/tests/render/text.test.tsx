import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox } from "@gtkx/react";
import { render, screen } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - text instances", () => {
    it("renders string child as Label", async () => {
        await render(<GtkBox orientation={Gtk.Orientation.VERTICAL}>Hello World</GtkBox>);

        const label = await screen.findByText("Hello World");
        expect(label).toBeDefined();
    });

    it("updates Label text when string changes", async () => {
        function App({ text }: { text: string }) {
            return <GtkBox orientation={Gtk.Orientation.VERTICAL}>{text}</GtkBox>;
        }

        const { rerender } = await render(<App text="Initial" />);

        await screen.findByText("Initial");

        await rerender(<App text="Updated" />);

        await screen.findByText("Updated");
    });

    it("handles empty string", async () => {
        const ref = createRef<Gtk.Box>();

        await render(
            <GtkBox ref={ref} orientation={Gtk.Orientation.VERTICAL}>
                {""}
            </GtkBox>,
        );

        expect(ref.current?.getFirstChild()).toBeNull();
    });

    it("handles unicode text", async () => {
        await render(<GtkBox orientation={Gtk.Orientation.VERTICAL}>你好世界 🌍 مرحبا</GtkBox>);

        const unicodeLabel = await screen.findByText("你好世界 🌍 مرحبا");
        expect(unicodeLabel).toBeDefined();
    });

    it("removes text instance when child removed", async () => {
        function App({ showText }: { showText: boolean }) {
            return <GtkBox orientation={Gtk.Orientation.VERTICAL}>{showText && "Removable Text"}</GtkBox>;
        }

        const { rerender } = await render(<App showText={true} />);

        await screen.findByText("Removable Text");

        await rerender(<App showText={false} />);

        expect(screen.queryByText("Removable Text")).toBeNull();
    });

    it("handles multiple text children", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                {"First"}
                {"Second"}
                {"Third"}
            </GtkBox>,
        );

        const allLabels = await screen.findAllByText(/First|Second|Third/);
        expect(allLabels).toHaveLength(3);

        await screen.findByText("First");
        await screen.findByText("Second");
        await screen.findByText("Third");
    });

    it("finds text with regex patterns", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                {"Error: File not found"}
                {"Warning: Low memory"}
                {"Info: Process complete"}
            </GtkBox>,
        );

        const errorMessage = await screen.findByText(/^Error:/);
        expect(errorMessage).toBeDefined();

        const warningMessage = await screen.findByText(/^Warning:/);
        expect(warningMessage).toBeDefined();

        const allMessages = await screen.findAllByText(/Error:|Warning:|Info:/);
        expect(allMessages).toHaveLength(3);
    });
});
