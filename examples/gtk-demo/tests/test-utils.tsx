import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkApplication, GtkApplicationWindow } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { type RenderResult, render, screen } from "@gtkx/testing";
import { type ComponentType, createRef, type ReactNode, type RefObject, useCallback, useState } from "react";
import { expect } from "vitest";
import { DemoProvider, useDemo } from "../src/context/demo-context.js";
import type { Demo, DemoProps, DemoProviderProps } from "../src/demos/types.js";

export const makeStringValue = (text: string): GObject.Value => {
    const value = new GObject.Value();
    value.init(GObject.TYPE_STRING);
    value.setString(text);
    return value;
};

export const makeIntValue = (n: number): GObject.Value => {
    const value = new GObject.Value();
    value.init(GObject.TYPE_INT);
    value.setInt(n);
    return value;
};

export const makeRgbaValue = (r: number, g: number, b: number, a: number): GObject.Value => {
    const rgba = new Gdk.RGBA();
    rgba.red = r;
    rgba.green = g;
    rgba.blue = b;
    rgba.alpha = a;
    const value = new GObject.Value();
    value.init(GObject.typeFromName("GdkRGBA"));
    value.setBoxed(rgba);
    return value;
};

export const makeFileValue = (path: string): GObject.Value => {
    const file = Gio.fileNewForPath(path);
    const value = new GObject.Value();
    value.init(GObject.typeFromName("GFile"));
    value.setObject(file);
    return value;
};

let nextAppId = 0;

export interface RenderDemoOptions {
    onClose?: () => void;
    titlebar?: ComponentType<DemoProps>;
    provider?: ComponentType<DemoProviderProps>;
}

interface WrapperArgs {
    windowRef: RefObject<Gtk.Window | null>;
    onClose: () => void;
    Provider: ComponentType<DemoProviderProps>;
    Titlebar: ComponentType<DemoProps> | undefined;
    demo: Demo | undefined;
}

const buildWrapper = ({
    windowRef,
    onClose,
    Provider,
    Titlebar,
    demo,
}: WrapperArgs): ComponentType<{ children: ReactNode }> => {
    const DemoShell = ({ children }: { children: ReactNode }) => {
        const [windowReady, setWindowReady] = useState(false);
        const [applicationId] = useState(() => `org.gtkx.gtkdemo${nextAppId++}`);
        const { windowTitle, defaultWidget } = useDemo();
        const titlebar = Titlebar ? <Titlebar window={windowRef} onClose={onClose} /> : undefined;
        const handleWindowRef = useCallback((widget: Gtk.Widget | null): void => {
            (windowRef as { current: Gtk.Window | null }).current = (widget as Gtk.Window | null) ?? null;
            if (widget) setWindowReady(true);
        }, []);
        return (
            <GtkApplication applicationId={applicationId} flags={Gio.ApplicationFlags.NON_UNIQUE}>
                <Provider window={windowRef} onClose={onClose}>
                    <GtkApplicationWindow
                        ref={handleWindowRef}
                        title={windowTitle ?? demo?.windowTitle}
                        defaultWidth={demo?.defaultWidth ?? 800}
                        defaultHeight={demo?.defaultHeight ?? 600}
                        resizable={demo?.resizable ?? true}
                        deletable={demo?.deletable ?? true}
                        cssClasses={demo?.windowCssClasses}
                        defaultWidget={defaultWidget}
                        titlebar={titlebar}
                    >
                        {windowReady ? children : null}
                    </GtkApplicationWindow>
                </Provider>
            </GtkApplication>
        );
    };
    return ({ children }: { children: ReactNode }) => (
        <DemoProvider demos={demo ? [demo] : []}>
            <DemoShell>{children}</DemoShell>
        </DemoProvider>
    );
};

const isDemo = (value: ComponentType<DemoProps> | Demo): value is Demo => typeof value === "object" && "id" in value;

const PassthroughProvider: ComponentType<DemoProviderProps> = ({ children }) => children;

export const renderDemo = async (
    componentOrDemo: ComponentType<DemoProps> | Demo,
    options: RenderDemoOptions = {},
): Promise<RenderResult> => {
    const windowRef = createRef<Gtk.Window | null>();
    const onClose = options.onClose ?? (() => {});
    const Component = isDemo(componentOrDemo) ? componentOrDemo.component : componentOrDemo;
    expect(Component, "renderDemo: demo has no component").toBeTypeOf("function");
    const ResolvedComponent = Component as ComponentType<DemoProps>;
    const Titlebar = options.titlebar ?? (isDemo(componentOrDemo) ? componentOrDemo.titlebar : undefined);
    const Provider =
        options.provider ?? (isDemo(componentOrDemo) ? componentOrDemo.provider : undefined) ?? PassthroughProvider;
    const demo = isDemo(componentOrDemo) ? componentOrDemo : undefined;
    return await render(<ResolvedComponent window={windowRef} onClose={onClose} />, {
        container: rootElement,
        wrapper: buildWrapper({ windowRef, onClose, Provider, Titlebar, demo }),
    });
};

export const findInactiveSearchToggle = async (): Promise<Gtk.ToggleButton> => {
    const toggle = (await screen.findByName("search-toggle")) as Gtk.ToggleButton;
    expect(toggle).toBeInstanceOf(Gtk.ToggleButton);
    expect(toggle.getActive()).toBe(false);
    return toggle;
};

export const findOpenButton = async (): Promise<Gtk.Button> =>
    (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "_Open" })) as Gtk.Button;

export const renderDemoAndExpectOpenButton = async (demo: Demo): Promise<void> => {
    await renderDemo(demo);
    const openButton = await findOpenButton();
    expect(openButton).toBeInstanceOf(Gtk.Button);
    expect(openButton.getUseUnderline()).toBe(true);
};

export const readBufferText = (view: Gtk.TextView): string => {
    const buffer = view.getBuffer();
    return buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false);
};

export const bufferHasTag = (view: Gtk.TextView, tagName: string): boolean => {
    const buffer = view.getBuffer();
    const tag = buffer.getTagTable().lookup(tagName);
    if (!tag) return false;
    const iter = buffer.getStartIter();
    do {
        if (iter.hasTag(tag)) return true;
    } while (iter.forwardChar());
    return false;
};

export const getChildren = (widget: Gtk.Widget): Gtk.Widget[] => {
    const children: Gtk.Widget[] = [];
    for (let child = widget.getFirstChild(); child; child = child.getNextSibling()) {
        children.push(child);
    }
    return children;
};
