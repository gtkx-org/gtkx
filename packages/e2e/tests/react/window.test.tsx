import type { GtkApplicationWindowProps } from "@gtkx/jsx/gtk";
import type { ReactNode, RefObject } from "react";
import * as Adw from "@gtkx/gi/adw";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwAlertDialog, AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
import { GSimpleAction } from "@gtkx/jsx/gio";
import { GtkApplication, GtkApplicationWindow, GtkBox, GtkLabel, GtkWindow } from "@gtkx/jsx/gtk";
import { rootElement, useParentWindow } from "@gtkx/react";
import { act, render as baseRender, render, screen, waitFor } from "@gtkx/testing";
import { Activity, createRef, Suspense, use, useEffect, useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { createApplicationRenderer } from "../helpers/application-render.js";
import { createAppIdFactory } from "../helpers/unique-name.js";

type Captured = { label: Gtk.Label | null; calls: number };
type ProbeProps = { slot: string };
type Captured2 = { widget: Gtk.Widget | null };
type DeferredPromise = { promise: Promise<string>; resolve: () => void };

const APP_FLAGS = Gio.ApplicationFlags.NON_UNIQUE;
const uniqueAppId = createAppIdFactory("org.gtkx.windowtest");
const renderApplication = createApplicationRenderer("org.gtkx.windowchildref");
const uniqueAppId2 = createAppIdFactory("org.gtkx.topleveparentingtest");
const captured: Record<string, Gtk.Window | null> = {};
const renderApplication2 = createApplicationRenderer("org.gtkx.useparentwindowtest");

const renderInApplication = (element: ReactNode, appId: string = uniqueAppId()) =>
    baseRender(
        <GtkApplication applicationId={appId} flags={APP_FLAGS}>
            {element}
        </GtkApplication>,
        { container: rootElement },
    );

const renderAdw = (element: ReactNode, appId: string = uniqueAppId()) =>
    baseRender(
        <AdwApplication applicationId={appId} flags={APP_FLAGS}>
            {element}
        </AdwApplication>,
        { container: rootElement },
    );

function SwappedChildApp({
    windowRef,
    firstRef,
    secondRef,
    isFirst,
}: {
    windowRef: RefObject<Gtk.ApplicationWindow | null>;
    firstRef: RefObject<Gtk.Label | null>;
    secondRef: RefObject<Gtk.Label | null>;
    isFirst: boolean;
}) {
    return (
        <GtkApplicationWindow ref={windowRef}>
            {isFirst
                ? (
                        <GtkLabel ref={firstRef} key="first">
                            First
                        </GtkLabel>
                    )
                : (
                        <GtkLabel ref={secondRef} key="second">
                            Second
                        </GtkLabel>
                    )}
        </GtkApplicationWindow>
    );
}

const renderHost = async (captured: Captured, body?: (ref: RefObject<Gtk.Label | null>) => void): Promise<void> => {
    const Host = () => {
        const labelRef = useRef<Gtk.Label | null>(null);

        useEffect(() => {
            captured.calls += 1;
            captured.label = labelRef.current;
            body?.(labelRef);
        }, []);

        return (
            <GtkApplicationWindow defaultWidth={100} defaultHeight={100}>
                <GtkBox>
                    <GtkLabel ref={labelRef}>hello</GtkLabel>
                </GtkBox>
            </GtkApplicationWindow>
        );
    };

    await renderApplication(<Host />);
};

const ParentedTree = ({
    parentRef,
    children,
}: {
    parentRef: RefObject<Gtk.Window | null>;
    children: (parent: Gtk.Window) => ReactNode;
}) => {
    const [appId] = useState(uniqueAppId2);
    const [parent, setParent] = useState<Gtk.Window | null>(null);

    const capture = (window: Gtk.Window | null): void => {
        parentRef.current = window;
        setParent(window);
    };

    return (
        <GtkApplication applicationId={appId} flags={Gio.ApplicationFlags.NON_UNIQUE}>
            <GtkApplicationWindow ref={capture} defaultWidth={100} defaultHeight={100}>
                {parent && children(parent)}
            </GtkApplicationWindow>
        </GtkApplication>
    );
};

const NestedChild = ({
    parentRef,
    childRef,
    isParented,
}: {
    parentRef: RefObject<Gtk.Window | null>;
    childRef: RefObject<Gtk.Window | null>;
    isParented: boolean;
}) => (
    <ParentedTree parentRef={parentRef}>
        {(parent) => (
            <GtkWindow
                ref={childRef}
                transientFor={isParented ? parent : null}
                defaultWidth={50}
                defaultHeight={50}
            />
        )}
    </ParentedTree>
);

const renderNestedChild = async (isParented: boolean) => {
    const parentRef = createRef<Gtk.Window>();
    const childRef = createRef<Gtk.Window>();

    const { rerender } = await render(
        <NestedChild parentRef={parentRef} childRef={childRef} isParented={isParented} />,
        { container: rootElement },
    );

    const rerenderNestedChild = (isStillParented: boolean) =>
        rerender(<NestedChild parentRef={parentRef} childRef={childRef} isParented={isStillParented} />);

    return { parentRef, childRef, rerenderNestedChild };
};

const Probe = ({ slot }: ProbeProps) => {
    const parentWindow = useParentWindow();

    useEffect(() => {
        captured[slot] = parentWindow;
    }, [slot, parentWindow]);

    return null;
};

const renderProbedWindow = async (props: GtkApplicationWindowProps): Promise<Gtk.Window | null> => {
    let windowInstance: Gtk.Window | null = null;

    await renderApplication2(
        <GtkApplicationWindow
            ref={(instance) => {
                windowInstance = instance;
            }}
            defaultWidth={100}
            defaultHeight={100}
            {...props}
        />,
    );

    return windowInstance;
};

const capturing =
    (held: Captured2) =>
        (widget: Gtk.Widget | null): void => {
            if (widget) {
                held.widget = widget;
            }
        };

const capturedWidget = (held: Captured2): Gtk.Widget => {
    if (!held.widget) {
        throw new Error("widget was never captured");
    }

    return held.widget;
};

const createDeferred = (): DeferredPromise => {
    const { promise, resolve } = Promise.withResolvers<string>();

    return { promise, resolve: () => {
        resolve("loaded");
    } };
};

const activityTree = (mode: "visible" | "hidden", held: Captured2, isVisible = true): ReactNode => (
    <GtkBox>
        <Activity mode={mode}>
            <GtkLabel ref={capturing(held)} visible={isVisible}>
                Panel
            </GtkLabel>
        </Activity>
    </GtkBox>
);

const hiddenPanelTree = (mode: "visible" | "hidden", held: Captured2): ReactNode => activityTree(mode, held, false);

describe("render - Window", () => {
    describe("creation", () => {
        it("creates Gtk.ApplicationWindow with current app", async () => {
            const ref = createRef<Gtk.ApplicationWindow>();
            await renderInApplication(<GtkApplicationWindow ref={ref} title="App Window" />);
            expect(ref.current).not.toBeNull();
            expect(ref.current?.getApplication()).not.toBeNull();
        });

        it("creates Adw.ApplicationWindow with current app", async () => {
            const ref = createRef<Adw.ApplicationWindow>();
            await renderAdw(<AdwApplicationWindow ref={ref} />);
            expect(ref.current).not.toBeNull();
            expect(ref.current?.getApplication()).not.toBeNull();
        });

        it("creates Gtk.ApplicationWindow through intermediate elements", async () => {
            const ref = createRef<Gtk.ApplicationWindow>();

            await renderInApplication(
                <GtkApplicationWindow title="Outer">
                    <GtkBox>
                        <GtkApplicationWindow ref={ref} title="Nested App Window" />
                    </GtkBox>
                </GtkApplicationWindow>,
            );

            expect(ref.current).not.toBeNull();
            expect(ref.current?.getApplication()).not.toBeNull();
            expect(ref.current?.getParent()).toBeNull();
        });

        it("throws without a GtkApplication ancestor", async () => {
            await expect(
                baseRender(<GtkApplicationWindow title="Orphan" />, { container: rootElement }),
            ).rejects.toThrow();
        });
    });

    describe("defaultSize", () => {
        it("sets default size via defaultWidth/defaultHeight", async () => {
            const ref = createRef<Gtk.ApplicationWindow>();
            await renderInApplication(<GtkApplicationWindow ref={ref} defaultWidth={300} defaultHeight={200} />);
            const [width, height] = ref.current?.getDefaultSize() ?? [0, 0];
            expect(width).toBeGreaterThanOrEqual(300);
            expect(height).toBeGreaterThanOrEqual(200);
        });

        it("updates default size when props change", async () => {
            const ref = createRef<Gtk.ApplicationWindow>();
            const appId = uniqueAppId();

            function App({ width, height }: { width: number; height: number }) {
                return <GtkApplicationWindow ref={ref} defaultWidth={width} defaultHeight={height} />;
            }

            const { rerender } = await renderInApplication(<App width={200} height={150} />, appId);
            const [initialWidth, initialHeight] = ref.current?.getDefaultSize() ?? [0, 0];

            await rerender(
                <GtkApplication applicationId={appId} flags={APP_FLAGS}>
                    <App width={400} height={300} />
                </GtkApplication>,
            );

            const [updatedWidth, updatedHeight] = ref.current?.getDefaultSize() ?? [0, 0];
            expect(updatedWidth).toBeGreaterThanOrEqual(initialWidth);
            expect(updatedHeight).toBeGreaterThanOrEqual(initialHeight);
        });

        it("handles partial size (only width)", async () => {
            const ref = createRef<Gtk.ApplicationWindow>();
            await renderInApplication(<GtkApplicationWindow ref={ref} defaultWidth={300} />);
            const [width] = ref.current?.getDefaultSize() ?? [0, 0];
            expect(width).toBeGreaterThanOrEqual(300);
        });

        it("handles partial size (only height)", async () => {
            const ref = createRef<Gtk.ApplicationWindow>();
            await renderInApplication(<GtkApplicationWindow ref={ref} defaultHeight={200} />);
            const [, height] = ref.current?.getDefaultSize() ?? [0, 0];
            expect(height).toBeGreaterThanOrEqual(200);
        });
    });

    describe("lifecycle", () => {
        it("presents window on mount", async () => {
            const ref = createRef<Gtk.ApplicationWindow>();
            await renderInApplication(<GtkApplicationWindow ref={ref} title="Present" />);
            const presented = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "Present" });
            expect(presented).toBe(ref.current);
            expect(ref.current?.getApplication()?.getActiveWindow()).toBe(ref.current);
        });

        it("destroys window on unmount", async () => {
            const ref = createRef<Gtk.ApplicationWindow>();
            const appId = uniqueAppId();

            function App({ shouldShow }: { shouldShow: boolean }) {
                return shouldShow ? <GtkApplicationWindow ref={ref} title="Destroy" /> : null;
            }

            const { rerender } = await renderInApplication(<App shouldShow={true} />, appId);
            expect(ref.current).toBeRooted();

            await rerender(
                <GtkApplication applicationId={appId} flags={APP_FLAGS}>
                    <App shouldShow={false} />
                </GtkApplication>,
            );

            await waitFor(() => {
                expect(screen.queryByRole(Gtk.AccessibleRole.WINDOW, { name: "Destroy", hidden: true })).toBeNull();
            });
        });
    });

    it("sets child widget", async () => {
        const windowRef = createRef<Gtk.ApplicationWindow>();
        const labelRef = createRef<Gtk.Label>();

        await renderInApplication(
            <GtkApplicationWindow ref={windowRef}>
                <GtkLabel ref={labelRef}>Window Child</GtkLabel>
            </GtkApplicationWindow>,
        );

        expect(windowRef.current).toHaveObjectProperty("child", labelRef.current);
    });

    it("sets Adw.ApplicationWindow content via setContent", async () => {
        const windowRef = createRef<Adw.ApplicationWindow>();
        const labelRef = createRef<Gtk.Label>();

        await renderAdw(
            <AdwApplicationWindow ref={windowRef}>
                <GtkLabel ref={labelRef}>Window Content</GtkLabel>
            </AdwApplicationWindow>,
        );

        expect(windowRef.current).toHaveObjectProperty("content", labelRef.current);
    });

    it("replaces child widget", async () => {
        const windowRef = createRef<Gtk.ApplicationWindow>();
        const label1Ref = createRef<Gtk.Label>();
        const label2Ref = createRef<Gtk.Label>();
        const appId = uniqueAppId();

        const { rerender } = await renderInApplication(
            <SwappedChildApp windowRef={windowRef} firstRef={label1Ref} secondRef={label2Ref} isFirst={true} />,
            appId,
        );

        expect(windowRef.current).toHaveObjectProperty("child", label1Ref.current);

        await rerender(
            <GtkApplication applicationId={appId} flags={APP_FLAGS}>
                <SwappedChildApp windowRef={windowRef} firstRef={label1Ref} secondRef={label2Ref} isFirst={false} />
            </GtkApplication>,
        );

        expect(windowRef.current).toHaveObjectProperty("child", label2Ref.current);
    });
});

