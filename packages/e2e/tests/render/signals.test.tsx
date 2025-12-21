import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkButton, GtkEntry, GtkSwitch } from "@gtkx/react";
import { fireEvent, render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

describe("render - signals", () => {
    describe("connection", () => {
        it("connects onClicked handler to clicked signal", async () => {
            const handleClick = vi.fn();
            const ref = createRef<Gtk.Button>();

            await render(<GtkButton ref={ref} onClicked={handleClick} label="Click" />, { wrapper: false });

            expect(ref.current).not.toBeNull();
            await fireEvent(ref.current as Gtk.Widget, "clicked");

            expect(handleClick).toHaveBeenCalledTimes(1);
        });

        it("connects onActivate handler to activate signal", async () => {
            const handleActivate = vi.fn();
            const ref = createRef<Gtk.Entry>();

            await render(<GtkEntry ref={ref} onActivate={handleActivate} />, { wrapper: false });

            expect(ref.current).not.toBeNull();
            await fireEvent(ref.current as Gtk.Widget, "activate");

            expect(handleActivate).toHaveBeenCalledTimes(1);
        });

        it("connects onStateSet handler to state-set signal", async () => {
            const handleStateSet = vi.fn(() => false);
            const ref = createRef<Gtk.Switch>();

            await render(<GtkSwitch ref={ref} onStateSet={handleStateSet} />, { wrapper: false });

            expect(ref.current).not.toBeNull();
            await fireEvent(
                ref.current as Gtk.Widget,
                "state-set",
                { type: { type: "boolean" }, value: true },
                { type: { type: "ref", innerType: { type: "int", size: 32 } }, value: { value: 0 } },
            );

            expect(handleStateSet).toHaveBeenCalledTimes(1);
        });
    });

    describe("disconnection", () => {
        it("disconnects handler when prop removed", async () => {
            const handleClick = vi.fn();
            const ref = createRef<Gtk.Button>();

            function App({ hasHandler }: { hasHandler: boolean }) {
                return <GtkButton ref={ref} onClicked={hasHandler ? handleClick : undefined} label="Click" />;
            }

            await render(<App hasHandler={true} />, { wrapper: false });

            await fireEvent(ref.current as Gtk.Widget, "clicked");
            expect(handleClick).toHaveBeenCalledTimes(1);

            await render(<App hasHandler={false} />, { wrapper: false });

            await fireEvent(ref.current as Gtk.Widget, "clicked");
            expect(handleClick).toHaveBeenCalledTimes(1);
        });

        it("disconnects handler when widget unmounted", async () => {
            const handleClick = vi.fn();
            const ref = createRef<Gtk.Button>();

            function App({ showButton }: { showButton: boolean }) {
                return showButton ? <GtkButton ref={ref} onClicked={handleClick} label="Click" /> : null;
            }

            await render(<App showButton={true} />, { wrapper: false });

            const button = ref.current;
            await fireEvent(button as Gtk.Widget, "clicked");
            expect(handleClick).toHaveBeenCalledTimes(1);

            await render(<App showButton={false} />, { wrapper: false });
        });
    });

    describe("updates", () => {
        it("replaces handler when function reference changes", async () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();
            const ref = createRef<Gtk.Button>();

            function App({ useHandler1 }: { useHandler1: boolean }) {
                return <GtkButton ref={ref} onClicked={useHandler1 ? handler1 : handler2} label="Click" />;
            }

            await render(<App useHandler1={true} />, { wrapper: false });

            await fireEvent(ref.current as Gtk.Widget, "clicked");
            expect(handler1).toHaveBeenCalledTimes(1);
            expect(handler2).not.toHaveBeenCalled();

            await render(<App useHandler1={false} />, { wrapper: false });

            await fireEvent(ref.current as Gtk.Widget, "clicked");
            expect(handler1).toHaveBeenCalledTimes(1);
            expect(handler2).toHaveBeenCalledTimes(1);
        });

        it("maintains handler when function reference is stable", async () => {
            const handleClick = vi.fn();
            const ref = createRef<Gtk.Button>();

            function App({ label }: { label: string }) {
                return <GtkButton ref={ref} onClicked={handleClick} label={label} />;
            }

            await render(<App label="First" />, { wrapper: false });

            await render(<App label="Second" />, { wrapper: false });

            await fireEvent(ref.current as Gtk.Widget, "clicked");
            expect(handleClick).toHaveBeenCalledTimes(1);
        });
    });

    describe("signal arguments", () => {
        it("receives signal arguments in callback", async () => {
            const handleStateSet = vi.fn(() => false);
            const ref = createRef<Gtk.Switch>();

            await render(<GtkSwitch ref={ref} onStateSet={handleStateSet} />, { wrapper: false });

            await fireEvent(
                ref.current as Gtk.Widget,
                "state-set",
                { type: { type: "boolean" }, value: true },
                { type: { type: "ref", innerType: { type: "int", size: 32 } }, value: { value: 0 } },
            );

            expect(handleStateSet).toHaveBeenCalledWith(expect.anything(), true);
        });

        it("receives widget as first argument", async () => {
            const handleClick = vi.fn();
            const ref = createRef<Gtk.Button>();

            await render(<GtkButton ref={ref} onClicked={handleClick} label="Click" />, { wrapper: false });

            await fireEvent(ref.current as Gtk.Widget, "clicked");

            expect(handleClick).toHaveBeenCalledWith(ref.current);
        });
    });
});
