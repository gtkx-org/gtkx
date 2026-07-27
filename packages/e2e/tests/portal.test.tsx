import type * as Gtk from "@gtkx/gi/gtk";
import * as Gio from "@gtkx/gi/gio";
import * as GtkEnums from "@gtkx/gi/gtk";
import { GtkApplication, GtkApplicationWindow, GtkBox, GtkButton, GtkLabel, GtkStack } from "@gtkx/jsx/gtk";
import { createPortal, rootElement, useApplication } from "@gtkx/react";
import { render, screen, within } from "@gtkx/testing";
import { createRef, type ReactNode, type Ref } from "react";
import { describe, expect, it } from "vitest";

const APP_FLAGS = Gio.ApplicationFlags.NON_UNIQUE;
let nextAppId = 0;

const uniqueAppId = (): string => `org.gtkx.portaltest${nextAppId++}`;

const Portal = ({ children, portalKey }: { children: ReactNode; portalKey?: string }) => {
    const app = useApplication();

    return <>{createPortal(children, app, portalKey)}</>;
};

const plainBox = (ref: Ref<Gtk.Box>): ReactNode => <GtkBox ref={ref} orientation={GtkEnums.Orientation.VERTICAL} />;

const stackChildOrder = (stack: Gtk.Stack): string[] => {
    const names: string[] = [];
    let child = stack.getFirstChild();

    while (child !== null) {
        if (child instanceof GtkEnums.Label) {
            names.push(child.getLabel());
        }

        child = child.getNextSibling();
    }

    return names;
};

const renderPortalIntoBox = async (
    content: (box: Gtk.Box) => ReactNode,
    boxTree: (ref: Ref<Gtk.Box>) => ReactNode = plainBox,
): Promise<Gtk.Box> => {
    const boxRef = createRef<Gtk.Box>();

    function App() {
        const box = boxRef.current;

        return (
            <>
                {boxTree(boxRef)}
                {box && content(box)}
            </>
        );
    }

    const { rerender } = await render(<App />);
    await rerender(<App />);

    return boxRef.current as Gtk.Box;
};

describe("createPortal (1)", () => {
    it("renders children at root level when no container specified", async () => {
        await render(
            <GtkApplication applicationId={uniqueAppId()} flags={APP_FLAGS}>
                <Portal>
                    <GtkApplicationWindow title="Portal Window" />
                </Portal>
            </GtkApplication>,
            { container: rootElement },
        );

        await screen.findByRole(GtkEnums.AccessibleRole.WINDOW, { name: "Portal Window", hidden: true });
    });

    it("renders children into a specific container widget", async () => {
        const box = await renderPortalIntoBox((target) => createPortal(<GtkLabel>In Portal</GtkLabel>, target));
        within(box).getByText("In Portal");
    });

    it("keeps a portal child in place when sibling JSX children reorder", async () => {
        const stackRef = createRef<Gtk.Stack>();

        function App({ order }: { order: string[] }) {
            const stack = stackRef.current;

            return (
                <>
                    <GtkStack ref={stackRef}>
                        {order.map((name) => (
                            <GtkLabel key={name} label={name} />
                        ))}
                    </GtkStack>
                    {stack && createPortal(<GtkLabel label="portal" />, stack)}
                </>
            );
        }

        const { rerender } = await render(<App order={["a", "b"]} />);
        await rerender(<App order={["a", "b"]} />);
        expect(stackChildOrder(stackRef.current as Gtk.Stack)).toEqual(["a", "b", "portal"]);
        await rerender(<App order={["b", "a"]} />);
        expect(stackChildOrder(stackRef.current as Gtk.Stack)).toEqual(["b", "portal", "a"]);
    });

    it("preserves key when provided", async () => {
        await render(
            <GtkApplication applicationId={uniqueAppId()} flags={APP_FLAGS}>
                <Portal portalKey="my-key">
                    <GtkApplicationWindow title="Keyed Window" />
                </Portal>
            </GtkApplication>,
            { container: rootElement },
        );

        await screen.findByRole(GtkEnums.AccessibleRole.WINDOW, { name: "Keyed Window", hidden: true });
    });
});

function OptionalPortal({ showPortal }: { showPortal: boolean }) {
    const app = useApplication();

    return <>{showPortal && createPortal(<GtkApplicationWindow title="Portal" />, app)}</>;
}

function TitledPortal({ title }: { title: string }) {
    const app = useApplication();

    return <>{createPortal(<GtkApplicationWindow title={title} />, app)}</>;
}

describe("createPortal (2)", () => {
    it("unmounts portal children when portal is removed", async () => {
        const appId = uniqueAppId();

        const { rerender } = await render(
            <GtkApplication applicationId={appId} flags={APP_FLAGS}>
                <OptionalPortal showPortal={true} />
            </GtkApplication>,
            { container: rootElement },
        );

        await screen.findByRole(GtkEnums.AccessibleRole.WINDOW, { name: "Portal", hidden: true });

        await rerender(
            <GtkApplication applicationId={appId} flags={APP_FLAGS}>
                <OptionalPortal showPortal={false} />
            </GtkApplication>,
        );
    });

    it("updates portal children when props change", async () => {
        const appId = uniqueAppId();

        const { rerender } = await render(
            <GtkApplication applicationId={appId} flags={APP_FLAGS}>
                <TitledPortal title="First" />
            </GtkApplication>,
            { container: rootElement },
        );

        await screen.findByRole(GtkEnums.AccessibleRole.WINDOW, { name: "First", hidden: true });

        await rerender(
            <GtkApplication applicationId={appId} flags={APP_FLAGS}>
                <TitledPortal title="Second" />
            </GtkApplication>,
        );

        await screen.findByRole(GtkEnums.AccessibleRole.WINDOW, { name: "Second", hidden: true });
    });
});

describe("createPortal (3)", () => {
    it("handles multiple portals to same container", async () => {
        const box = await renderPortalIntoBox((target) => (
            <>
                {createPortal(<GtkLabel>First</GtkLabel>, target)}
                {createPortal(<GtkLabel>Second</GtkLabel>, target)}
            </>
        ));

        const queries = within(box);
        queries.getByText("First");
        queries.getByText("Second");
    });

    it("handles portal to nested container", async () => {
        const innerBox = await renderPortalIntoBox(
            (target) => createPortal(<GtkButton label="Nested" />, target),
            (ref) => (
                <GtkBox orientation={GtkEnums.Orientation.VERTICAL}>
                    <GtkBox ref={ref} orientation={GtkEnums.Orientation.VERTICAL} />
                </GtkBox>
            ),
        );

        within(innerBox).getByRole(GtkEnums.AccessibleRole.BUTTON, { name: "Nested" });
    });
});