describe("a component that renders a window", () => {
    it("sees a descendant ref populated in its mount effect", async () => {
        const captured: Captured = { label: null, calls: 0 };
        await renderHost(captured);
        expect(captured.calls).toBe(1);
        expect(captured.label).not.toBeNull();
    });

    it("can drive the descendant from that effect, as the browser example does", async () => {
        const captured: Captured = { label: null, calls: 0 };

        await renderHost(captured, (labelRef) => {
            labelRef.current?.setLabel("driven");
        });

        expect(captured.label?.getLabel()).toBe("driven");
    });
});

describe("explicit top-level parenting", () => {
    it("sets transientFor on a window from the prop", async () => {
        const { parentRef, childRef } = await renderNestedChild(true);
        expect(parentRef.current).not.toBeNull();
        expect(childRef.current).toHaveObjectProperty("transientFor", parentRef.current);
        expect(childRef.current?.getParent()).toBeNull();
    });

    it("keeps transientFor clear when the prop is an explicit null", async () => {
        const { parentRef, childRef } = await renderNestedChild(false);
        expect(parentRef.current).not.toBeNull();
        expect(childRef.current?.getTransientFor()).toBeNull();
    });

    it("clears transientFor when the prop becomes null", async () => {
        const { parentRef, childRef, rerenderNestedChild } = await renderNestedChild(true);
        expect(childRef.current).toHaveObjectProperty("transientFor", parentRef.current);
        await rerenderNestedChild(false);
        expect(childRef.current?.getTransientFor()).toBeNull();
    });
});

