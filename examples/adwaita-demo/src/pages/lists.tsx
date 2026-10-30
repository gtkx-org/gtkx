import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import {
    AdwActionRow,
    AdwButtonContent,
    AdwButtonRow,
    AdwClamp,
    AdwComboRow,
    AdwEntryRow,
    AdwEnumListModel,
    AdwExpanderRow,
    AdwHeaderBar,
    AdwPasswordEntryRow,
    AdwPreferencesGroup,
    AdwSpinRow,
    AdwStatusPage,
    AdwSwitchRow,
    AdwToolbarView,
} from "@gtkx/jsx/adw";
import { GtkAdjustment, GtkBox, GtkButton, GtkCheckButton, GtkStringList } from "@gtkx/jsx/gtk";
import { getClassType, resolveType } from "@gtkx/runtime";
import { useState } from "react";
import { useDemo } from "../context.js";

const CopyButton = () => (
    <GtkButton valign={Gtk.Align.CENTER} iconName="edit-copy-symbolic" tooltipText="Copy" cssClasses={["flat"]} />
);

const NestedRows = () => (
    <>
        <AdwActionRow title="A Nested Row" />
        <AdwActionRow title="Another Nested Row" />
    </>
);

export const ListsPage = () => {
    const { notify } = useDemo();
    const [firstButton, setFirstButton] = useState<Gtk.CheckButton | null>(null);
    const [secondButton, setSecondButton] = useState<Gtk.CheckButton | null>(null);
    const [expression] = useState(() => Gtk.PropertyExpression.new(getClassType(Adw.EnumListItem), null, "nick"));

    return (
        <AdwToolbarView top={<AdwHeaderBar showTitle={false} />}>
            <AdwStatusPage
                iconName="widget-list-symbolic"
                title="Boxed Lists"
                description="Rows for the boxed list pattern"
            >
                <AdwClamp maximumSize={400} tighteningThreshold={300}>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                        <AdwPreferencesGroup>
                            <AdwActionRow title="Rows Have a Title" subtitle="They also have a subtitle" />
                            <AdwActionRow
                                title="Rows Can Have Suffix Widgets"
                                suffix={<GtkButton label="Action" valign={Gtk.Align.CENTER} />}
                            />
                        </AdwPreferencesGroup>
                        <AdwPreferencesGroup>
                            <AdwActionRow
                                title="Rows Can Have Prefix Widgets"
                                activatableWidget={firstButton ?? undefined}
                                prefix={<GtkCheckButton ref={setFirstButton} valign={Gtk.Align.CENTER} active />}
                            />
                            <AdwActionRow
                                title="Rows Can Have Prefix Widgets"
                                activatableWidget={secondButton ?? undefined}
                                prefix={
                                    <GtkCheckButton
                                        ref={setSecondButton}
                                        group={firstButton ?? undefined}
                                        valign={Gtk.Align.CENTER}
                                    />
                                }
                            />
                        </AdwPreferencesGroup>
                        <AdwPreferencesGroup title="Entry Rows" separateRows>
                            <AdwEntryRow title="Entry Row" useUnderline />
                            <AdwEntryRow
                                title="Entry With Confirmation"
                                showApplyButton
                                onApply={() => notify("Changes applied")}
                            />
                            <AdwEntryRow title="Entry With Suffix" suffix={<CopyButton />} />
                            <AdwPasswordEntryRow title="Password Entry" />
                        </AdwPreferencesGroup>
                        <AdwPreferencesGroup title="Spin Rows">
                            <AdwSpinRow
                                title="Spin Row"
                                adjustment={
                                    <GtkAdjustment
                                        lower={0}
                                        upper={100}
                                        value={50}
                                        pageIncrement={10}
                                        stepIncrement={1}
                                    />
                                }
                            />
                        </AdwPreferencesGroup>
                        <AdwPreferencesGroup title="Switch Rows">
                            <AdwSwitchRow title="Switch Row" />
                        </AdwPreferencesGroup>
                        <AdwPreferencesGroup title="Combo Rows">
                            <AdwComboRow title="Combo Row" model={<GtkStringList strings={["Foo", "Bar", "Baz"]} />} />
                            <AdwComboRow
                                title="Enumeration Combo Row"
                                subtitle="This combo row was created from an enumeration"
                                enableSearch
                                model={
                                    <AdwEnumListModel enumType={resolveType("libgtk-4.so.1", "gtk_license_get_type")} />
                                }
                                expression={expression}
                            />
                        </AdwPreferencesGroup>
                        <AdwPreferencesGroup title="Expander Rows">
                            <AdwExpanderRow title="Expander Row" rows={<NestedRows />} />
                            <AdwExpanderRow
                                title="Expander Row With an Action"
                                suffix={<CopyButton />}
                                rows={<NestedRows />}
                            />
                            <AdwExpanderRow title="Toggleable Expander Row" showEnableSwitch rows={<NestedRows />} />
                        </AdwPreferencesGroup>
                        <AdwPreferencesGroup title="Property Rows">
                            <AdwActionRow
                                title="Property Row"
                                subtitle="Value"
                                subtitleSelectable
                                cssClasses={["property"]}
                            />
                        </AdwPreferencesGroup>
                        <AdwPreferencesGroup
                            title="Groups With Suffix"
                            headerSuffix={
                                <GtkButton cssClasses={["flat"]}>
                                    <AdwButtonContent iconName="list-add-symbolic" label="Suffix" />
                                </GtkButton>
                            }
                        >
                            <AdwActionRow title="Groups Can Have a Header Suffix" />
                        </AdwPreferencesGroup>
                        <AdwPreferencesGroup title="Button Rows" separateRows>
                            <AdwButtonRow title="Add Input Source" startIconName="list-add-symbolic" />
                            <AdwButtonRow title="Add Calendar" endIconName="go-next-symbolic" />
                            <AdwButtonRow title="Delete Event" cssClasses={["destructive-action"]} />
                            <AdwButtonRow title="Search" cssClasses={["suggested-action"]} />
                        </AdwPreferencesGroup>
                    </GtkBox>
                </AdwClamp>
            </AdwStatusPage>
        </AdwToolbarView>
    );
};
