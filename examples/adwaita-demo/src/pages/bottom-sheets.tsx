import * as Pango from "@gtkx/gi/pango";
import { AdwBottomSheet, AdwHeaderBar, AdwStatusPage, AdwToolbarView } from "@gtkx/jsx/adw";
import { GtkCenterBox, GtkLabel } from "@gtkx/jsx/gtk";
import { type ReactNode, useState } from "react";

export const BottomSheetsPage = (): ReactNode => {
    const [bottomBarHeight, setBottomBarHeight] = useState(0);

    return (
        <AdwBottomSheet
            onNotifyBottomBarHeight={(value) => setBottomBarHeight(value ?? 0)}
            sheet={
                <AdwToolbarView top={<AdwHeaderBar />}>
                    <AdwStatusPage iconName="go-down-symbolic" />
                </AdwToolbarView>
            }
            bottomBar={
                <GtkCenterBox
                    cssClasses={["toolbar"]}
                    heightRequest={46}
                    centerWidget={<GtkLabel label="Pull Up Here" ellipsize={Pango.EllipsizeMode.END} />}
                />
            }
        >
            <AdwToolbarView top={<AdwHeaderBar showTitle={false} />}>
                <AdwStatusPage
                    iconName="widget-bottom-sheet-symbolic"
                    title="Bottom Sheet"
                    description="A bottom sheet with an optional bottom bar"
                    marginBottom={bottomBarHeight}
                />
            </AdwToolbarView>
        </AdwBottomSheet>
    );
};
