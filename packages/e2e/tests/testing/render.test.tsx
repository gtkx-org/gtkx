import type { ReactNode } from "react";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { GSimpleAction } from "@gtkx/jsx/gio";
import { GtkApplication, GtkApplicationWindow, GtkBox, GtkButton, GtkEntry, GtkLabel, GtkWindow } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { createApplication } from "@gtkx/runtime";
import {
    act,
    cleanup,
    configure,
    type Container,
    findByRole,
    getConfig,
    queryAllByRole,
    render,
    screen,
    waitFor,
    type WrapperComponent,
} from "@gtkx/testing";
import { Component, createContext, createRef, useContext, useEffect, useLayoutEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { withHostWindow, withStolenActivation } from "./widget-fixtures.js";

const NON_UNIQUE = Gio.ApplicationFlags.NON_UNIQUE;
const APPLICATION_ID = "org.gtkx.defaultapplication";
const RERENDER_BUDGET_MS = 250;
const IMPATIENT_SETTLE_MS = 20;
const initialConfig = { ...getConfig() };
const WrapperContext = createContext("default");
const entryRef = createRef<Gtk.Entry>();

const Thrower = (): ReactNode => {
    throw new Error("boom");
};

const WrappingProvider: WrapperComponent = ({ children }) => (
    <WrapperContext.Provider value="wrapped">{children}</WrapperContext.Provider>
);

const AutoFocusedEntry = (): ReactNode => {
    useEffect(() => {
        entryRef.current?.grabFocus();
    }, []);

    return <GtkEntry ref={entryRef} placeholderText="Search tasks" />;
};

const ApplicationProbe = (): ReactNode => {
    const [count, setCount] = useState(0);

    return (
        <GtkApplication
            applicationId={APPLICATION_ID}
            flags={NON_UNIQUE}
            actions={(
                <GSimpleAction
                    name="bump"
                    onActivate={() => {
                        setCount((current) => current + 1);
                    }}
                />
            )}
        >
            <GtkApplicationWindow defaultWidth={100} defaultHeight={100}>
                <GtkLabel name="count">{`Count: ${String(count)}`}</GtkLabel>
            </GtkApplicationWindow>
        </GtkApplication>
    );
};

const expectFocusedEntry = (): void => {
    const root = entryRef.current?.getRoot();
    expect(root instanceof Gtk.Window ? root.isActive() : null).toBe(true);
    expect(entryRef.current).toHaveFocus();
};

const renderApplicationProbe = async (): Promise<Gtk.Application> => {
    await render(<ApplicationProbe />, { container: rootElement });
    const label = await screen.findByName("count");
    const application = (label.getRoot() as Gtk.ApplicationWindow).getApplication();

    if (application === null) {
        throw new Error("the rendered window was never attached to an application");
    }

    expect(Gio.Application.getDefault()).toBe(application);

    return application;
};

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
    static getDerivedStateFromError(): { hasError: boolean } {
        return { hasError: true };
    }

    override state = { hasError: false };

    override render(): ReactNode {
        return this.state.hasError ? <GtkLabel>error</GtkLabel> : this.props.children;
    }
}

afterEach(() => {
    configure(initialConfig);
});

