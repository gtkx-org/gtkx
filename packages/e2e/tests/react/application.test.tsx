import type { Root, RootElement } from "@gtkx/react";
import type { ActionAccel, MainOption } from "@gtkx/react/internal";
import type { ReactNode, RefObject } from "react";
import type { Mock } from "vitest";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { GSimpleAction } from "@gtkx/jsx/gio";
import { GtkApplication, GtkApplicationWindow, GtkBox, GtkEntry, GtkLabel } from "@gtkx/jsx/gtk";
import { createRoot, quit, rootElement, useApplication } from "@gtkx/react";
import { act, render, userEvent } from "@gtkx/testing";
import process from "node:process";
import { createRef, useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startApplicationOwner, stopApplicationOwners } from "../helpers/application-owner.js";
import { createApplicationRenderer } from "../helpers/application-render.js";
import { createAppIdFactory } from "../helpers/unique-name.js";

type AccelsAppProps = {
    labelRef: RefObject<Gtk.Label | null>;
    entryRef: RefObject<Gtk.Entry | null>;
    actionAccels: ActionAccel[];
    actions: ReactNode;
    isAppScoped: boolean;
};

type ActivateMock = ReturnType<typeof createActivateMock>;

type Harness = {
    label: Gtk.Label;
    entry: Gtk.Entry;
    onActivate: ActivateMock;
};

type AccelsAppProps2 = {
    appRef: RefObject<Gtk.Application | null>;
    appId: string;
    actionAccels?: ActionAccel[];
    windowActions?: ReactNode;
    appActions?: ReactNode;
};

type Rendered = {
    output: string;
    windows: number;
};

type Captured = {
    application: Gtk.Application | null;
};

type ProbeProps = { onCleanup: () => void };

type ProbeRoot = {
    root: Root;
    onCleanup: Mock;
    mount: () => Promise<void>;
};

type Teardown = {
    name: string;
    tearDown: (root: Root) => void;
};

const APP_FLAGS = Gio.ApplicationFlags.NON_UNIQUE;
const uniqueAppId = createAppIdFactory("org.gtkx.applicationtest");

const GREETING_OPTION: MainOption = {
    longName: "greeting",
    shortName: "g",
    arg: GLib.OptionArg.STRING,
    description: "Greeting to print",
    argDescription: "TEXT",
};

const COLOR_OPTION: MainOption = {
    longName: "color",
    arg: GLib.OptionArg.STRING,
    description: "Color to paint",
    argDescription: "NAME",
};

const APP_FLAGS2 = Gio.ApplicationFlags.NON_UNIQUE;
const uniqueAppId2 = createAppIdFactory("org.gtkx.accelkeyboard");
const APP_FLAGS3 = Gio.ApplicationFlags.NON_UNIQUE;
const uniqueAppId3 = createAppIdFactory("org.gtkx.actionaccelstest");
const noop = vi.fn();
const newWindowAction = <GSimpleAction name="new" onActivate={noop} />;
const renderApplication = createApplicationRenderer("org.gtkx.useapplicationtest");
const uniqueAppId4 = createAppIdFactory("org.gtkx.remoteapp");
const mounted: Root[] = [];

const TEARDOWNS: Teardown[] = [
    {
        name: "unmount",
        tearDown: (root) => {
            root.unmount();
        },
    },
    {
        name: "a render of null",
        tearDown: (root) => {
            root.render(null);
        },
    },
    {
        name: "a previous quit",
        tearDown: () => {
            quit();
        },
    },
];

const requireWidget = <T,>(widget: T | null, name: string): T => {
    if (widget === null) {
        throw new Error(`${name} did not render`);
    }

    return widget;
};

const buildMenubar = (entries: { label: string; items: { label: string; action: string }[] }[]): Gio.Menu => {
    const menubar = Gio.Menu.new();

    for (const entry of entries) {
        const submenu = Gio.Menu.new();

        for (const item of entry.items) {
            submenu.append(item.label, item.action);
        }

        menubar.appendSubmenu(entry.label, submenu);
    }

    return menubar;
};

