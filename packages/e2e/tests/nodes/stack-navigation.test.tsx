import type * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwViewStack, AdwViewSwitcher, GtkBox, GtkStack, GtkStackSidebar, GtkStackSwitcher } from "@gtkx/react";
import { render, screen } from "@gtkx/testing";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

const findWidget = async <T extends Gtk.Widget>(name: string): Promise<T> => (await screen.findByName(name)) as T;

const StackWithSinglePage = ({
    name,
    pageId = "a",
    title = "A",
    content = "A",
}: {
    name: string;
    pageId?: string;
    title?: string;
    content?: string;
}): ReactNode => (
    <GtkStack name={name}>
        <GtkStack.Page id={pageId} title={title}>
            {content}
        </GtkStack.Page>
    </GtkStack>
);

const expectControlWiredToSibling = async (controlName: string, stackName: string): Promise<void> => {
    const control = await findWidget<Gtk.StackSwitcher | Gtk.StackSidebar>(controlName);
    const stack = await findWidget<Gtk.Stack>(stackName);
    expect(control.getStack()).toBe(stack);
};

describe("render - StackNavigation auto-wire", () => {
    it("binds GtkStackSidebar to a sibling GtkStack without an explicit prop", async () => {
        await render(
            <GtkBox>
                <GtkStackSidebar name="sidebar" />
                <StackWithSinglePage name="stack" />
            </GtkBox>,
        );

        await expectControlWiredToSibling("sidebar", "stack");
    });

    it("binds GtkStackSwitcher to a sibling GtkStack without an explicit prop", async () => {
        await render(
            <GtkBox>
                <GtkStackSwitcher name="switcher" />
                <StackWithSinglePage name="stack" />
            </GtkBox>,
        );

        await expectControlWiredToSibling("switcher", "stack");
    });

    it("auto-wires regardless of declaration order", async () => {
        await render(
            <GtkBox>
                <StackWithSinglePage name="stack" />
                <GtkStackSwitcher name="switcher" />
            </GtkBox>,
        );

        await expectControlWiredToSibling("switcher", "stack");
    });

    it("binds AdwViewSwitcher to a sibling AdwViewStack", async () => {
        await render(
            <GtkBox>
                <AdwViewSwitcher name="switcher" />
                <AdwViewStack name="stack">
                    <AdwViewStack.Page id="a" title="A">
                        A
                    </AdwViewStack.Page>
                </AdwViewStack>
            </GtkBox>,
        );

        const switcher = await findWidget<Adw.ViewSwitcher>("switcher");
        const stack = await findWidget<Adw.ViewStack>("stack");
        expect(switcher.getStack()).toBe(stack);
    });
});

describe("render - StackNavigation sibling replacement", () => {
    it("rebinds when the sibling stack is replaced by a fresh instance", async () => {
        function App({ stackKey }: { stackKey: string }) {
            return (
                <GtkBox>
                    <GtkStackSwitcher name="switcher" />
                    <StackWithSinglePage key={stackKey} name="stack" pageId={stackKey} />
                </GtkBox>
            );
        }

        const { rerender } = await render(<App stackKey="a" />);
        const switcher = await findWidget<Gtk.StackSwitcher>("switcher");
        const firstStack = await findWidget<Gtk.Stack>("stack");
        expect(switcher.getStack()).toBe(firstStack);

        await rerender(<App stackKey="b" />);
        const secondStack = await findWidget<Gtk.Stack>("stack");
        expect(secondStack).not.toBe(firstStack);
        expect(switcher.getStack()).toBe(secondStack);
    });
});

describe("render - StackNavigation explicit prop", () => {
    it("honours an explicit stack prop and ignores siblings on first render", async () => {
        const explicitStack = Gtk.Stack.new();

        await render(
            <GtkBox>
                <GtkStackSwitcher name="switcher" stack={explicitStack} />
                <StackWithSinglePage name="ignored" pageId="ignored" title="Ignored" content="Ignored" />
            </GtkBox>,
        );

        const switcher = await findWidget<Gtk.StackSwitcher>("switcher");
        const ignored = await findWidget<Gtk.Stack>("ignored");
        expect(switcher.getStack()).toBe(explicitStack);
        expect(switcher.getStack()).not.toBe(ignored);
    });

    it("disconnects GtkStackSwitcher when stack={null} is passed explicitly", async () => {
        await render(
            <GtkBox>
                <GtkStackSwitcher name="switcher" stack={null} />
                <StackWithSinglePage name="stack" />
            </GtkBox>,
        );

        const switcher = await findWidget<Gtk.StackSwitcher>("switcher");
        expect(switcher.getStack()).toBeNull();
    });
});

describe("render - StackNavigation transitions", () => {
    it("switches from explicit prop to sibling auto-wire when the prop is removed", async () => {
        const explicitStack = Gtk.Stack.new();

        function App({ useExplicit }: { useExplicit: boolean }) {
            return (
                <GtkBox>
                    <GtkStackSwitcher name="switcher" stack={useExplicit ? explicitStack : undefined} />
                    <StackWithSinglePage name="sibling" />
                </GtkBox>
            );
        }

        const { rerender } = await render(<App useExplicit={true} />);
        const switcher = await findWidget<Gtk.StackSwitcher>("switcher");
        expect(switcher.getStack()).toBe(explicitStack);

        await rerender(<App useExplicit={false} />);
        const sibling = await findWidget<Gtk.Stack>("sibling");
        expect(switcher.getStack()).toBe(sibling);
    });
});

describe("render - StackNavigation invariants", () => {
    it("throws when no sibling stack is present and no explicit prop is given", async () => {
        await expect(
            render(
                <GtkBox>
                    <GtkStackSidebar />
                </GtkBox>,
            ),
        ).rejects.toThrow(/GtkStackSidebar.*no sibling.*GtkStack/);
    });

    it("throws when multiple sibling stacks are present and no explicit prop is given", async () => {
        await expect(
            render(
                <GtkBox>
                    <GtkStackSwitcher />
                    <GtkStack>
                        <GtkStack.Page id="a" title="A">
                            A
                        </GtkStack.Page>
                    </GtkStack>
                    <GtkStack>
                        <GtkStack.Page id="b" title="B">
                            B
                        </GtkStack.Page>
                    </GtkStack>
                </GtkBox>,
            ),
        ).rejects.toThrow(/GtkStackSwitcher.*2 sibling.*GtkStack/);
    });

    it("throws when only a different-family sibling stack is present", async () => {
        await expect(
            render(
                <GtkBox>
                    <GtkStackSwitcher />
                    <AdwViewStack>
                        <AdwViewStack.Page id="a" title="A">
                            A
                        </AdwViewStack.Page>
                    </AdwViewStack>
                </GtkBox>,
            ),
        ).rejects.toThrow(/GtkStackSwitcher.*no sibling.*GtkStack/);
    });

    it("rejects rerender when a sibling-replacement leaves multiple matching stacks", async () => {
        function App({ stackKeys }: { stackKeys: readonly string[] }) {
            return (
                <GtkBox>
                    <GtkStackSwitcher />
                    {stackKeys.map((key) => (
                        <GtkStack key={key}>
                            <GtkStack.Page id={key} title={key}>
                                {key}
                            </GtkStack.Page>
                        </GtkStack>
                    ))}
                </GtkBox>
            );
        }

        const { rerender } = await render(<App stackKeys={["a"]} />);
        await expect(rerender(<App stackKeys={["b", "c"]} />)).rejects.toThrow(/GtkStackSwitcher.*2 sibling.*GtkStack/);
    });
});
