import type * as Adw from "@gtkx/ffi/adw";
import * as Gtk from "@gtkx/ffi/gtk";
import {
    AdwCarousel,
    AdwCarouselIndicatorDots,
    AdwCarouselIndicatorLines,
    AdwClamp,
    GtkBox,
    GtkButton,
    GtkFrame,
    GtkImage,
    GtkLabel,
} from "@gtkx/react";
import { useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./carousel.tsx?raw";

const carouselPages = [
    { title: "Welcome", description: "Get started with our application", icon: "starred-symbolic", color: "#3584e4" },
    {
        title: "Explore",
        description: "Discover new features and content",
        icon: "system-search-symbolic",
        color: "#33d17a",
    },
    { title: "Create", description: "Build amazing things with ease", icon: "document-new-symbolic", color: "#ff7800" },
    { title: "Share", description: "Connect and share with others", icon: "emblem-shared-symbolic", color: "#9141ac" },
];

const CarouselDemo = () => {
    const carouselRef = useRef<Adw.Carousel | null>(null);
    const [currentPage, setCurrentPage] = useState(0);
    const [allowMouseDrag, setAllowMouseDrag] = useState(true);
    const [allowLongSwipes, setAllowLongSwipes] = useState(false);

    const scrollTo = (index: number) => {
        if (carouselRef.current && index >= 0 && index < carouselPages.length) {
            const page = carouselRef.current.getNthPage(index);
            if (page) {
                carouselRef.current.scrollTo(page, true);
            }
        }
    };

    const goNext = () => {
        if (currentPage < carouselPages.length - 1) {
            scrollTo(currentPage + 1);
        }
    };

    const goPrevious = () => {
        if (currentPage > 0) {
            scrollTo(currentPage - 1);
        }
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Carousel" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="AdwCarousel displays swipeable pages with smooth animations. It supports both touch and mouse gestures, and can be paired with indicator widgets for pagination."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            {/* Main Carousel with Dots */}
            <GtkFrame>
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={16}
                    marginBottom={16}
                    marginStart={16}
                    marginEnd={16}
                >
                    <GtkLabel label="Carousel with Dots" cssClasses={["heading"]} halign={Gtk.Align.START} />

                    <AdwCarousel
                        ref={carouselRef}
                        allowMouseDrag={allowMouseDrag}
                        allowLongSwipes={allowLongSwipes}
                        onPageChanged={(_self, index) => {
                            setCurrentPage(index);
                        }}
                    >
                        {carouselPages.map((page) => (
                            <AdwClamp key={page.title} maximumSize={400}>
                                <GtkBox
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={16}
                                    marginTop={48}
                                    marginBottom={48}
                                    marginStart={24}
                                    marginEnd={24}
                                    valign={Gtk.Align.CENTER}
                                >
                                    <GtkImage iconName={page.icon} pixelSize={64} />
                                    <GtkLabel label={page.title} cssClasses={["title-1"]} />
                                    <GtkLabel
                                        label={page.description}
                                        cssClasses={["dim-label"]}
                                        wrap
                                        halign={Gtk.Align.CENTER}
                                    />
                                </GtkBox>
                            </AdwClamp>
                        ))}
                    </AdwCarousel>

                    <AdwCarouselIndicatorDots carousel={carouselRef.current ?? undefined} />
                </GtkBox>
            </GtkFrame>

            {/* Navigation Controls */}
            <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={8} halign={Gtk.Align.CENTER}>
                <GtkButton
                    iconName="go-previous-symbolic"
                    onClicked={goPrevious}
                    sensitive={currentPage > 0}
                    cssClasses={["circular"]}
                />
                <GtkLabel
                    label={`${currentPage + 1} / ${carouselPages.length}`}
                    cssClasses={["dim-label"]}
                    widthChars={7}
                    halign={Gtk.Align.CENTER}
                />
                <GtkButton
                    iconName="go-next-symbolic"
                    onClicked={goNext}
                    sensitive={currentPage < carouselPages.length - 1}
                    cssClasses={["circular"]}
                />
            </GtkBox>

            {/* Carousel with Lines */}
            <GtkFrame>
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={16}
                    marginBottom={16}
                    marginStart={16}
                    marginEnd={16}
                >
                    <GtkLabel label="Carousel with Lines" cssClasses={["heading"]} halign={Gtk.Align.START} />

                    <CarouselWithLines />
                </GtkBox>
            </GtkFrame>

            {/* Options */}
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Options" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={8}>
                    <GtkButton
                        label={allowMouseDrag ? "Mouse Drag: On" : "Mouse Drag: Off"}
                        onClicked={() => setAllowMouseDrag(!allowMouseDrag)}
                        cssClasses={allowMouseDrag ? ["suggested-action"] : []}
                    />
                    <GtkButton
                        label={allowLongSwipes ? "Long Swipes: On" : "Long Swipes: Off"}
                        onClicked={() => setAllowLongSwipes(!allowLongSwipes)}
                        cssClasses={allowLongSwipes ? ["suggested-action"] : []}
                    />
                </GtkBox>
            </GtkBox>

            {/* Key Properties */}
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Key Properties" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="allowMouseDrag: Enable dragging with mouse. allowLongSwipes: Allow swiping multiple pages. allowScrollWheel: Enable scroll wheel navigation. interactive: Enable/disable all navigation. AdwCarouselIndicatorDots/Lines: Pagination indicators."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
        </GtkBox>
    );
};

const CarouselWithLines = () => {
    const carouselRef = useRef<Adw.Carousel | null>(null);

    const colors = ["#e01b24", "#ff7800", "#f6d32d", "#33d17a", "#3584e4"];

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
            <AdwCarousel ref={carouselRef} allowMouseDrag>
                {colors.map((color, index) => (
                    <GtkBox
                        key={color}
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={0}
                        cssClasses={["card"]}
                        valign={Gtk.Align.CENTER}
                        halign={Gtk.Align.CENTER}
                    >
                        <GtkLabel
                            label={`Page ${index + 1}`}
                            cssClasses={["title-2"]}
                            marginTop={32}
                            marginBottom={32}
                            marginStart={64}
                            marginEnd={64}
                        />
                    </GtkBox>
                ))}
            </AdwCarousel>
            <AdwCarouselIndicatorLines carousel={carouselRef.current ?? undefined} />
        </GtkBox>
    );
};

export const carouselDemo: Demo = {
    id: "carousel",
    title: "Carousel",
    description: "Swipeable pages with smooth animations and indicators",
    keywords: [
        "carousel",
        "swipe",
        "pages",
        "slider",
        "onboarding",
        "AdwCarousel",
        "AdwCarouselIndicatorDots",
        "libadwaita",
    ],
    component: CarouselDemo,
    sourceCode,
};