const MenubarApp = ({
    appRef,
    appId,
    menubar,
}: {
    appRef: RefObject<Gtk.Application | null>;
    appId: string;
    menubar: Gio.MenuModel | null;
}): ReactNode => (
    <GtkApplication ref={appRef} applicationId={appId} flags={APP_FLAGS} menubar={menubar}>
        <GtkApplicationWindow defaultWidth={800} defaultHeight={600} />
    </GtkApplication>
);

const renderMenubar = async (
    ref: RefObject<Gtk.Application | null>,
    menubar: Gio.MenuModel | null,
): Promise<(next: Gio.MenuModel | null) => Promise<void>> => {
    const appId = uniqueAppId();

    const { rerender } = await render(<MenubarApp appRef={ref} appId={appId} menubar={menubar} />, {
        container: rootElement,
    });

    return (next) => rerender(<MenubarApp appRef={ref} appId={appId} menubar={next} />);
};

const renderApp = async (menubar: Gio.MenuModel | null): Promise<Gtk.Application> => {
    const ref = createRef<Gtk.Application>();
    await renderMenubar(ref, menubar);

    if (!ref.current) {
        throw new Error("Expected application instance");
    }

    return ref.current;
};

const OptionApp = ({
    appRef,
    appId,
    options,
    onLocalOptions,
}: {
    appRef: RefObject<Gtk.Application | null>;
    appId: string;
    options: MainOption[];
    onLocalOptions?: (options: GLib.VariantDict) => number;
}): ReactNode => (
    <GtkApplication
        ref={appRef}
        applicationId={appId}
        flags={APP_FLAGS}
        mainOptions={options}
        onHandleLocalOptions={onLocalOptions}
    >
        <GtkApplicationWindow defaultWidth={200} defaultHeight={100} />
    </GtkApplication>
);

const withArgv = async (args: string[], run: () => Promise<void>): Promise<void> => {
    const original = process.argv;
    process.argv = [...original.slice(0, 2), ...args];

    try {
        await run();
    } finally {
        process.argv = original;
    }
};

const renderOptions = async (
    ref: RefObject<Gtk.Application | null>,
    options: MainOption[],
): Promise<(next: MainOption[]) => Promise<void>> => {
    const appId = uniqueAppId();

    const { rerender } = await render(<OptionApp appRef={ref} appId={appId} options={options} />, {
        container: rootElement,
    });

    return (next) => rerender(<OptionApp appRef={ref} appId={appId} options={next} />);
};

const submenuSize = (application: Gtk.Application | null): number | undefined =>
    application?.getMenubar()?.getItemLink(0, "submenu")?.getNItems();

const parseGreeting = async (args: string[]): Promise<string[]> => {
    const parsed: string[] = [];
    const ref = createRef<Gtk.Application>();

    await withArgv(args, async () => {
        await render(
            <OptionApp
                appRef={ref}
                appId={uniqueAppId()}
                options={[GREETING_OPTION]}
                onLocalOptions={(options) => {
                    parsed.push(options.lookupValue("greeting", null)?.getString()[0] ?? "unregistered");

                    return -1;
                }}
            />,
            { container: rootElement },
        );
    });

    return parsed;
};

const fileMenu = (items: string[]): Gio.Menu =>
    buildMenubar([{ label: "File", items: items.map((label) => ({ label, action: `win.${label}` })) }]);

const createActivateMock = () => vi.fn<(parameter: GLib.Variant | null) => void>();

const AccelsApp = ({ labelRef, entryRef, actionAccels, actions, isAppScoped }: AccelsAppProps): ReactNode => (
    <GtkApplication
        applicationId={uniqueAppId2()}
        flags={APP_FLAGS2}
        actionAccels={actionAccels}
        actions={isAppScoped ? actions : undefined}
    >
        <GtkApplicationWindow
            defaultWidth={400}
            defaultHeight={300}
            actions={isAppScoped ? undefined : actions}
        >
            <GtkBox>
                <GtkLabel ref={labelRef} label="content" selectable />
                <GtkEntry ref={entryRef} text="editable content" />
            </GtkBox>
        </GtkApplicationWindow>
    </GtkApplication>
);

