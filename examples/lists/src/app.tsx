import type * as Adw from "@gtkx/ffi/adw";
import { AdwViewStack, AdwViewSwitcher, ApplicationWindow, HeaderBar, quit } from "@gtkx/react";
import { createRef } from "react";
import { ColumnViewDemo } from "./demos/column-view.js";
import { DropDownDemo } from "./demos/drop-down.js";
import { FlowBoxDemo } from "./demos/flow-box.js";
import { GridViewDemo } from "./demos/grid-view.js";
import { ListBoxDemo } from "./demos/list-box.js";
import { ListViewDemo } from "./demos/list-view.js";

export const App = () => {
    const stackRef = createRef<Adw.ViewStack>();

    return (
        <ApplicationWindow title="GTK4 Lists" defaultWidth={1000} defaultHeight={700} onCloseRequest={quit}>
            <HeaderBar.Root>
                <HeaderBar.TitleWidget>
                    <AdwViewSwitcher policy={1} stack={stackRef.current ?? undefined} />
                </HeaderBar.TitleWidget>
            </HeaderBar.Root>

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
                <AdwViewStack.Page name="columnview" title="ColumnView" iconName="view-column-symbolic">
                    <ColumnViewDemo />
                </AdwViewStack.Page>
                <AdwViewStack.Page name="dropdown" title="DropDown" iconName="view-more-symbolic">
                    <DropDownDemo />
                </AdwViewStack.Page>
                <AdwViewStack.Page name="flowbox" title="FlowBox" iconName="view-app-grid-symbolic">
                    <FlowBoxDemo />
                </AdwViewStack.Page>
            </AdwViewStack.Root>
        </ApplicationWindow>
    );
};

export const appId = "org.gtkx.lists";
