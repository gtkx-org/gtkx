import { css, cx } from "@gtkx/css";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkLabel, GtkScale, GtkToggleButton } from "@gtkx/react";
import { useEffect, useMemo, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./layoutmanager2.tsx?raw";

const animatedItemStyle = css`
 background-color: @accent_bg_color;
 color: @accent_fg_color;
 border-radius: 8px;
 padding: 12px;
 transition: all 300ms ease-in-out;
`;

const animatedItemExpandedStyle = css`
 background-color: @success_bg_color;
 color: @success_fg_color;
`;

const priorityHighStyle = css`
 background-color: @error_bg_color;
 color: @error_fg_color;
`;

const priorityMediumStyle = css`
 background-color: @warning_bg_color;
 color: @warning_fg_color;
`;

const priorityLowStyle = css`
 background-color: alpha(@accent_bg_color, 0.5);
`;

const breakpointIndicatorStyle = css`
 padding: 8px 16px;
 border-radius: 4px;
 font-weight: bold;
`;

const breakpointCompactStyle = css`
 background-color: @warning_bg_color;
 color: @warning_fg_color;
`;

const breakpointMediumStyle = css`
 background-color: @accent_bg_color;
 color: @accent_fg_color;
`;

const breakpointExpandedStyle = css`
 background-color: @success_bg_color;
 color: @success_fg_color;
`;

const AnimatedLayoutDemo = () => {
    const [expanded, setExpanded] = useState(false);
    const [animationProgress, setAnimationProgress] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (!isAnimating) return;

        const targetProgress = expanded ? 1 : 0;
        const step = expanded ? 0.05 : -0.05;

        const interval = setInterval(() => {
            setAnimationProgress((prev) => {
                const next = prev + step;
                if ((step > 0 && next >= targetProgress) || (step < 0 && next <= targetProgress)) {
                    setIsAnimating(false);
                    return targetProgress;
                }
                return next;
            });
        }, 16);

        return () => clearInterval(interval);
    }, [isAnimating, expanded]);

    const handleToggle = () => {
        setExpanded(!expanded);
        setIsAnimating(true);
    };

    const itemSpacing = Math.round(8 + animationProgress * 16);
    const itemPadding = Math.round(8 + animationProgress * 8);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={16}>
            <GtkLabel
                label="Animated layout transitions smoothly interpolate between layout states. Click the toggle to see the layout animate."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Animated Transition">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={16}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkBox spacing={12}>
                        <GtkToggleButton
                            label={expanded ? "Collapse Layout" : "Expand Layout"}
                            active={expanded}
                            onToggled={handleToggle}
                            cssClasses={["suggested-action"]}
                        />
                        <GtkLabel
                            label={`Progress: ${Math.round(animationProgress * 100)}%`}
                            cssClasses={["monospace"]}
                            valign={Gtk.Align.CENTER}
                        />
                    </GtkBox>

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={itemSpacing}>
                        {["Header", "Content", "Sidebar", "Footer"].map((item) => (
                            <GtkLabel
                                key={item}
                                label={item}
                                cssClasses={[cx(animatedItemStyle, expanded && animatedItemExpandedStyle)]}
                                marginStart={itemPadding}
                                marginEnd={itemPadding}
                                marginTop={Math.round(itemPadding / 2)}
                                marginBottom={Math.round(itemPadding / 2)}
                            />
                        ))}
                    </GtkBox>

                    <GtkLabel
                        label={`Spacing: ${itemSpacing}px, Padding: ${itemPadding}px`}
                        cssClasses={["dim-label", "caption"]}
                        halign={Gtk.Align.START}
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