const renderHarness = async (
    accels: string[],
    detailedActionName: string,
    action: (onActivate: ActivateMock) => ReactNode,
    isAppScoped = false,
): Promise<Harness> => {
    const labelRef = createRef<Gtk.Label>();
    const entryRef = createRef<Gtk.Entry>();
    const onActivate = createActivateMock();

    await render(
        <AccelsApp
            labelRef={labelRef}
            entryRef={entryRef}
            actionAccels={[{ detailedActionName, accels }]}
            actions={action(onActivate)}
            isAppScoped={isAppScoped}
        />,
        { container: rootElement },
    );

    return {
        label: requireWidget(labelRef.current, "label"),
        entry: requireWidget(entryRef.current, "entry"),
        onActivate,
    };
};

const simpleAction = (name: string) => (onActivate: ActivateMock) => (
    <GSimpleAction name={name} onActivate={onActivate} />
);

const targetedAction = (name: string) => (onActivate: ActivateMock) => (
    <GSimpleAction name={name} parameterType={GLib.VariantType.new("s")} onActivate={onActivate} />
);

const AccelsApp2 = ({ appRef, appId, actionAccels, windowActions, appActions }: AccelsAppProps2): ReactNode => (
    <GtkApplication
        ref={appRef}
        applicationId={appId}
        flags={APP_FLAGS3}
        actionAccels={actionAccels}
        actions={appActions}
    >
        <GtkApplicationWindow defaultWidth={800} defaultHeight={600} actions={windowActions} />
    </GtkApplication>
);

const renderAccels = (props: AccelsAppProps2) => render(<AccelsApp2 {...props} />, { container: rootElement });

const renderWinNewAccels = (appRef: RefObject<Gtk.Application | null>, appId: string) =>
    renderAccels({
        appRef,
        appId,
        actionAccels: [{ detailedActionName: "win.new", accels: ["<Control>n"] }],
        windowActions: newWindowAction,
    });

const Probe = () => {
    useApplication();

    return null;
};

const captureStandardError = (): (() => string) => {
    const chunks: string[] = [];

    vi.spyOn(process.stderr, "write").mockImplementation((chunk: string | Uint8Array): boolean => {
        chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString());

        return true;
    });

    return () => chunks.join("");
};

const renderApplication2 = async (applicationId: string): Promise<Rendered> => {
    const root = createRoot({ ...rootElement });
    mounted.push(root);
    const captured: Captured = { application: null };
    const standardError = captureStandardError();

    await act(() => {
        root.render(
            <GtkApplication
                applicationId={applicationId}
                ref={(application) => {
                    captured.application = application;
                }}
            >
                <GtkApplicationWindow defaultWidth={100} defaultHeight={100} />
            </GtkApplication>,
        );
    });

    return { output: standardError(), windows: captured.application?.getWindows().length ?? 0 };
};

const Probe2 = ({ onCleanup }: ProbeProps): ReactNode => {
    useEffect(() => onCleanup, [onCleanup]);

    return <GtkLabel>probe</GtkLabel>;
};

const createProbeRoot = (): ProbeRoot => {
    const container: RootElement = { ...rootElement };
    const root = createRoot(container);
    const onCleanup = vi.fn();

    return {
        root,
        onCleanup,
        mount: async () => {
            await act(() => {
                root.render(<Probe2 onCleanup={onCleanup} />);
            });
        },
    };
};

describe("render - Application", () => {
    describe("menubar slot", () => {
        it("sets menubar from a GMenu", async () => {
            const app = await renderApp(
                buildMenubar([
                    {
                        label: "File",
                        items: [
                            { label: "New", action: "win.new" },
                            { label: "Open", action: "win.open" },
                        ],
                    },
                    { label: "Edit", items: [{ label: "Cut", action: "win.cut" }] },
                ]),
            );

            const menubar = app.getMenubar();
            expect(menubar).not.toBeNull();
            expect(menubar?.getNItems()).toBe(2);
        });

        it("clears menubar when the GMenu is removed", async () => {
            const ref = createRef<Gtk.Application>();
            const rerender = await renderMenubar(ref, fileMenu(["New"]));
            expect(ref.current?.getMenubar()).not.toBeNull();
            await rerender(null);
            expect(ref.current?.getMenubar()).toBeNull();
        });

        it("updates menubar when items change", async () => {
            const ref = createRef<Gtk.Application>();
            const rerender = await renderMenubar(ref, fileMenu(["New", "Open"]));
            expect(submenuSize(ref.current)).toBe(2);
            await rerender(fileMenu(["New", "Open", "Save"]));
            expect(submenuSize(ref.current)).toBe(3);
        });
    });
});

