import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkApplicationWindow } from "@gtkx/react";
import { type RenderResult, render } from "@gtkx/testing";
import { type ComponentType, createRef, type ReactNode, type RefObject, useCallback, useState } from "react";
import type { Demo, DemoProps, DemoProviderProps } from "../src/demos/types.js";

export * from "@gtkx/testing";

/**
 * Per-test render options for {@link renderDemo}.
 */
export interface RenderDemoOptions {
    /** Callback fired when the demo signals it wants to close. */
    onClose?: () => void;
    /**
     * Existing ref to populate with the host window once it mounts; useful when
     * a test needs to capture the ref before the demo body executes.
     */
    window?: RefObject<Gtk.Window | null>;
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
    return ({ children }: { children: ReactNode }) => {
        const [windowReady, setWindowReady] = useState(false);
        const titlebar = Titlebar ? <Titlebar window={windowRef} onClose={onClose} /> : undefined;
        const handleWindowRef = useCallback((widget: Gtk.Widget | null): void => {
            (windowRef as { current: Gtk.Window | null }).current = (widget as Gtk.Window | null) ?? null;
            if (widget) setWindowReady(true);
        }, []);
        return (
            <Provider window={windowRef} onClose={onClose}>
                <GtkApplicationWindow
                    ref={handleWindowRef}
                    title={demo?.windowTitle}
                    defaultWidth={demo?.defaultWidth ?? 800}
                    defaultHeight={demo?.defaultHeight ?? 600}
                    resizable={demo?.resizable ?? true}
                    titlebar={titlebar}
                >
                    {windowReady ? children : null}
                </GtkApplicationWindow>
            </Provider>
        );
    };
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
 */
export const renderDemo = async (
    componentOrDemo: ComponentType<DemoProps> | Demo,
    options: RenderDemoOptions = {},
): Promise<RenderResult & { window: RefObject<Gtk.Window | null> }> => {
    const window = options.window ?? createRef<Gtk.Window | null>();
    const onClose = options.onClose ?? (() => {});
    const Component = isDemo(componentOrDemo) ? componentOrDemo.component : componentOrDemo;
    if (!Component) throw new Error("renderDemo: demo has no component");
    const Titlebar = options.titlebar ?? (isDemo(componentOrDemo) ? componentOrDemo.titlebar : undefined);
    const Provider =
        options.provider ?? (isDemo(componentOrDemo) ? componentOrDemo.provider : undefined) ?? PassthroughProvider;
    const demo = isDemo(componentOrDemo) ? componentOrDemo : undefined;
    const result = await render(<Component window={window} onClose={onClose} />, {
        wrapper: buildWrapper({ windowRef: window, onClose, Provider, Titlebar, demo }),
    });
    return { ...result, window };
};

/**
 * Collects every event controller attached to `widget` that is an instance of
 * `ctor`. Required because GTK exposes controllers through a model
 * ({@link Gtk.Widget.observeControllers}) rather than as widget children, so
 * accessibility-based queries cannot reach them.
 */
export const collectControllersOfType = <T extends Gtk.EventController>(
    widget: Gtk.Widget,
    ctor: new (...args: never[]) => T,
): T[] => {
    const observer = widget.observeControllers();
    const out: T[] = [];
    const count = observer.getNItems();
    for (let i = 0; i < count; i++) {
        const controller = observer.getItem(i);
        if (controller instanceof ctor) out.push(controller);
    }
    return out;
};
