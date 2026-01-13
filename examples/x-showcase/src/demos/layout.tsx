import * as Gtk from "@gtkx/ffi/gtk";
import {
    AdwHeaderBar,
    AdwPreferencesGroup,
    GtkBox,
    GtkButton,
    GtkFixed,
    GtkFrame,
    GtkGrid,
    GtkImage,
    GtkLabel,
    GtkOverlay,
    x,
} from "@gtkx/react";

export const LayoutDemo = () => {
    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={24}
            marginTop={24}
            marginBottom={24}
            marginStart={24}
            marginEnd={24}
        >
            <GtkLabel label="Layout Components" cssClasses={["title-1"]} halign={Gtk.Align.START} />

            <AdwPreferencesGroup title="x.Slot" description="Place children in named widget slots">
                <GtkFrame>
                    <AdwHeaderBar showTitle={false}>
                        <x.Slot for={AdwHeaderBar} id="titleWidget">
                            <GtkLabel label="Custom Title Widget" cssClasses={["heading"]} />
                        </x.Slot>
                        <x.PackStart>
                            <GtkButton iconName="go-previous-symbolic" />
                        </x.PackStart>
                        <x.PackEnd>
                            <GtkButton iconName="open-menu-symbolic" />
                        </x.PackEnd>
                    </AdwHeaderBar>
                </GtkFrame>
            </AdwPreferencesGroup>

            <AdwPreferencesGroup
                title="x.PackStart / x.PackEnd"
                description="Pack children at start or end of containers"
            >
                <GtkFrame>
                    <AdwHeaderBar showTitle={false}>
                        <x.PackStart>
                            <GtkButton label="Start 1" />
                        </x.PackStart>
                        <x.PackStart>
                            <GtkButton label="Start 2" />
                        </x.PackStart>
                        <x.PackEnd>
                            <GtkButton label="End 1" />
                        </x.PackEnd>
                        <x.PackEnd>
                            <GtkButton label="End 2" />
                        </x.PackEnd>
                    </AdwHeaderBar>
                </GtkFrame>
            </AdwPreferencesGroup>

            <AdwPreferencesGroup title="x.GridChild" description="Position children in a grid layout">
                <GtkFrame marginTop={12}>
                    <GtkGrid
                        rowSpacing={6}
                        columnSpacing={6}
                        marginTop={12}
                        marginBottom={12}
                        marginStart={12}
                        marginEnd={12}
                    >
                        <x.GridChild column={0} row={0}>
                            <GtkButton label="(0, 0)" hexpand />
                        </x.GridChild>
                        <x.GridChild column={1} row={0}>
                            <GtkButton label="(1, 0)" hexpand />
                        </x.GridChild>
                        <x.GridChild column={2} row={0}>
                            <GtkButton label="(2, 0)" hexpand />
                        </x.GridChild>
                        <x.GridChild column={0} row={1} columnSpan={2}>
                            <GtkButton label="Span 2 columns" hexpand />
                        </x.GridChild>
                        <x.GridChild column={2} row={1} rowSpan={2}>
                            <GtkButton label="Span 2 rows" vexpand />
                        </x.GridChild>
                        <x.GridChild column={0} row={2}>
                            <GtkButton label="(0, 2)" hexpand />
                        </x.GridChild>
                        <x.GridChild column={1} row={2}>
                            <GtkButton label="(1, 2)" hexpand />
                        </x.GridChild>
                    </GtkGrid>
                </GtkFrame>
            </AdwPreferencesGroup>

            <AdwPreferencesGroup title="x.FixedChild" description="Absolute positioning of children">
                <GtkFrame marginTop={12}>
                    <GtkFixed heightRequest={200}>
                        <x.FixedChild x={20} y={20}>
                            <GtkButton label="x=20, y=20" />
                        </x.FixedChild>
                        <x.FixedChild x={150} y={50}>
                            <GtkButton label="x=150, y=50" />
                        </x.FixedChild>
                        <x.FixedChild x={100} y={100}>
                            <GtkButton label="x=100, y=100" />
                        </x.FixedChild>
                    </GtkFixed>
                </GtkFrame>
            </AdwPreferencesGroup>

            <AdwPreferencesGroup title="x.Overlay / x.OverlayChild" description="Stack widgets on top of each other">
                <GtkFrame marginTop={12}>
                    <GtkOverlay>
                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={8}
                            halign={Gtk.Align.CENTER}
                            valign={Gtk.Align.CENTER}
                            heightRequest={200}
                        >
                            <GtkImage
                                iconName="folder-symbolic"
                                iconSize={Gtk.IconSize.LARGE}
                                cssClasses={["dim-label"]}
                            />
                            <GtkLabel label="Main Content" cssClasses={["dim-label"]} />
                        </GtkBox>
                        <x.OverlayChild>
                            <GtkLabel
                                label="Overlay Badge"
                                halign={Gtk.Align.END}
                                valign={Gtk.Align.START}
                                marginTop={8}
                                marginEnd={8}
                                cssClasses={["success"]}
                            />
                        </x.OverlayChild>
                        <x.OverlayChild>
                            <GtkButton
                                iconName="view-more-symbolic"
                                halign={Gtk.Align.END}
                                valign={Gtk.Align.END}
                                marginBottom={8}
                                marginEnd={8}
                                cssClasses={["circular"]}
                            />
                        </x.OverlayChild>
                    </GtkOverlay>
                </GtkFrame>
            </AdwPreferencesGroup>
        </GtkBox>
    );
};