describe("render", () => {
    it("mounts a tree into a fresh queryable window and updates it on rerender", async () => {
        const { container, findByRole: find, findByText, queryByText, rerender } = await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkButton label="First" />
                <GtkLabel>Second</GtkLabel>
            </GtkBox>,
        );

        expect(container).toBeRooted();
        expect(await find(Gtk.AccessibleRole.WINDOW)).toBe(container);
        await find(Gtk.AccessibleRole.BUTTON, { name: "First" });
        await findByText("Second");
        await rerender(<GtkLabel>Updated</GtkLabel>);
        await findByText("Updated");
        expect(queryByText("Second")).toBeNull();
    });

    it("mounts at the reconciler root and into a caller-provided widget", async () => {
        const { findByRole: findAtRoot } = await render(
            <GtkApplication applicationId="org.gtkx.rendertest" flags={NON_UNIQUE}>
                <GtkApplicationWindow title="Own Window">
                    <GtkButton label="Inside" />
                </GtkApplicationWindow>
            </GtkApplication>,
            { container: rootElement },
        );

        expect(await findAtRoot(Gtk.AccessibleRole.WINDOW, { name: "Own Window" })).toContainOneByRole(
            Gtk.AccessibleRole.BUTTON,
            { name: "Inside" },
        );

        const host = new Gtk.Window({ defaultWidth: 200, defaultHeight: 120 });
        const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
        host.setChild(box);
        host.present();
        const { container, findByRole: findInBox } = await render(<GtkButton label="Into Box" />, { container: box });
        expect(container).toBe(box);
        expect(box).toContainElement(await findInBox(Gtk.AccessibleRole.BUTTON, { name: "Into Box" }));
        host.destroy();
    });

    it("applies the wrapper on the first render and on every rerender", async () => {
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

    it("tears the host window down on unmount and on cleanup, and renders again after", async () => {
        const unmounted = await render(<GtkButton label="Test" />);
        await unmounted.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Test" });
        await unmounted.unmount();
        expect(Gtk.Window.listToplevels()).not.toContain(unmounted.container);
        const cleaned = await render(<GtkLabel>First</GtkLabel>);
        await cleaned.findByText("First");
        await cleanup();
        expect(Gtk.Window.listToplevels()).not.toContain(cleaned.container);
        const { findByText } = await render(<GtkLabel>Second</GtkLabel>);
        expect(await findByText("Second")).toBeRooted();
    });

    it("honors strict mode, error callbacks and extra queries", async () => {
        const renders = { plain: 0, strict: 0 };

        const countPlain = (): void => {
            renders.plain += 1;
        };

        const countStrict = (): void => {
            renders.strict += 1;
        };

        const Plain = (): ReactNode => <GtkButton label="plain" ref={countPlain} />;
        const Strict = (): ReactNode => <GtkButton label="strict" ref={countStrict} />;
        await render(<Plain />);
        await render(<Strict />, { isReactStrictMode: true });
        expect(renders.plain).toBe(1);
        expect(renders.strict).toBeGreaterThan(1);
        const onRecoverableError = vi.fn();

        const { getFirstButton } = await render(<GtkButton label="Custom" />, {
            onRecoverableError,
            queries: {
                getFirstButton: (container: Container): Gtk.Widget | null =>
                    queryAllByRole(container, Gtk.AccessibleRole.BUTTON)[0] ?? null,
            },
        });

        expect(getFirstButton()).toHaveTextContent("Custom");
        expect(onRecoverableError).not.toHaveBeenCalled();
    });

    it("throws when the tree throws, reporting it to onCaughtError", async () => {
        const onCaughtError = vi.fn();

        await expect(
            render(
                <ErrorBoundary>
                    <Thrower />
                </ErrorBoundary>,
                { onCaughtError },
            ),
        ).rejects.toThrow();

        expect(onCaughtError).toHaveBeenCalled();
    });
});

describe("render window activation", () => {
    it("reports a widget that grabs focus on mount as focused in the harness window", async () => {
        await render(<AutoFocusedEntry />);
        expectFocusedEntry();
    });

    it("reports it as focused when the tree presents its own window", async () => {
        await render(
            <GtkWindow title="App" defaultWidth={200} defaultHeight={140}>
                <AutoFocusedEntry />
            </GtkWindow>,
            { container: rootElement },
        );

        expectFocusedEntry();
    });

    it("reports it as focused when rendering into a window the caller presented", async () => {
        await withHostWindow(async (host, content) => {
            host.present();
            await render(<AutoFocusedEntry />, { container: content });
            expect(host.isActive()).toBe(true);
            expectFocusedEntry();
        });
    });

    it("takes activation back from a toplevel holding it before resolving", async () => {
        await withStolenActivation(async () => {
            await render(<AutoFocusedEntry />);
            expectFocusedEntry();
        });
    });

    it("waits for a window presented between renders, but not for stolen activation", async () => {
        await withHostWindow(async (host, content) => {
            const { rerender } = await render(<GtkLabel>Before</GtkLabel>, { container: content });
            host.present();
            await rerender(<AutoFocusedEntry />);
            expect(host.getWidth()).toBeGreaterThan(0);
            expectFocusedEntry();
        });

        const { container, findByText, rerender } = await render(<GtkLabel>Before</GtkLabel>);

        await withStolenActivation(async () => {
            await waitFor(() => {
                expect(container instanceof Gtk.Window ? container.isActive() : null).toBe(false);
            });

            const startedAt = Date.now();
            await rerender(<GtkLabel>After</GtkLabel>);
            expect(Date.now() - startedAt).toBeLessThan(RERENDER_BUDGET_MS);
        });

        expect(await findByText("After")).toBeRooted();
    });

    it("throws when the window it rendered into never becomes readable", async () => {
        configure({ windowActivationTimeout: IMPATIENT_SETTLE_MS });

        await withHostWindow(async (host, content) => {
            host.present();

            await waitFor(() => {
                expect(host.isActive()).toBe(true);
            });

            host.setVisible(false);
            await expect(render(<GtkLabel>Unshown</GtkLabel>, { container: content })).rejects.toThrow();
        });
    });
});

describe("Gio.Application.getDefault", () => {
    it("hands back the mounted application on every render, not the first one built", async () => {
        const first = await renderApplicationProbe();
        await cleanup();
        const second = await renderApplicationProbe();
        expect(second).not.toBe(first);
        expect(second.getIsRegistered()).toBe(true);
    });

    it("activates an action through the application the current render started", async () => {
        await renderApplicationProbe();
        const current = Gio.Application.getDefault();
        expect(current?.listActions()).toContain("bump");

        await act(() => {
            current?.activateAction("bump", null);
        });

        expect(await screen.findByText("Count: 1")).toBeRooted();
    });

    it("hands back nothing after cleanup, and ignores an application that is never rendered", async () => {
        await renderApplicationProbe();
        await cleanup();
        expect(Gio.Application.getDefault()).toBeNull();

        const unrendered = createApplication(Gio.Application, {
            applicationId: `${APPLICATION_ID}.unrendered`,
            flags: NON_UNIQUE,
        });

        expect(unrendered.getIsRegistered()).toBe(false);
        expect(Gio.Application.getDefault()).toBeNull();
        await renderApplicationProbe();
    });
});

describe("configure", () => {
    it("merges a partial object and a function into the current configuration", () => {
        expect(getConfig().throwSuggestions).toBe(false);
        configure({ throwSuggestions: true });
        expect(getConfig().throwSuggestions).toBe(true);
        configure((current) => ({ throwSuggestions: !current.throwSuggestions }));
        expect(getConfig().throwSuggestions).toBe(false);
    });

    it("routes query failures through the configured error factory", async () => {
        class CustomError extends Error {}
        configure({ getElementError: (message) => new CustomError(message) });
        const { container } = await render(<GtkLabel>Test</GtkLabel>);
        await expect(findByRole(container, Gtk.AccessibleRole.BUTTON, { timeout: 100 })).rejects.toThrow();
    });
});
