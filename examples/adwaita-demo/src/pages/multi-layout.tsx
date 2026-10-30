import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import {
    AdwBreakpoint,
    AdwDialog,
    AdwHeaderBar,
    AdwLayout,
    AdwLayoutSlot,
    AdwMultiLayoutView,
    AdwOverlaySplitView,
    AdwStatusPage,
    AdwToolbarView,
} from "@gtkx/jsx/adw";
import { GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { type ReactNode, useMemo, useState } from "react";

const MultiLayoutDialog = ({ onClosed }: { onClosed: () => void }): ReactNode => {
    const [narrow, setNarrow] = useState(false);
    const condition = useMemo(
        () => Adw.BreakpointCondition.newLength(Adw.BreakpointConditionLengthType.MAX_WIDTH, 500, Adw.LengthUnit.SP),
        [],
    );

    return (
        <AdwDialog
            widthRequest={360}
            heightRequest={200}
            contentWidth={800}
            contentHeight={600}
            onClosed={onClosed}
            breakpoints={
                <AdwBreakpoint
                    condition={condition}
                    onApply={() => setNarrow(true)}
                    onUnapply={() => setNarrow(false)}
                />
            }
        >
            <AdwMultiLayoutView
                layoutName={narrow ? "narrow" : "wide"}
                sidebarSlot={<GtkLabel label="Sidebar" cssClasses={["title-1"]} />}
                contentSlot={<GtkLabel label="Content" cssClasses={["title-1"]} />}
                layouts={
                    <>
                        <AdwLayout name="wide">
                            <AdwOverlaySplitView
                                sidebar={
                                    <AdwToolbarView top={<AdwHeaderBar showTitle={false} />}>
                                        <AdwLayoutSlot id="sidebar" />
                                    </AdwToolbarView>
                                }
                            >
                                <AdwToolbarView top={<AdwHeaderBar showTitle={false} />}>
                                    <AdwLayoutSlot id="content" />
                                </AdwToolbarView>
                            </AdwOverlaySplitView>
                        </AdwLayout>
                        <AdwLayout name="narrow">
                            <AdwToolbarView
                                top={<AdwHeaderBar showTitle={false} />}
                                bottomBarStyle={Adw.ToolbarStyle.RAISED}
                                bottom={<AdwLayoutSlot id="sidebar" heightRequest={100} />}
                            >
                                <AdwLayoutSlot id="content" />
                            </AdwToolbarView>
                        </AdwLayout>
                    </>
                }
            />
        </AdwDialog>
    );
};

export const MultiLayoutPage = (): ReactNode => {
    const [open, setOpen] = useState(false);

    return (
        <>
            <AdwToolbarView top={<AdwHeaderBar showTitle={false} />}>
                <AdwStatusPage
                    iconName="widget-multi-layout-symbolic"
                    title="Multi-Layout View"
                    description="A widget for switching between different layouts"
                >
                    <GtkButton
                        label="Run the Demo"
                        halign={Gtk.Align.CENTER}
                        cssClasses={["pill"]}
                        onClicked={() => setOpen(true)}
                    />
                </AdwStatusPage>
            </AdwToolbarView>
            {open && <MultiLayoutDialog onClosed={() => setOpen(false)} />}
        </>
    );
};