const ResponsiveBreakpointsDemo = () => {
    const [containerWidth, setContainerWidth] = useState(400);
    const widthAdjustment = useMemo(() => new Gtk.Adjustment(400, 200, 800, 10, 50, 0), []);

    const getBreakpoint = (width: number): "compact" | "medium" | "expanded" => {
        if (width < 300) return "compact";
        if (width < 500) return "medium";
        return "expanded";
    };

    const breakpoint = getBreakpoint(containerWidth);

    const layoutConfig = {
        compact: {
            columns: 1,
            showSidebar: false,
            showLabels: false,
            orientation: Gtk.Orientation.VERTICAL,
        },
        medium: {
            columns: 2,
            showSidebar: false,
            showLabels: true,
            orientation: Gtk.Orientation.HORIZONTAL,
        },
        expanded: {
            columns: 3,
            showSidebar: true,
            showLabels: true,
            orientation: Gtk.Orientation.HORIZONTAL,
        },
    }[breakpoint];

    const items = [
        { id: "1", icon: "folder-symbolic", label: "Documents" },
        { id: "2", icon: "music-symbolic", label: "Music" },
        { id: "3", icon: "camera-photo-symbolic", label: "Photos" },
        { id: "4", icon: "video-x-generic-symbolic", label: "Videos" },
    ];

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={16}>
            <GtkLabel
                label="Responsive layouts adapt based on available space. Adjust the width slider to see how the layout changes at different breakpoints."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Responsive Breakpoints">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={16}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkBox spacing={12}>
                        <GtkLabel label="Container Width:" halign={Gtk.Align.START} />
                        <GtkScale
                            adjustment={widthAdjustment}
                            drawValue
                            valuePos={Gtk.PositionType.RIGHT}
                            hexpand
                            onValueChanged={(scale: Gtk.Range) => setContainerWidth(Math.round(scale.getValue()))}
                        />
                    </GtkBox>

                    <GtkBox spacing={12}>
                        <GtkLabel label="Current Breakpoint:" />
                        <GtkLabel
                            label={breakpoint.toUpperCase()}
                            cssClasses={[
                                cx(
                                    breakpointIndicatorStyle,
                                    breakpoint === "compact" && breakpointCompactStyle,
                                    breakpoint === "medium" && breakpointMediumStyle,
                                    breakpoint === "expanded" && breakpointExpandedStyle,
                                ),
                            ]}
                        />
                    </GtkBox>

                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        widthRequest={containerWidth}
                        cssClasses={["card"]}
                        halign={Gtk.Align.CENTER}
                    >
                        <GtkBox
                            orientation={layoutConfig.orientation}
                            spacing={8}
                            marginStart={12}
                            marginEnd={12}
                            marginTop={12}
                            marginBottom={12}
                            homogeneous={breakpoint !== "compact"}
                        >
                            {items.slice(0, layoutConfig.columns + 1).map((item) => (
                                <GtkButton
                                    key={item.id}
                                    iconName={item.icon}
                                    label={layoutConfig.showLabels ? item.label : undefined}
                                    cssClasses={["flat"]}
                                    hexpand={breakpoint !== "compact"}
                                />
                            ))}
                        </GtkBox>

                        {layoutConfig.showSidebar && (
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={4}
                                marginStart={12}
                                marginEnd={12}
                                marginBottom={12}
                            >
                                <GtkLabel label="Sidebar (expanded only)" cssClasses={["dim-label", "caption"]} />
                            </GtkBox>
                        )}
                    </GtkBox>

                    <GtkLabel
                        label={`Layout: ${layoutConfig.columns} columns, ${layoutConfig.showSidebar ? "with" : "no"} sidebar, ${layoutConfig.showLabels ? "with" : "no"} labels`}
                        cssClasses={["dim-label", "caption"]}
                        halign={Gtk.Align.START}
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

const PriorityAllocationDemo = () => {
    const [availableSpace, setAvailableSpace] = useState(300);
    const spaceAdjustment = useMemo(() => new Gtk.Adjustment(300, 100, 500, 10, 50, 0), []);

    const items = [
        { id: "1", label: "Critical", priority: "high", minWidth: 80, preferredWidth: 150 },
        { id: "2", label: "Important", priority: "medium", minWidth: 60, preferredWidth: 120 },
        { id: "3", label: "Optional", priority: "low", minWidth: 40, preferredWidth: 100 },
        { id: "4", label: "Extra", priority: "low", minWidth: 40, preferredWidth: 80 },
    ];

    const allocateSpace = (totalSpace: number) => {
        const allocations: { [key: string]: number } = {};
        let remainingSpace = totalSpace;

        for (const item of items) {
            allocations[item.id] = item.minWidth;
            remainingSpace -= item.minWidth;
        }

        const priorityOrder = ["high", "medium", "low"];
        for (const priority of priorityOrder) {
            const priorityItems = items.filter((i) => i.priority === priority);
            for (const item of priorityItems) {
                const desired = item.preferredWidth - (allocations[item.id] ?? 0);
                const allocated = Math.min(desired, remainingSpace / priorityItems.length);
                if (allocated > 0) {
                    allocations[item.id] = (allocations[item.id] ?? 0) + allocated;
                    remainingSpace -= allocated;
                }
            }
        }

        return allocations;
    };

    const allocations = allocateSpace(availableSpace);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={16}>
            <GtkLabel
                label="Priority-based allocation distributes space to high-priority items first, then medium, then low priority."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Priority-Based Allocation">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={16}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkBox spacing={12}>
                        <GtkLabel label="Available Space:" halign={Gtk.Align.START} />
                        <GtkScale
                            adjustment={spaceAdjustment}
                            drawValue
                            valuePos={Gtk.PositionType.RIGHT}
                            hexpand
                            onValueChanged={(scale: Gtk.Range) => setAvailableSpace(Math.round(scale.getValue()))}
                        />
                    </GtkBox>

                    <GtkBox spacing={4}>
                        {items.map((item) => {
                            const priorityStyle =
                                item.priority === "high"
                                    ? priorityHighStyle
                                    : item.priority === "medium"
                                      ? priorityMediumStyle
                                      : priorityLowStyle;
                            return (
                                <GtkLabel
                                    key={item.id}
                                    label={`${item.label}\n${Math.round(allocations[item.id] ?? 0)}px`}
                                    widthRequest={allocations[item.id] ?? 0}
                                    cssClasses={[priorityStyle]}
                                    marginTop={8}
                                    marginBottom={8}
                                />
                            );
                        })}
                    </GtkBox>

                    <GtkFrame label="Allocation Details">
                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={4}
                            marginStart={12}
                            marginEnd={12}
                            marginTop={12}
                            marginBottom={12}
                        >
                            {items.map((item) => (
                                <GtkLabel
                                    key={item.id}
                                    label={`${item.label} (${item.priority}): ${Math.round(allocations[item.id] ?? 0)}px (min: ${item.minWidth}, preferred: ${item.preferredWidth})`}
                                    halign={Gtk.Align.START}
                                    cssClasses={["monospace", "caption"]}
                                />
                            ))}
                        </GtkBox>
                    </GtkFrame>
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

const LayoutManager2Demo = () => {
    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={20}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="Advanced Layout Patterns" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="Advanced layout patterns include animated transitions, responsive breakpoints, and priority-based space allocation."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <AnimatedLayoutDemo />
            <ResponsiveBreakpointsDemo />
            <PriorityAllocationDemo />
        </GtkBox>
    );
};

export const layoutManager2Demo: Demo = {
    id: "layoutmanager2",
    title: "Layout Manager/Transformation",
    description: "Animated transitions, responsive breakpoints, and priority allocation",
    keywords: ["layout", "animation", "transition", "responsive", "breakpoint", "priority", "allocation", "adaptive"],
    component: LayoutManager2Demo,
    sourceCode,
};