describe("default top-level parenting", () => {
    it("defaults transientFor to the nearest parent window when the prop is not passed", async () => {
        const parentRef = createRef<Gtk.Window>();
        const childRef = createRef<Gtk.Window>();

        await render(
            <ParentedTree parentRef={parentRef}>
                {() => <GtkWindow ref={childRef} defaultWidth={50} defaultHeight={50} />}
            </ParentedTree>,
            { container: rootElement },
        );

        expect(parentRef.current).not.toBeNull();
        expect(childRef.current).toHaveObjectProperty("transientFor", parentRef.current);
        expect(childRef.current?.getParent()).toBeNull();
    });

    it("presents an Adw.Dialog against its enclosing window", async () => {
        const parentRef = createRef<Gtk.Window>();
        const dialogRef = createRef<Adw.AlertDialog>();

        await render(
            <ParentedTree parentRef={parentRef}>
                {() => (
                    <AdwAlertDialog
                        ref={(widget) => {
                            dialogRef.current = widget;
                        }}
                        heading="Parented"
                    />
                )}
            </ParentedTree>,
            { container: rootElement },
        );

        expect(dialogRef.current).not.toBeNull();
        const root = dialogRef.current?.getRoot();

        if (!(root instanceof Gtk.Window)) {
            throw new TypeError("expected the presented dialog's root to be a window");
        }

        expect(root).toHaveObjectProperty("transientFor", parentRef.current);
    });
});

