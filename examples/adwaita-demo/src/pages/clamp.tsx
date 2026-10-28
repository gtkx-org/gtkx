import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import {
    AdwClamp,
    AdwComboRow,
    AdwEnumListModel,
    AdwHeaderBar,
    AdwPreferencesGroup,
    AdwSpinRow,
    AdwStatusPage,
    AdwToolbarView,
} from "@gtkx/jsx/adw";
import { GtkAdjustment } from "@gtkx/jsx/gtk";
import { getClassType, resolveType } from "@gtkx/runtime";
import { useState } from "react";

const UNITS = [Adw.LengthUnit.PX, Adw.LengthUnit.PT, Adw.LengthUnit.SP];

export const ClampPage = () => {
    const [maximumSize, setMaximumSize] = useState(400);
    const [threshold, setThreshold] = useState(300);
    const [unit, setUnit] = useState(Adw.LengthUnit.SP);
    const [expression] = useState(() => Gtk.PropertyExpression.new(getClassType(Adw.EnumListItem), null, "nick"));

    return (
        <AdwToolbarView topBar={<AdwHeaderBar showTitle={false} />}>
            <AdwStatusPage
                iconName="widget-clamp-symbolic"
                title="Clamp"
                description="This page is clamped to smoothly grow up to a maximum width"
            >
                <AdwClamp maximumSize={maximumSize} tighteningThreshold={threshold} unit={unit}>
                    <AdwPreferencesGroup>
                        <AdwSpinRow
                            title="Maximum Width"
                            value={maximumSize}
                            onNotifyValue={(value) => setMaximumSize(value ?? 0)}
                            adjustment={
                                <GtkAdjustment
                                    lower={0}
                                    upper={10000}
                                    value={400}
                                    pageIncrement={100}
                                    stepIncrement={10}
                                />
                            }
                        />
                        <AdwSpinRow
                            title="Tightening Threshold"
                            value={threshold}
                            onNotifyValue={(value) => setThreshold(value ?? 0)}
                            adjustment={
                                <GtkAdjustment
                                    lower={0}
                                    upper={10000}
                                    value={300}
                                    pageIncrement={100}
                                    stepIncrement={10}
                                />
                            }
                        />
                        <AdwComboRow
                            title="Unit"
                            selected={unit}
                            expression={expression}
                            model={
                                <AdwEnumListModel
                                    enumType={resolveType("libadwaita-1.so.0", "adw_length_unit_get_type")}
                                />
                            }
                            onNotifySelected={(value) => {
                                const next = UNITS[value];
                                if (next !== undefined) setUnit(next);
                            }}
                        />
                    </AdwPreferencesGroup>
                </AdwClamp>
            </AdwStatusPage>
        </AdwToolbarView>
    );
};
