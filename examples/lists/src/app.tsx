import type * as Adw from "@gtkx/ffi/adw";
import { AdwViewStack, AdwViewSwitcher, GtkApplicationWindow, GtkHeaderBar, GtkWindow, quit } from "@gtkx/react";
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
            <GtkWindow.Titlebar>
                <GtkHeaderBar.Root>
                    <GtkHeaderBar.TitleWidget>
                        <AdwViewSwitcher policy={1} stack={stack ?? undefined} />
                    </GtkHeaderBar.TitleWidget>
                </GtkHeaderBar.Root>
            </GtkWindow.Titlebar>

            <AdwViewStack.Root ref={stackRef} vexpand hexpand>
                <AdwViewStack.Page name="listbox" title="ListBox" iconName="view-list-symbolic">
                    <ListBoxDemo />
                </AdwViewStack.Page>
                <AdwViewStack.Page name="listview" title="ListView" iconName="view-list-symbolic">
                    <ListViewDemo />
                </AdwViewStack.Page>
                <AdwViewStack.Page name="gridview" title="GridView" iconName="view-grid-symbolic">
                    <GridViewDemo />
                </AdwViewStack.Page>
                <AdwViewStack.Page name="columnview" title="ColumnView" iconName="x-office-spreadsheet-symbolic">
                    <ColumnViewDemo />
                </AdwViewStack.Page>
                <AdwViewStack.Page name="dropdown" title="DropDown" iconName="view-more-symbolic">
                    <DropDownDemo />
                </AdwViewStack.Page>
                <AdwViewStack.Page name="flowbox" title="FlowBox" iconName="view-app-grid-symbolic">
                    <FlowBoxDemo />
                </AdwViewStack.Page>
            </AdwViewStack.Root>
        </GtkApplicationWindow>
    );
};

export default App;

export const appId = "org.gtkx.lists";
