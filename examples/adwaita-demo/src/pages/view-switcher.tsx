import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import {
    AdwBreakpoint,
    AdwDialog,
    AdwHeaderBar,
    AdwStatusPage,
    AdwToolbarView,
    AdwViewStack,
    AdwViewStackPage,
    AdwViewSwitcher,
    AdwViewSwitcherBar,
} from "@gtkx/jsx/adw";
import { GtkButton } from "@gtkx/jsx/gtk";
import { type ReactNode, useMemo, useState } from "react";

const ViewSwitcherDialog = ({ onClosed }: { onClosed: () => void }): ReactNode => {
    const [narrow, setNarrow] = useState(false);
    const [stack, setStack] = useState<Adw.ViewStack | null>(null);
    const condition = useMemo(
        () => Adw.BreakpointCondition.newLength(Adw.BreakpointConditionLengthType.MAX_WIDTH, 550, Adw.LengthUnit.SP),
        [],
    );

    return (
        <AdwDialog
            title="AdwViewSwitcher Demo"
            widthRequest={360}
            heightRequest={200}
            contentWidth={640}
            contentHeight={480}
            onClosed={onClosed}
            breakpoints={
                <AdwBreakpoint
                    condition={condition}
                    onApply={() => setNarrow(true)}
                    onUnapply={() => setNarrow(false)}
                />
            }
        >
            <AdwToolbarView
                top={
                    <AdwHeaderBar
                        titleWidget={
                            !narrow && stack ? (
                                <AdwViewSwitcher stack={stack} policy={Adw.ViewSwitcherPolicy.WIDE} />
                            ) : undefined
                        }
                    />
                }
                bottom={<AdwViewSwitcherBar stack={stack ?? undefined} reveal={narrow} />}
            >
                <AdwViewStack ref={setStack}>
                    <AdwViewStackPage name="page1" title="_World" iconName="clock-world-symbolic" useUnderline>
                        <AdwStatusPage
                            iconName="clock-world-symbolic"
                            title="World"
                            description="View the time in cities around the world"
                        />
                    </AdwViewStackPage>
                    <AdwViewStackPage name="page2" title="_Alarm" iconName="clock-alarm-symbolic" useUnderline>
                        <AdwStatusPage
                            iconName="clock-alarm-symbolic"
                            title="Alarm"
                            description="Set customizable alarms to go off on specific days"
                        />
                    </AdwViewStackPage>
                    <AdwViewStackPage
                        name="page3"
                        title="_Stopwatch"
                        iconName="clock-stopwatch-symbolic"
                        badgeNumber={3}
                        needsAttention
                        useUnderline
                    >
                        <AdwStatusPage
                            iconName="clock-stopwatch-symbolic"
                            title="Stopwatch"
                            description="Use the stopwatch to time how long something takes"
                        />
                    </AdwViewStackPage>
                    <AdwViewStackPage name="page4" title="Tim_er" iconName="clock-timer-symbolic" useUnderline>
                        <AdwStatusPage
                            iconName="clock-timer-symbolic"
                            title="Timer"
                            description="Set a countdown in seconds, minutes or hours"
                        />
                    </AdwViewStackPage>
                </AdwViewStack>
            </AdwToolbarView>
        </AdwDialog>
    );
};

export const ViewSwitcherPage = (): ReactNode => {
    const [open, setOpen] = useState(false);

    return (
        <>
            <AdwToolbarView top={<AdwHeaderBar showTitle={false} />}>
                <AdwStatusPage
                    iconName="widget-view-switcher-symbolic"
                    title="View Switcher"
                    description="Widgets to switch the window's view"
                >
                    <GtkButton
                        label="Run the Demo"
                        halign={Gtk.Align.CENTER}
                        cssClasses={["pill"]}
                        onClicked={() => setOpen(true)}
                    />
                </AdwStatusPage>
            </AdwToolbarView>
            {open && <ViewSwitcherDialog onClosed={() => setOpen(false)} />}
        </>
    );
};
