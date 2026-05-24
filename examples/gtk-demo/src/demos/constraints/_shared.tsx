import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton } from "@gtkx/react";
import type { Ref } from "react";

/**
 * Refs to the three buttons rendered by {@link ThreeButtonsBox}, along with
 * the surrounding container. Used by every constraint demo as the target of
 * the layout manager being demonstrated.
 */
export interface ThreeButtonsRefs {
    containerRef: Ref<Gtk.Box | null>;
    button1Ref: Ref<Gtk.Button | null>;
    button2Ref: Ref<Gtk.Button | null>;
    button3Ref: Ref<Gtk.Button | null>;
    namedButtons?: boolean;
}

/**
 * Renders a `GtkBox` containing three labeled `GtkButton` children. Every
 * constraint demo uses this same layout as the substrate the constraint
 * manager arranges. When `namedButtons` is true the buttons receive widget
 * names `button1`/`button2`/`button3`, matching the upstream interactive
 * constraints demo.
 */
export const ThreeButtonsBox = ({
    containerRef,
    button1Ref,
    button2Ref,
    button3Ref,
    namedButtons = false,
}: ThreeButtonsRefs) => (
    <GtkBox ref={containerRef} name={namedButtons ? "container" : undefined} hexpand vexpand>
        <GtkButton ref={button1Ref} label="Child 1" name={namedButtons ? "button1" : undefined} />
        <GtkButton ref={button2Ref} label="Child 2" name={namedButtons ? "button2" : undefined} />
        <GtkButton ref={button3Ref} label="Child 3" name={namedButtons ? "button3" : undefined} />
    </GtkBox>
);
