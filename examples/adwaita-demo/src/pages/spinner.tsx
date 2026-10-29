import type * as Gtk from "@gtkx/gi/gtk";
import { AdwHeaderBar, AdwSpinnerPaintable, AdwStatusPage, AdwToolbarView } from "@gtkx/jsx/adw";
import { useState } from "react";

export const SpinnerPage = () => {
    const [widget, setWidget] = useState<Gtk.Widget | null>(null);

    return (
        <AdwToolbarView ref={setWidget} top={<AdwHeaderBar showTitle={false} />}>
            <AdwStatusPage
                title="Spinner"
                description="A modern spinner widget"
                paintable={<AdwSpinnerPaintable widget={widget ?? undefined} />}
            />
        </AdwToolbarView>
    );
};
