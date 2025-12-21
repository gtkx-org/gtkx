import type * as Adw from "@gtkx/ffi/adw";
import {
    AdwViewStack,
    AdwViewSwitcher,
    GtkApplicationWindow,
    GtkHeaderBar,
    GtkWindow,
    quit,
    Slot,
    StackPage,
} from "@gtkx/react";
import { useCallback, useState } from "react";
import { ColumnViewDemo } from "./demos/column-view.js";
import { DropDownDemo } from "./demos/drop-down.js";
import { FlowBoxDemo } from "./demos/flow-box.js";
import { GridViewDemo } from "./demos/grid-view.js";
import { ListBoxDemo } from "./demos/list-box.js";
import { ListViewDemo } from "./demos/list-view.js";

export const App = () => {
    const [stack, setStack] = useState<Adw.ViewStack | null>(null);
    const stackRef = useCallback((node: Adw.ViewStack | null) => setStack(node), []);

    return (
        <GtkApplicationWindow title="GTK4 Lists" defaultWidth={1000} defaultHeight={700} onCloseRequest={quit}>
            <Slot for={GtkWindow} id="titlebar">
                <GtkHeaderBar>
                    <Slot for={GtkHeaderBar} id="titleWidget">
                        <AdwViewSwitcher policy={1} stack={stack ?? undefined} />
                    </Slot>
                </GtkHeaderBar>
            </Slot>

            <AdwViewStack ref={stackRef} vexpand hexpand>
                <StackPage name="listbox" title="ListBox" iconName="view-list-symbolic">
                    <ListBoxDemo />
                </StackPage>
                <StackPage name="listview" title="ListView" iconName="view-list-symbolic">
                    <ListViewDemo />
                </StackPage>
                <StackPage name="gridview" title="GridView" iconName="view-grid-symbolic">
                    <GridViewDemo />
                </StackPage>
                <StackPage name="columnview" title="ColumnView" iconName="x-office-spreadsheet-symbolic">
                    <ColumnViewDemo />
                </StackPage>
                <StackPage name="dropdown" title="DropDown" iconName="view-more-symbolic">
                    <DropDownDemo />
                </StackPage>
                <StackPage name="flowbox" title="FlowBox" iconName="view-app-grid-symbolic">
                    <FlowBoxDemo />
                </StackPage>
            </AdwViewStack>
        </GtkApplicationWindow>
    );
};

export default App;

export const appId = "org.gtkx.lists";
