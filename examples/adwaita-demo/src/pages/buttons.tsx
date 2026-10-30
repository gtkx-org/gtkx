import * as Gtk from "@gtkx/gi/gtk";
import { AdwButtonContent, AdwClamp, AdwHeaderBar, AdwSplitButton, AdwStatusPage, AdwToolbarView } from "@gtkx/jsx/adw";
import { GMenu } from "@gtkx/jsx/gio";
import { GtkGrid, GtkGridLayoutChild } from "@gtkx/jsx/gtk";

const SampleMenu = () => (
    <GMenu items={[{ section: [{ label: "Item 1" }, { label: "Item 2" }, { label: "Item 3" }] }]} />
);

export const ButtonsPage = () => (
    <AdwToolbarView top={<AdwHeaderBar showTitle={false} />}>
        <AdwStatusPage title="Buttons" description="Button helper widgets" iconName="widget-buttons-symbolic">
            <AdwClamp maximumSize={400} tighteningThreshold={300}>
                <GtkGrid halign={Gtk.Align.CENTER} columnSpacing={12} rowSpacing={12}>
                    {[false, true].map((flat, row) => (
                        <GtkGridLayoutChild key={`icon-${row}`} column={0} row={row}>
                            <AdwSplitButton
                                iconName="document-open-symbolic"
                                tooltipText="Open"
                                menuModel={<SampleMenu />}
                                cssClasses={flat ? ["flat"] : []}
                            />
                        </GtkGridLayoutChild>
                    ))}
                    {[false, true].map((flat, row) => (
                        <GtkGridLayoutChild key={`label-${row}`} column={1} row={row}>
                            <AdwSplitButton
                                label="_Open"
                                useUnderline
                                canShrink
                                menuModel={<SampleMenu />}
                                cssClasses={flat ? ["flat"] : []}
                            />
                        </GtkGridLayoutChild>
                    ))}
                    {[false, true].map((flat, row) => (
                        <GtkGridLayoutChild key={`content-${row}`} column={2} row={row}>
                            <AdwSplitButton menuModel={<SampleMenu />} cssClasses={flat ? ["flat"] : []}>
                                <AdwButtonContent
                                    iconName="document-open-symbolic"
                                    label="_Open"
                                    useUnderline
                                    canShrink
                                />
                            </AdwSplitButton>
                        </GtkGridLayoutChild>
                    ))}
                </GtkGrid>
            </AdwClamp>
        </AdwStatusPage>
    </AdwToolbarView>
);
