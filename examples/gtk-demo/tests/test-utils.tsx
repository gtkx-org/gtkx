import type * as Gtk from "@gtkx/gi/gtk";
import { GtkApplicationWindow } from "@gtkx/react-gi/gtk";
import { type RenderResult, render } from "@gtkx/testing";
import { type ComponentType, createRef, type ReactNode, type RefObject, useCallback, useState } from "react";
import { expect } from "vitest";
import { DemoProvider, useDemo } from "../src/context/demo-context.js";
import type { Demo, DemoProps, DemoProviderProps } from "../src/demos/types.js";

/**
 * Per-test render options for {@link renderDemo}.
 */
export interface RenderDemoOptions {
    /** Callback fired when the demo signals it wants to close. */
    onClose?: () => void;
    /** Override the demo's titlebar component. */
    titlebar?: ComponentType<DemoProps>;
    /** Override the demo's state provider component. */
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
        const { windowTitle, defaultWidget } = useDemo();
        const titlebar = Titlebar ? <Titlebar window={windowRef} onClose={onClose} /> : undefined;
        const handleWindowRef = useCallback((widget: Gtk.Widget | null): void => {
            (windowRef as { current: Gtk.Window | null }).current = (widget as Gtk.Window | null) ?? null;
            if (widget) setWindowReady(true);
        }, []);
        return (
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
        );
    };
    return ({ children }: { children: ReactNode }) => (
        <DemoProvider demos={demo ? [demo] : []}>
            <DemoShell>{children}</DemoShell>
        </DemoProvider>
    );
};

const isDemo = (value: ComponentType<DemoProps> | Demo): value is Demo =>
    typeof value === "object" && value !== null && "id" in value;

const PassthroughProvider: ComponentType<DemoProviderProps> = ({ children }) => children;

/**
 * Renders a {@link Demo} (or a bare demo component) inside a {@link GtkApplicationWindow}
 * that mirrors what the production app shell provides — titlebar, provider, default size,
 * resizable flag, and window title from the demo metadata.
 *
 * Wraps `@gtkx/testing`'s {@link render} so tests do not need to repeat the window/provider
 * scaffolding themselves. Equivalent to React Testing Library's documented custom-render
 * pattern (https://testing-library.com/docs/react-testing-library/setup#custom-render).
 *
 * Use `screen.findByRole(Gtk.AccessibleRole.WINDOW)` to locate the host window
 * in tests; the internal window ref is private to the wrapper.
 */
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
        wrapper: buildWrapper({ windowRef, onClose, Provider, Titlebar, demo }),
    });
};
