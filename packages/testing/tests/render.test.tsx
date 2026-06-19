import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkApplication, GtkApplicationWindow, GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { createContext, type ReactNode, useContext } from "react";
import { describe, expect, it } from "vitest";
import { cleanup, createRootElement, render, type WrapperComponent } from "../src/index.js";

const NON_UNIQUE = Gio.ApplicationFlags.NON_UNIQUE;

describe("render basics", () => {
    it("renders a simple element", async () => {
        const { findByRole } = await render(<GtkButton label="Click me" />);
        const button = await findByRole(Gtk.AccessibleRole.BUTTON, { name: "Click me" });
        expect(button).toBeDefined();
    });

    it("renders nested elements", async () => {
        const { findByRole, findByText } = await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkButton label="First" />
                <GtkLabel label="Second" />
            </GtkBox>,
        );

        expect(await findByRole(Gtk.AccessibleRole.BUTTON, { name: "First" })).toBeDefined();
        expect(await findByText("Second")).toBeDefined();
    });

    it("mounts into a fresh Gtk.Window container by default", async () => {
        const { container } = await render(<GtkButton label="Test" />);
        expect(container).toBeInstanceOf(Gtk.Window);
    });

    it("makes the default container queryable as a WINDOW", async () => {
        const { findByRole } = await render(<GtkButton label="Test" />);
        expect(await findByRole(Gtk.AccessibleRole.WINDOW)).toBeDefined();
    });
});

describe("render container", () => {
    it("renders a top-level element directly at the reconciler root", async () => {
        const { findByRole } = await render(
            <GtkApplication applicationId="org.gtkx.rendertest" flags={NON_UNIQUE}>
                <GtkApplicationWindow title="Own Window">
                    <GtkButton label="Inside" />
                </GtkApplicationWindow>
            </GtkApplication>,
            { container: createRootElement() },
        );

        expect(await findByRole(Gtk.AccessibleRole.WINDOW, { name: "Own Window" })).toBeDefined();
        expect(await findByRole(Gtk.AccessibleRole.BUTTON, { name: "Inside" })).toBeDefined();
    });

    it("mounts into a provided widget container", async () => {
        const host = new Gtk.Window({ defaultWidth: 200, defaultHeight: 120 });
        const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
        host.setChild(box);
        host.present();

        const { container, findByRole } = await render(<GtkButton label="Into Box" />, { container: box });

        expect(container).toBe(box);
        expect(await findByRole(Gtk.AccessibleRole.BUTTON, { name: "Into Box" })).toBeDefined();
        host.destroy();
    });
});

describe("render wrapper", () => {
    it("applies a context-provider wrapper around the element", async () => {
        const Context = createContext("default");
        const Provider: WrapperComponent = ({ children }) => (
            <Context.Provider value="wrapped">{children}</Context.Provider>
        );
        let seen = "default";
        const Probe = (): ReactNode => {
            seen = useContext(Context);
            return <GtkLabel label="probe" />;
        };

        await render(<Probe />, { wrapper: Provider });
        expect(seen).toBe("wrapped");
    });

    it("re-applies the wrapper on rerender", async () => {
        const Context = createContext("default");
        const Provider: WrapperComponent = ({ children }) => (
            <Context.Provider value="wrapped">{children}</Context.Provider>
        );
        const seen: string[] = [];
        const Probe = ({ tag }: { tag: string }): ReactNode => {
            seen.push(`${tag}:${useContext(Context)}`);
            return <GtkLabel label={tag} />;
        };

        const { rerender, findByText } = await render(<Probe tag="first" />, { wrapper: Provider });
        await findByText("first");
        await rerender(<Probe tag="second" />);
        await findByText("second");

        expect(seen).toContain("first:wrapped");
        expect(seen).toContain("second:wrapped");
    });
});

describe("render lifecycle", () => {
    it("rerender updates content", async () => {
        const { findByText, rerender } = await render(<GtkLabel label="Initial" />);

        await findByText("Initial");
        await rerender(<GtkLabel label="Updated" />);

        expect(await findByText("Updated")).toBeDefined();
    });

    it("unmount removes content and destroys the host window", async () => {
        const { container, findByRole, unmount } = await render(<GtkButton label="Test" />);

        await findByRole(Gtk.AccessibleRole.BUTTON, { name: "Test" });
        await unmount();

        expect(Gtk.Window.listToplevels()).not.toContain(container);
    });

    it("provides a debug function", async () => {
        const { debug } = await render(<GtkButton label="Debug Test" />);
        expect(typeof debug).toBe("function");
    });
});

describe("cleanup", () => {
    it("removes rendered content and host windows", async () => {
        const { container } = await render(<GtkButton label="Test" />);
        await cleanup();

        expect(Gtk.Window.listToplevels()).not.toContain(container);
    });

    it("allows rendering again after cleanup", async () => {
        const { findByText } = await render(<GtkLabel label="First" />);
        await findByText("First");

        await cleanup();

        const { findByText: findByText2 } = await render(<GtkLabel label="Second" />);
        expect(await findByText2("Second")).toBeDefined();
    });
});
