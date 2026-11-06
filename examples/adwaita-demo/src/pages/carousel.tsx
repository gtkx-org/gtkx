import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import {
    AdwCarousel,
    AdwCarouselIndicatorDots,
    AdwCarouselIndicatorLines,
    AdwClamp,
    AdwComboRow,
    AdwHeaderBar,
    AdwPreferencesGroup,
    AdwStatusPage,
    AdwSwitchRow,
    AdwToolbarView,
} from "@gtkx/jsx/adw";
import { GtkBox, GtkButton, GtkSizeGroup, GtkStack, GtkStackPage, GtkStringList } from "@gtkx/jsx/gtk";
import { type ReactNode, useState } from "react";

const ORIENTATIONS = [Gtk.Orientation.HORIZONTAL, Gtk.Orientation.VERTICAL];

export const CarouselPage = (): ReactNode => {
    const [carousel, setCarousel] = useState<Adw.Carousel | null>(null);
    const [emptyBox, setEmptyBox] = useState<Gtk.Box | null>(null);
    const [indicatorsStack, setIndicatorsStack] = useState<Gtk.Stack | null>(null);
    const [orientation, setOrientation] = useState(Gtk.Orientation.HORIZONTAL);
    const [indicators, setIndicators] = useState(0);
    const [scrollWheel, setScrollWheel] = useState(true);
    const [longSwipes, setLongSwipes] = useState(false);

    return (
        <>
            <AdwToolbarView top={<AdwHeaderBar showTitle={false} />}>
                <GtkBox
                    orientation={
                        orientation === Gtk.Orientation.HORIZONTAL
                            ? Gtk.Orientation.VERTICAL
                            : Gtk.Orientation.HORIZONTAL
                    }
                >
                    <GtkBox ref={setEmptyBox} />
                    <AdwCarousel
                        ref={setCarousel}
                        hexpand
                        vexpand
                        orientation={orientation}
                        allowScrollWheel={scrollWheel}
                        allowLongSwipes={longSwipes}
                    >
                        <AdwStatusPage
                            iconName="widget-carousel-symbolic"
                            title="Carousel"
                            description="A widget for paginated scrolling"
                            vexpand
                        />
                        <AdwClamp
                            marginBottom={32}
                            marginStart={12}
                            marginEnd={12}
                            maximumSize={400}
                            tighteningThreshold={300}
                            valign={Gtk.Align.CENTER}
                        >
                            <AdwPreferencesGroup>
                                <AdwComboRow
                                    title="Orientation"
                                    model={<GtkStringList strings={["Horizontal", "Vertical"]} />}
                                    selected={orientation}
                                    onNotifySelected={(selected) => {
                                        const next = ORIENTATIONS[selected];
                                        if (next !== undefined) setOrientation(next);
                                    }}
                                />
                                <AdwComboRow
                                    title="Page Indicators"
                                    model={<GtkStringList strings={["Dots", "Lines"]} />}
                                    selected={indicators}
                                    onNotifySelected={(value) => setIndicators(value ?? 0)}
                                />
                                <AdwSwitchRow
                                    title="Scroll Wheel"
                                    active={scrollWheel}
                                    onNotifyActive={(value) => setScrollWheel(value === true)}
                                />
                                <AdwSwitchRow
                                    title="Long Swipes"
                                    active={longSwipes}
                                    onNotifyActive={(value) => setLongSwipes(value === true)}
                                />
                            </AdwPreferencesGroup>
                        </AdwClamp>
                        <AdwStatusPage title="Another Page" hexpand>
                            <GtkButton
                                label="_Return to the First Page"
                                canShrink
                                useUnderline
                                halign={Gtk.Align.CENTER}
                                cssClasses={["suggested-action", "pill"]}
                                onClicked={() => {
                                    if (carousel) {
                                        carousel.scrollTo(carousel.getNthPage(0), true);
                                    }
                                }}
                            />
                        </AdwStatusPage>
                    </AdwCarousel>
                    <GtkStack
                        ref={setIndicatorsStack}
                        vhomogeneous={false}
                        marginTop={6}
                        marginBottom={6}
                        marginStart={6}
                        marginEnd={6}
                        visibleChildName={indicators === 0 ? "dots" : "lines"}
                    >
                        <GtkStackPage name="dots">
                            <AdwCarouselIndicatorDots carousel={carousel ?? undefined} orientation={orientation} />
                        </GtkStackPage>
                        <GtkStackPage name="lines">
                            <AdwCarouselIndicatorLines carousel={carousel ?? undefined} orientation={orientation} />
                        </GtkStackPage>
                    </GtkStack>
                </GtkBox>
            </AdwToolbarView>
            <GtkSizeGroup
                mode={Gtk.SizeGroupMode.BOTH}
                widgets={[emptyBox, indicatorsStack].filter((widget) => widget !== null)}
            />
        </>
    );
};