describe("render - Application main options", () => {
    it("registers options before the command line is parsed", async () => {
        expect(await parseGreeting(["--greeting=hello"])).toEqual(["hello"]);
    });

    it("accepts the short name of a registered option", async () => {
        expect(await parseGreeting(["-g", "hi"])).toEqual(["hi"]);
    });

    it("throws when the options change after they are applied", async () => {
        const ref = createRef<Gtk.Application>();
        const rerender = await renderOptions(ref, [GREETING_OPTION]);

        await expect(rerender([GREETING_OPTION, COLOR_OPTION])).rejects.toThrow(
            /Cannot change the construct-only prop 'mainOptions' of <GtkApplication>/,
        );
    });

    it("accepts an equal list built again on the next render", async () => {
        const ref = createRef<Gtk.Application>();
        const rerender = await renderOptions(ref, [GREETING_OPTION]);
        const application = ref.current;
        await rerender([{ ...GREETING_OPTION }]);
        expect(ref.current).toBe(application);
    });
});

describe("userEvent.keyboard dispatches application accelerators", () => {
    it("activates a window-scoped action bound through actionAccels", async () => {
        const { label, onActivate } = await renderHarness(["<Control>s"], "win.save", simpleAction("save"));
        label.grabFocus();
        await userEvent.keyboard(label, "{Control>}s{/Control}");
        expect(onActivate).toHaveBeenCalledTimes(1);
    });

    it("activates an application-scoped action bound through actionAccels", async () => {
        const harness = await renderHarness(["<Control>k"], "app.palette", simpleAction("palette"), true);
        harness.label.grabFocus();
        await userEvent.keyboard(harness.label, "{Control>}k{/Control}");
        expect(harness.onActivate).toHaveBeenCalledTimes(1);
    });

    it("activates an accelerator carrying an action target", async () => {
        const harness = await renderHarness(["<Control><Shift>d"], "app.mode::dark", targetedAction("mode"), true);
        harness.label.grabFocus();
        await userEvent.keyboard(harness.label, "{Control>}{Shift>}d{/Shift}{/Control}");
        expect(harness.onActivate).toHaveBeenCalledTimes(1);
        expect(harness.onActivate.mock.calls[0]?.[0]?.getString()[0]).toBe("dark");
    });
});

describe("userEvent.keyboard prefers application accelerators over local shortcuts", () => {
    it("takes priority over a class shortcut on the focused widget", async () => {
        const { label, onActivate } = await renderHarness(["<Control>f"], "win.find", simpleAction("find"));
        label.grabFocus();
        await userEvent.keyboard(label, "{Control>}f{/Control}");
        expect(onActivate).toHaveBeenCalledTimes(1);
    });

    it("takes priority over a shortcut on an editable's delegate", async () => {
        const action = simpleAction("select-all-items");
        const { entry, onActivate } = await renderHarness(["<Control>a"], "win.select-all-items", action);
        entry.grabFocus();
        entry.selectRegion(0, 0);
        await userEvent.keyboard(entry, "{Control>}a{/Control}");
        expect(onActivate).toHaveBeenCalledTimes(1);
        expect(entry.getSelectionBounds()[0]).toBe(false);
    });

    it("leaves unbound key combinations to the widget's own shortcuts", async () => {
        const { entry, onActivate } = await renderHarness(["<Control>s"], "win.save", simpleAction("save"));
        entry.grabFocus();
        await userEvent.keyboard(entry, "{Control>}a{/Control}");
        expect(onActivate).not.toHaveBeenCalled();
        expect(entry.getSelectionBounds()[0]).toBe(true);
    });
});

