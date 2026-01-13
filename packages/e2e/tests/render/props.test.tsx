import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkCheckButton, GtkLabel, GtkSwitch } from "@gtkx/react";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - props", () => {
    describe("property setting", () => {
        it("sets string properties", async () => {
            await render(<GtkLabel label="Test Label" />);

            const label = await screen.findByText("Test Label");
            expect(label).toBeDefined();
        });

        it("sets boolean properties", async () => {
            const ref = createRef<Gtk.Label>();

            await render(<GtkLabel ref={ref} selectable={true} />);

            expect(ref.current?.getSelectable()).toBe(true);
        });

        it("sets numeric properties", async () => {
            const ref = createRef<Gtk.Label>();

            await render(<GtkLabel ref={ref} maxWidthChars={20} />);

            expect(ref.current?.getMaxWidthChars()).toBe(20);
        });

        it("sets enum properties", async () => {
            const ref = createRef<Gtk.Box>();

            await render(<GtkBox ref={ref} orientation={Gtk.Orientation.VERTICAL} />);

            expect(ref.current?.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        });
    });

    describe("change detection", () => {
        it("skips update when value unchanged", async () => {
            function App() {
                return <GtkLabel label="Same" />;
            }

            const { rerender } = await render(<App />);

            const label = await screen.findByText("Same");
            expect(label).toBeDefined();

            await rerender(<App />);

            expect(screen.queryByText("Same")).not.toBeNull();
        });

        it("applies update when value changed", async () => {
            function App({ text }: { text: string }) {
                return <GtkLabel label={text} />;
            }

            const { rerender } = await render(<App text="Initial" />);
            await screen.findByText("Initial");

            await rerender(<App text="Updated" />);

            await waitFor(() => {
                expect(screen.queryByText("Updated")).not.toBeNull();
            });
        });

        it("handles undefined to value transition", async () => {
            function App({ label }: { label?: string }) {
                return <GtkLabel label={label} />;
            }

            const { rerender } = await render(<App label={undefined} />);

            await rerender(<App label="Now Set" />);

            await screen.findByText("Now Set");
        });

        it("handles value to undefined transition", async () => {
            const ref = createRef<Gtk.Label>();

            function App({ label }: { label?: string }) {
                return <GtkLabel ref={ref} label={label} />;
            }

            const { rerender } = await render(<App label="Has Value" />);
            await screen.findByText("Has Value");

            await rerender(<App label={undefined} />);
        });
    });

    describe("consumed props", () => {
        it("does not pass children prop to widget", async () => {
            const ref = createRef<Gtk.Box>();

            await render(
                <GtkBox ref={ref} orientation={Gtk.Orientation.VERTICAL}>
                    Child
                </GtkBox>,
            );

            expect(ref.current).not.toBeNull();
        });

        it("handles node-specific consumed props", async () => {
            await render(<GtkSwitch active={true} />);

            const switchWidget = await screen.findByRole(Gtk.AccessibleRole.SWITCH);
            expect(switchWidget).toBeDefined();
        });
    });

    describe("accessible state queries", () => {
        it("finds checkbox by checked state", async () => {
            await render(
                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                    <GtkCheckButton label="Unchecked" />
                    <GtkCheckButton label="Checked" active={true} />
                </GtkBox>,
            );

            const checkedBox = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, { checked: true });
            expect(checkedBox).toBeDefined();

            const uncheckedBox = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, { checked: false });
            expect(uncheckedBox).toBeDefined();
        });

        it("updates checkbox state after user interaction", async () => {
            await render(<GtkCheckButton label="Toggle Me" />);

            const checkbox = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, { checked: false });
            await userEvent.click(checkbox);

            await waitFor(() => {
                const checkedBox = screen.queryByRole(Gtk.AccessibleRole.CHECKBOX, { checked: true });
                expect(checkedBox).not.toBeNull();
            });
        });

        it("finds switch by accessible role", async () => {
            await render(<GtkSwitch />);

            const switchWidget = await screen.findByRole(Gtk.AccessibleRole.SWITCH);
            await userEvent.click(switchWidget);

            await waitFor(() => {
                expect((switchWidget as Gtk.Switch).getActive()).toBe(true);
            });
        });
    });
});
