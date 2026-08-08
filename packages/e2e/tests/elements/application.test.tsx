import type * as Gtk from "@gtkx/gi/gtk";
import type { MainOption } from "@gtkx/react/internal";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import { GtkApplication, GtkApplicationWindow } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { render } from "@gtkx/testing";
import process from "node:process";
import { createRef, type ReactNode, type RefObject } from "react";
import { describe, expect, it } from "vitest";
import { createAppIdFactory } from "../helpers/unique-name.js";

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
