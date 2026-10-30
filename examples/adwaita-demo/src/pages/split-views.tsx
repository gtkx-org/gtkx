import * as Adw from "@gtkx/gi/adw";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import {
    AdwBreakpoint,
    AdwDialog,
    AdwHeaderBar,
    AdwNavigationPage,
    AdwNavigationSplitView,
    AdwOverlaySplitView,
    AdwStatusPage,
    AdwToolbarView,
} from "@gtkx/jsx/adw";
import { GtkBox, GtkButton, GtkToggleButton } from "@gtkx/jsx/gtk";
import { type ReactNode, useMemo, useState } from "react";

const NavigationSplitDialog = ({ onClosed }: { onClosed: () => void }): ReactNode => {
    const [collapsed, setCollapsed] = useState(false);
    const condition = useMemo(
        () => Adw.BreakpointCondition.newLength(Adw.BreakpointConditionLengthType.MAX_WIDTH, 400, Adw.LengthUnit.SP),
        [],
    );

    return (
        <AdwDialog
            title="Navigation Split View"
            widthRequest={360}
            heightRequest={200}
            contentWidth={640}
            contentHeight={480}
            onClosed={onClosed}
            breakpoints={
                <AdwBreakpoint
                    condition={condition}
                    onApply={() => setCollapsed(true)}
                    onUnapply={() => setCollapsed(false)}
                />
            }
        >
            <AdwNavigationSplitView
                collapsed={collapsed}
                sidebar={
                    <AdwNavigationPage title="Sidebar" tag="sidebar">
                        <AdwToolbarView top={<AdwHeaderBar showTitle={false} />}>
                            <AdwStatusPage title="Sidebar">
                                <GtkButton
                                    label="Open Content"
                                    visible={collapsed}
                                    halign={Gtk.Align.CENTER}
                                    canShrink
                                    cssClasses={["pill"]}
                                    actionName="navigation.push"
                                    actionTarget={GLib.Variant.newString("content")}
                                />
                            </AdwStatusPage>
                        </AdwToolbarView>
                    </AdwNavigationPage>
                }
            >
                <AdwNavigationPage title="Content" tag="content">
                    <AdwToolbarView top={<AdwHeaderBar showTitle={false} />}>
                        <AdwStatusPage title="Content" />
                    </AdwToolbarView>
                </AdwNavigationPage>
            </AdwNavigationSplitView>
        </AdwDialog>
    );
};

const OverlaySplitDialog = ({ onClosed }: { onClosed: () => void }): ReactNode => {
    const [collapsed, setCollapsed] = useState(false);
    const [showSidebar, setShowSidebar] = useState(true);
    const [start, setStart] = useState(true);
    const [startButton, setStartButton] = useState<Gtk.ToggleButton | null>(null);
    const condition = useMemo(
        () => Adw.BreakpointCondition.newLength(Adw.BreakpointConditionLengthType.MAX_WIDTH, 400, Adw.LengthUnit.SP),
        [],
    );

    return (
        <AdwDialog
            title="Overlay Split View"
            widthRequest={360}
            heightRequest={200}
            contentWidth={640}
            contentHeight={480}
            onClosed={onClosed}
            breakpoints={
                <AdwBreakpoint
                    condition={condition}
                    onApply={() => setCollapsed(true)}
                    onUnapply={() => setCollapsed(false)}
                />
            }
        >
            <AdwToolbarView
                topBarStyle={Adw.ToolbarStyle.RAISED}
                top={
                    <AdwHeaderBar
                        start={
                            <GtkToggleButton
                                iconName="view-sidebar-start-symbolic"
                                tooltipText="Toggle Sidebar"
                                active={showSidebar}
                                visible={start}
                                onNotifyActive={(value) => setShowSidebar(value === true)}
                            />
                        }
                        end={
                            <GtkToggleButton
                                iconName="view-sidebar-end-symbolic"
                                tooltipText="Toggle Sidebar"
                                active={showSidebar}
                                visible={!start}
                                onNotifyActive={(value) => setShowSidebar(value === true)}
                            />
                        }
                    />
                }
            >
                <AdwOverlaySplitView
                    collapsed={collapsed}
                    showSidebar={showSidebar}
                    onNotifyShowSidebar={(value) => setShowSidebar(value === true)}
                    sidebarPosition={start ? Gtk.PackType.START : Gtk.PackType.END}
                    sidebar={
                        <AdwStatusPage title="Sidebar">
                            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={18} halign={Gtk.Align.CENTER}>
                                <GtkToggleButton
                                    ref={setStartButton}
                                    label="Start"
                                    canShrink
                                    active={start}
                                    onNotifyActive={(value) => setStart(value === true)}
                                    cssClasses={["pill"]}
                                />
                                <GtkToggleButton
                                    label="End"
                                    canShrink
                                    group={startButton ?? undefined}
                                    active={!start}
                                    cssClasses={["pill"]}
                                />
                            </GtkBox>
                        </AdwStatusPage>
                    }
                >
                    <AdwStatusPage title="Content" />
                </AdwOverlaySplitView>
            </AdwToolbarView>
        </AdwDialog>
    );
};

export const SplitViewsPage = (): ReactNode => {
    const [dialog, setDialog] = useState<"navigation" | "overlay" | null>(null);

    return (
        <>
            <AdwToolbarView top={<AdwHeaderBar showTitle={false} />}>
                <AdwStatusPage
                    iconName="widget-split-views-symbolic"
                    title="Split Views"
                    description="Widgets that display sidebar and content"
                >
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={18} halign={Gtk.Align.CENTER}>
                        <GtkButton
                            label="Navigation Split View"
                            canShrink
                            cssClasses={["pill"]}
                            onClicked={() => setDialog("navigation")}
                        />
                        <GtkButton
                            label="Overlay Split View"
                            canShrink
                            cssClasses={["pill"]}
                            onClicked={() => setDialog("overlay")}
                        />
                    </GtkBox>
                </AdwStatusPage>
            </AdwToolbarView>
            {dialog === "navigation" && <NavigationSplitDialog onClosed={() => setDialog(null)} />}
            {dialog === "overlay" && <OverlaySplitDialog onClosed={() => setDialog(null)} />}
        </>
    );
};
