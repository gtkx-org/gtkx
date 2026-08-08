import type * as Gtk from "@gtkx/gi/gtk";
import type { ComponentProps, RefObject } from "react";
import { GtkLabel, GtkStack, GtkStackPage } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef } from "react";

type StackPageProps = ComponentProps<typeof GtkStackPage>;

const buildNamedPages = (stackRef: RefObject<Gtk.Stack | null>) => (pages: string[]) => (
    <GtkStack ref={stackRef}>
        {pages.map((name) => (
            <GtkStackPage key={name} name={name}>
                <GtkLabel>{name}</GtkLabel>
            </GtkStackPage>
        ))}
    </GtkStack>
);

const pageNamed = (stack: Gtk.Stack | null, name: string): Gtk.StackPage | undefined => {
    const child = stack?.getChildByName(name);

    return child ? stack?.getPage(child) : undefined;
};

const renderSinglePage = async (props: StackPageProps): Promise<Gtk.Stack> => {
    const stackRef = createRef<Gtk.Stack>();

    await render(
        <GtkStack ref={stackRef}>
            <GtkStackPage {...props}>
                <GtkLabel>Content</GtkLabel>
            </GtkStackPage>
        </GtkStack>,
    );

    const stack = stackRef.current;

    if (stack === null) {
        throw new Error("expected the stack ref to be assigned");
    }

    return stack;
};

export { buildNamedPages, pageNamed, renderSinglePage };