describe("useParentWindow", () => {
    it("returns the window provided by the enclosing window element", async () => {
        const windowInstance = await renderProbedWindow({ children: <Probe slot="children" /> });
        expect(windowInstance).not.toBeNull();
        expect(captured.children).toBe(windowInstance);
    });

    it("reaches the titlebar, controllers, and actions slots, not just children", async () => {
        const windowInstance = await renderProbedWindow({
            titlebar: (
                <GtkBox>
                    <Probe slot="titlebar" />
                </GtkBox>
            ),
            controllers: <Probe slot="controllers" />,
            actions: (
                <>
                    <GSimpleAction name="noop" />
                    <Probe slot="actions" />
                </>
            ),
        });

        expect(windowInstance).not.toBeNull();
        expect(captured.titlebar).toBe(windowInstance);
        expect(captured.controllers).toBe(windowInstance);
        expect(captured.actions).toBe(windowInstance);
    });

    it("returns null when there is no window ancestor", async () => {
        await render(<Probe slot="orphan" />);
        expect(captured.orphan).toBeNull();
    });

    it("is null on the first render inside a window and resolves on the next", async () => {
        const seen: string[] = [];

        const RenderProbe = () => {
            seen.push(useParentWindow() === null ? "null" : "window");

            return null;
        };

        await renderApplication2(
            <GtkApplicationWindow defaultWidth={100} defaultHeight={100}>
                <RenderProbe />
            </GtkApplicationWindow>,
        );

        expect(seen).toEqual(["null", "window"]);
    });
});

