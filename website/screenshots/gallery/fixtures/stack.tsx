import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel, GtkStack, GtkStackPage, GtkStackSwitcher } from "@gtkx/jsx/gtk";
import { useState } from "react";

export const Demo = () => {
    const [stack, setStack] = useState<Gtk.Stack | null>(null);
    const [page, setPage] = useState("editor");

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
            <GtkStackSwitcher stack={stack} halign={Gtk.Align.CENTER} />
            <GtkStack
                ref={setStack}
                visibleChildName={page}
                onNotifyVisibleChildName={(name) => setPage(name ?? "editor")}
            >
                <GtkStackPage id="editor" title="Editor">
                    <GtkLabel label="The editor pane" cssClasses={["title-3"]} heightRequest={140} />
                </GtkStackPage>
                <GtkStackPage id="preview" title="Preview">
                    <GtkLabel label="The preview pane" cssClasses={["title-3"]} heightRequest={140} />
                </GtkStackPage>
            </GtkStack>
        </GtkBox>
    );
};
