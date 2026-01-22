import type * as Adw from "@gtkx/ffi/adw";
import * as Gtk from "@gtkx/ffi/gtk";
import {
    AdwPreferencesGroup,
    AdwToggleGroup,
    GtkBox,
    GtkCalendar,
    GtkFrame,
    GtkLabel,
    GtkLevelBar,
    GtkScale,
    x,
} from "@gtkx/react";
import { useState } from "react";

export const WidgetDemo = () => {
    const [scaleValue, setScaleValue] = useState(50);
    const [levelValue, setLevelValue] = useState(0.6);
    const [viewMode, setViewMode] = useState("list");

    const today = new Date();
    const markedDays = [5, 10, 15, 20, 25];

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={24}
            marginTop={24}
            marginBottom={24}
            marginStart={24}
            marginEnd={24}
        >
            <GtkLabel label="Widget Components" cssClasses={["title-1"]} halign={Gtk.Align.START} />

            <AdwPreferencesGroup title="GtkScale marks" description="Marks on a GtkScale slider via the marks prop">
                <GtkFrame marginTop={12}>
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={12}
                        marginTop={12}
                        marginBottom={12}
                        marginStart={12}
                        marginEnd={12}
                    >
                        <GtkLabel label={`Value: ${scaleValue}`} />
                        <GtkScale
                            hexpand
                            value={scaleValue}
                            lower={0}
                            upper={100}
                            stepIncrement={1}
                            pageIncrement={10}
                            onValueChanged={(value) => setScaleValue(Math.round(value))}
                            marks={[
                                { value: 0, label: "0", position: Gtk.PositionType.BOTTOM },
                                { value: 25, position: Gtk.PositionType.BOTTOM },
                                { value: 50, label: "50", position: Gtk.PositionType.BOTTOM },
                                { value: 75, position: Gtk.PositionType.BOTTOM },
                                { value: 100, label: "100", position: Gtk.PositionType.BOTTOM },
                            ]}
                        />

                        <GtkLabel label="With labels on specific marks" cssClasses={["dim-label"]} marginTop={12} />
                        <GtkScale
                            hexpand
                            value={50}
                            lower={0}
                            upper={100}
                            stepIncrement={1}
                            pageIncrement={10}
                            marks={[
                                { value: 0, label: "Min", position: Gtk.PositionType.TOP },
                                { value: 50, label: "Mid", position: Gtk.PositionType.TOP },
                                { value: 100, label: "Max", position: Gtk.PositionType.TOP },
                            ]}
                        />
                    </GtkBox>
                </GtkFrame>
            </AdwPreferencesGroup>

            <AdwPreferencesGroup
                title="GtkCalendar markedDays"
                description="Mark specific days on a GtkCalendar via the markedDays prop"
            >
                <GtkFrame marginTop={12}>
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={12}
                        marginTop={12}
                        marginBottom={12}
                        marginStart={12}
                        marginEnd={12}
                    >
                        <GtkLabel
                            label={`Marked days: ${markedDays.join(", ")}`}
                            halign={Gtk.Align.START}
                            cssClasses={["dim-label"]}
                        />
                        <GtkCalendar
                            year={today.getFullYear()}
                            month={today.getMonth()}
                            day={today.getDate()}
                            markedDays={markedDays}
                        />
                    </GtkBox>
                </GtkFrame>
            </AdwPreferencesGroup>

            <AdwPreferencesGroup
                title="GtkLevelBar offsets"
                description="Named thresholds on a GtkLevelBar via the offsets prop"
            >
                <GtkFrame marginTop={12}>
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={12}
                        marginTop={12}
                        marginBottom={12}
                        marginStart={12}
                        marginEnd={12}
                    >
                        <GtkLabel label={`Level: ${Math.round(levelValue * 100)}%`} />
                        <GtkLevelBar
                            value={levelValue}
                            minValue={0}
                            maxValue={1}
                            offsets={[
                                { id: "low", value: 0.25 },
                                { id: "high", value: 0.75 },
                                { id: "full", value: 1.0 },
                            ]}
                        />

                        <GtkBox halign={Gtk.Align.CENTER} spacing={6}>
                            <GtkLabel label="0%" cssClasses={["dim-label"]} />
                            <GtkScale
                                widthRequest={200}
                                value={levelValue}
                                lower={0}
                                upper={1}
                                stepIncrement={0.01}
                                pageIncrement={0.1}
                                onValueChanged={(value) => setLevelValue(value)}
                            />
                            <GtkLabel label="100%" cssClasses={["dim-label"]} />
                        </GtkBox>

                        <GtkLabel
                            label="Colors change at 25% (low), 75% (high), and 100% (full)"
                            cssClasses={["dim-label"]}
                        />
                    </GtkBox>
                </GtkFrame>
            </AdwPreferencesGroup>

            <AdwPreferencesGroup title="x.Toggle" description="Toggle buttons for an AdwToggleGroup">
                <GtkFrame marginTop={12}>
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={12}
                        marginTop={12}
                        marginBottom={12}
                        marginStart={12}
                        marginEnd={12}
                    >
                        <GtkLabel label="View mode with icons:" halign={Gtk.Align.START} />
                        <AdwToggleGroup
                            halign={Gtk.Align.START}
                            active={viewMode === "list" ? 0 : viewMode === "grid" ? 1 : 2}
                            onNotify={(pspec, self) => {
                                if (pspec.getName() === "active") {
                                    const group = self as Adw.ToggleGroup;
                                    const toggle = group.getToggle(group.getActive());
                                    if (toggle) setViewMode(toggle.getName() ?? "list");
                                }
                            }}
                        >
                            <x.Toggle id="list" iconName="view-list-symbolic" tooltip="List View" />
                            <x.Toggle id="grid" iconName="view-grid-symbolic" tooltip="Grid View" />
                            <x.Toggle id="flow" iconName="view-continuous-symbolic" tooltip="Flow View" />
                        </AdwToggleGroup>

                        <GtkLabel label={`Selected: ${viewMode}`} cssClasses={["dim-label"]} />

                        <GtkLabel label="With text labels:" halign={Gtk.Align.START} marginTop={12} />
                        <AdwToggleGroup halign={Gtk.Align.START}>
                            <x.Toggle id="day" label="Day" />
                            <x.Toggle id="week" label="Week" />
                            <x.Toggle id="month" label="Month" />
                            <x.Toggle id="year" label="Year" />
                        </AdwToggleGroup>

                        <GtkLabel label="Mixed icons and labels:" halign={Gtk.Align.START} marginTop={12} />
                        <AdwToggleGroup halign={Gtk.Align.START}>
                            <x.Toggle id="bold" iconName="format-text-bold-symbolic" tooltip="Bold" />
                            <x.Toggle id="italic" iconName="format-text-italic-symbolic" tooltip="Italic" />
                            <x.Toggle id="underline" iconName="format-text-underline-symbolic" tooltip="Underline" />
                            <x.Toggle
                                id="strikethrough"
                                iconName="format-text-strikethrough-symbolic"
                                tooltip="Strikethrough"
                            />
                        </AdwToggleGroup>

                        <GtkLabel label="With disabled toggles:" halign={Gtk.Align.START} marginTop={12} />
                        <AdwToggleGroup halign={Gtk.Align.START}>
                            <x.Toggle id="enabled1" label="Enabled" />
                            <x.Toggle id="disabled1" label="Disabled" enabled={false} />
                            <x.Toggle id="enabled2" label="Enabled" />
                        </AdwToggleGroup>
                    </GtkBox>
                </GtkFrame>
            </AdwPreferencesGroup>
        </GtkBox>
    );
};