describe("GtkApplication actionAccels", () => {
    it("binds window-scoped accels from the actionAccels prop", async () => {
        const ref = createRef<Gtk.Application>();
        await renderWinNewAccels(ref, uniqueAppId3());
        expect(ref.current?.getAccelsForAction("win.new")).toEqual(["<Control>n"]);
    });

    it("binds application-scoped accels with multiple accelerators", async () => {
        const ref = createRef<Gtk.Application>();

        await renderAccels({
            appRef: ref,
            appId: uniqueAppId3(),
            actionAccels: [{ detailedActionName: "app.quit", accels: ["<Control>q", "<Control>w"] }],
            appActions: <GSimpleAction name="quit" onActivate={noop} />,
        });

        expect(ref.current?.getAccelsForAction("app.quit")).toEqual(["<Control>q", "<Control>w"]);
    });

    it("clears accels when an entry is removed", async () => {
        const ref = createRef<Gtk.Application>();
        const appId = uniqueAppId3();
        const { rerender } = await renderWinNewAccels(ref, appId);
        expect(ref.current?.getAccelsForAction("win.new")).toEqual(["<Control>n"]);
        await rerender(<AccelsApp2 appRef={ref} appId={appId} actionAccels={[]} windowActions={newWindowAction} />);
        expect(ref.current?.getAccelsForAction("win.new")).toEqual([]);
    });
});

describe("useApplication", () => {
    it("returns the GTK application provided by ApplicationContext", async () => {
        let captured: unknown = "unset";

        const CapturingProbe = () => {
            const application = useApplication();

            useEffect(() => {
                captured = application;
            }, [application]);

            return <GtkApplicationWindow defaultWidth={100} defaultHeight={100} />;
        };

        await renderApplication(<CapturingProbe />);
        expect(captured).not.toBeNull();
        expect(typeof (captured as { register?: unknown }).register).toBe("function");
    });

    it("throws when the ApplicationContext value is null", async () => {
        await expect(render(<Probe />, { container: rootElement })).rejects.toThrow(
            /useApplication must be called within GtkApplication/,
        );
    });
});

afterEach(async () => {
    const roots = [...mounted];
    mounted.length = 0;
    vi.restoreAllMocks();

    for (const root of roots) {
        await act(() => {
            root.unmount();
        });
    }

    stopApplicationOwners();
});

describe("<GtkApplication> on an application ID another process already owns", () => {
    it("names the application ID the other process holds instead of drawing nothing", async () => {
        const applicationId = uniqueAppId4();
        await startApplicationOwner(applicationId);
        const rendered = await renderApplication2(applicationId);
        expect(rendered.windows).toBe(0);
        expect(rendered.output).toContain(`Another process already owns ${applicationId}`);
        expect(rendered.output).toContain("can never show a window");
    });

    it("says nothing when this process owns the application ID", async () => {
        const rendered = await renderApplication2(uniqueAppId4());
        expect(rendered.windows).toBe(1);
        expect(rendered.output).not.toContain("Another process already owns");
    });
});

describe.each(TEARDOWNS)("quit after $name", (teardown) => {
    it("unmounts a root that was rendered again", async () => {
        const probe = createProbeRoot();
        await probe.mount();

        await act(() => {
            teardown.tearDown(probe.root);
        });

        expect(probe.onCleanup).toHaveBeenCalledTimes(1);
        await probe.mount();
        probe.onCleanup.mockClear();
        expect(await act(() => quit())).toBe(Gdk.EVENT_STOP);
        expect(probe.onCleanup).toHaveBeenCalledTimes(1);
    });
});

describe("quit", () => {
    it("lets the originating signal propagate when nothing is mounted", async () => {
        const probe = createProbeRoot();
        await probe.mount();
        expect(await act(() => quit())).toBe(Gdk.EVENT_STOP);
        expect(await act(() => quit())).toBe(Gdk.EVENT_PROPAGATE);
    });
});
