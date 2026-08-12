import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkApplication, GtkApplicationWindow, GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { Component, createContext, type ReactNode, useContext, useLayoutEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { cleanup, type Container, queryAllByRole, render, type WrapperComponent } from "../src/index.js";

const NON_UNIQUE = Gio.ApplicationFlags.NON_UNIQUE;
const WrapperContext = createContext("default");

const Thrower = (): ReactNode => {
    throw new Error("boom");
};

const WrappingProvider: WrapperComponent = ({ children }) => (
    <WrapperContext.Provider value="wrapped">{children}</WrapperContext.Provider>
);

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
    static getDerivedStateFromError(): { hasError: boolean } {
        return { hasError: true };
    }

    override state = { hasError: false };

    override render(): ReactNode {
        return this.state.hasError ? <GtkLabel>error</GtkLabel> : this.props.children;
    }
}

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
                <GtkLabel>Second</GtkLabel>
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
            { container: rootElement },
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
        const observed: { seen: string } = { seen: "default" };

        const Probe = (): ReactNode => {
            const value = useContext(WrapperContext);

            useLayoutEffect(() => {
                observed.seen = value;
            });

            return <GtkLabel>probe</GtkLabel>;
        };

        await render(<Probe />, { wrapper: WrappingProvider });
        expect(observed.seen).toBe("wrapped");
    });

    it("re-applies the wrapper on rerender", async () => {
        const seen: string[] = [];

        const Probe = ({ tag }: { tag: string }): ReactNode => {
            const value = useContext(WrapperContext);

            useLayoutEffect(() => {
                seen.push(`${tag}:${value}`);
            });

            return <GtkLabel>{tag}</GtkLabel>;
        };

        const { rerender, findByText } = await render(<Probe tag="first" />, { wrapper: WrappingProvider });
        await findByText("first");
        await rerender(<Probe tag="second" />);
        await findByText("second");
        expect(seen).toContain("first:wrapped");
        expect(seen).toContain("second:wrapped");
    });
});

describe("render lifecycle", () => {
    it("rerender updates content", async () => {
        const { findByText, rerender } = await render(<GtkLabel>Initial</GtkLabel>);
        await findByText("Initial");
        await rerender(<GtkLabel>Updated</GtkLabel>);
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

describe("render options", () => {
    it("double-invokes renders under isReactStrictMode", async () => {
        let plain = 0;

        const Plain = () => {
            plain++;

            return <GtkButton label="plain" />;
        };

        await render(<Plain />);
        expect(plain).toBe(1);
        let strict = 0;

        const Strict = () => {
            strict++;

            return <GtkButton label="strict" />;
        };

        await render(<Strict />, { isReactStrictMode: true });
        expect(strict).toBe(2);
    });

    it("invokes onCaughtError when an error boundary catches", async () => {
        const onCaughtError = vi.fn();

        await expect(
            render(
                <ErrorBoundary>
                    <Thrower />
                </ErrorBoundary>,
                { onCaughtError },
            ),
        ).rejects.toThrow("boom");

        expect(onCaughtError).toHaveBeenCalled();
    });

    it("accepts an onRecoverableError option without invoking it on a clean render", async () => {
        const onRecoverableError = vi.fn();
        const { findByRole } = await render(<GtkButton label="recover" />, { onRecoverableError });
        await findByRole(Gtk.AccessibleRole.BUTTON, { name: "recover" });
        expect(onRecoverableError).not.toHaveBeenCalled();
    });

    it("binds custom queries from the queries option", async () => {
        const { getFirstButton } = await render(<GtkButton label="Custom" />, {
            queries: {
                getFirstButton: (container: Container): Gtk.Widget | null =>
                    queryAllByRole(container, Gtk.AccessibleRole.BUTTON)[0] ?? null,
            },
        });

        expect(getFirstButton()).toBeInstanceOf(Gtk.Button);
    });
});

describe("cleanup", () => {
    it("removes rendered content and host windows", async () => {
        const { container } = await render(<GtkButton label="Test" />);
        await cleanup();
        expect(Gtk.Window.listToplevels()).not.toContain(container);
    });

    it("allows rendering again after cleanup", async () => {
        const { findByText } = await render(<GtkLabel>First</GtkLabel>);
        await findByText("First");
        await cleanup();
        const { findByText: findByText2 } = await render(<GtkLabel>Second</GtkLabel>);
        expect(await findByText2("Second")).toBeDefined();
    });
});
