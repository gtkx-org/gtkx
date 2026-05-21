import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkApplicationWindow } from "@gtkx/react";
import { type RenderResult, render } from "@gtkx/testing";
import { type ComponentType, createRef, type ReactNode, type Ref, type RefObject, useCallback, useState } from "react";
import type { Demo, DemoProps, DemoProviderProps } from "../../src/demos/types.js";

export interface RenderDemoOptions {
    onClose?: () => void;
    window?: RefObject<Gtk.Window | null>;
    titlebar?: ComponentType<DemoProps>;
    provider?: ComponentType<DemoProviderProps>;
}

interface WrapperBuildArgs {
    windowRef: RefObject<Gtk.Window | null>;
    onClose: () => void;
    Provider: ComponentType<DemoProviderProps>;
    Titlebar: ComponentType<DemoProps> | undefined;
}

const buildWrapper = ({
    windowRef,
    onClose,
    Provider,
    Titlebar,
}: WrapperBuildArgs): ComponentType<{ children: ReactNode; ref?: Ref<Gtk.Widget> }> => {
    const Wrapper = ({ children, ref }: { children: ReactNode; ref?: Ref<Gtk.Widget> }) => {
        const [windowReady, setWindowReady] = useState(false);
        const titlebar = Titlebar ? <Titlebar window={windowRef} onClose={onClose} /> : undefined;
        const handleWindowRef = useCallback(
            (widget: Gtk.Widget | null) => {
                if (typeof ref === "function") ref(widget);
                else if (ref) (ref as { current: Gtk.Widget | null }).current = widget;
                (windowRef as { current: Gtk.Window | null }).current = (widget as Gtk.Window | null) ?? null;
                if (widget) setWindowReady(true);
            },
            [ref],
        );
        return (
            <Provider window={windowRef} onClose={onClose}>
                <GtkApplicationWindow ref={handleWindowRef} defaultWidth={800} defaultHeight={600} titlebar={titlebar}>
                    {windowReady ? children : null}
                </GtkApplicationWindow>
            </Provider>
        );
    };
    return Wrapper;
};

const isDemo = (value: ComponentType<DemoProps> | Demo): value is Demo =>
    typeof value === "object" && value !== null && "id" in value;

const PassthroughProvider: ComponentType<DemoProviderProps> = ({ children }) => children;

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
    const result = await render(<Component window={window} onClose={onClose} />, {
        wrapper: buildWrapper({ windowRef: window, onClose, Provider, Titlebar }),
    });
    return { ...result, window };
};

export const expectDemoMetadata = (demo: Demo, expected: { id: string; title: string }): void => {
    if (demo.id !== expected.id) throw new Error(`expected demo id "${expected.id}", got "${demo.id}"`);
    if (demo.title !== expected.title) throw new Error(`expected demo title "${expected.title}", got "${demo.title}"`);
    if (typeof demo.description !== "string" || demo.description.length === 0) {
        throw new Error(`expected demo "${demo.id}" to have a non-empty description`);
    }
    if (!Array.isArray(demo.keywords)) {
        throw new Error(`expected demo "${demo.id}" to have a keywords array`);
    }
};
