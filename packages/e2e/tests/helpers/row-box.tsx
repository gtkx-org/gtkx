import type * as Gtk from "@gtkx/gi/gtk";
import type { ComponentProps } from "react";
import * as GtkNs from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel, GtkListBox, GtkListBoxRow } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef, type RefObject } from "react";

type ListBoxProps = Partial<ComponentProps<typeof GtkListBox>>;
type ListBoxRowProps = Partial<ComponentProps<typeof GtkListBoxRow>>;

const renderRowBox = async (
    props: ListBoxProps,
    count: number,
    rowPropsFor?: (index: number) => ListBoxRowProps,
): Promise<RefObject<Gtk.ListBoxRow | null>[]> => {
    const refs = Array.from({ length: count }, () => createRef<Gtk.ListBoxRow>());

    await render(
        <GtkBox orientation={GtkNs.Orientation.VERTICAL}>
            <GtkListBox {...props}>
                {refs.map((ref, index) => (
                    <GtkListBoxRow key={index} ref={ref} {...rowPropsFor?.(index)}>
                        <GtkLabel label={`Row ${String(index)}`} />
                    </GtkListBoxRow>
                ))}
            </GtkListBox>
        </GtkBox>,
    );

    return refs;
};

export { renderRowBox };
