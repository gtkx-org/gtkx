import * as Adw from "@gtkx/ffi/adw";
import {
    AdwApplicationWindow,
    AdwHeaderBar,
    AdwToolbarView,
    AdwViewStack,
    AdwViewSwitcher,
    GtkScrolledWindow,
    quit,
    x,
} from "@gtkx/react";
import { useState } from "react";
import { LayoutDemo } from "./demos/layout.js";
import { ListDemo } from "./demos/list.js";
import { MenuDemo } from "./demos/menu.js";
import { NavigationDemo } from "./demos/navigation.js";
import { RowDemo } from "./demos/row.js";
import { WidgetDemo } from "./demos/widget.js";

export const App = () => {
    const [stack, setStack] = useState<Adw.ViewStack | null>(null);

    return (
        <AdwApplicationWindow title="x.* Showcase" defaultWidth={900} defaultHeight={700} onClose={quit}>
            <AdwToolbarView>
                <x.ToolbarTop>
                    <AdwHeaderBar>
                        <x.Slot for={AdwHeaderBar} id="titleWidget">
                            <AdwViewSwitcher stack={stack ?? undefined} policy={Adw.ViewSwitcherPolicy.WIDE} />
                        </x.Slot>
                    </AdwHeaderBar>
                </x.ToolbarTop>

                <AdwViewStack ref={setStack}>
                    <x.StackPage id="layout" title="Layout" iconName="view-grid-symbolic">
                        <GtkScrolledWindow hexpand vexpand propagateNaturalHeight>
                            <LayoutDemo />
                        </GtkScrolledWindow>
                    </x.StackPage>

                    <x.StackPage id="lists" title="Lists" iconName="view-list-symbolic">
                        <GtkScrolledWindow hexpand vexpand propagateNaturalHeight>
                            <ListDemo />
                        </GtkScrolledWindow>
                    </x.StackPage>

                    <x.StackPage id="navigation" title="Navigation" iconName="view-paged-symbolic">
                        <GtkScrolledWindow hexpand vexpand propagateNaturalHeight>
                            <NavigationDemo />
                        </GtkScrolledWindow>
                    </x.StackPage>

                    <x.StackPage id="menus" title="Menus" iconName="open-menu-symbolic">
                        <GtkScrolledWindow hexpand vexpand propagateNaturalHeight>
                            <MenuDemo />
                        </GtkScrolledWindow>
                    </x.StackPage>

                    <x.StackPage id="rows" title="Rows" iconName="view-more-horizontal-symbolic">
                        <GtkScrolledWindow hexpand vexpand propagateNaturalHeight>
                            <RowDemo />
                        </GtkScrolledWindow>
                    </x.StackPage>

                    <x.StackPage id="widgets" title="Widgets" iconName="applications-system-symbolic">
                        <GtkScrolledWindow hexpand vexpand propagateNaturalHeight>
                            <WidgetDemo />
                        </GtkScrolledWindow>
                    </x.StackPage>
                </AdwViewStack>
            </AdwToolbarView>
        </AdwApplicationWindow>
    );
};

export default App;