describe("visibility", () => {
    it("hides and restores a mounted subtree with Activity", async () => {
        const held: Captured2 = { widget: null };
        const { rerender } = await render(activityTree("visible", held));
        expect(capturedWidget(held)).toBeVisible();
        await rerender(activityTree("hidden", held));
        expect(capturedWidget(held)).not.toBeVisible();
        await rerender(activityTree("visible", held));
        expect(capturedWidget(held)).toBeVisible();
    });

    it("keeps an explicitly invisible widget hidden across an unhide cycle", async () => {
        const held: Captured2 = { widget: null };
        const { rerender } = await render(hiddenPanelTree("visible", held));
        expect(capturedWidget(held)).not.toBeVisible();
        await rerender(hiddenPanelTree("hidden", held));
        expect(capturedWidget(held)).not.toBeVisible();
        await rerender(hiddenPanelTree("visible", held));
        expect(capturedWidget(held)).not.toBeVisible();
    });

    it("hides and restores a subtree that suspends after mount", async () => {
        const deferred = createDeferred();
        const held: Captured2 = { widget: null };
        const Deferred = (): ReactNode => <GtkLabel>{use(deferred.promise)}</GtkLabel>;

        const tree = (isPending: boolean): ReactNode => (
            <GtkBox>
                <Suspense fallback={<GtkLabel>Loading</GtkLabel>}>
                    <GtkLabel ref={capturing(held)}>Content</GtkLabel>
                    {isPending ? <Deferred /> : null}
                </Suspense>
            </GtkBox>
        );

        const { rerender } = await render(tree(false));
        expect(capturedWidget(held)).toBeVisible();
        await rerender(tree(true));
        expect(capturedWidget(held)).not.toBeVisible();

        await act(async () => {
            deferred.resolve();
            await deferred.promise;
        });

        expect(capturedWidget(held)).toBeVisible();
    });
});
