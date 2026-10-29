import * as Gtk from "@gtkx/gi/gtk";
import {
    AdwActionRow,
    AdwClamp,
    AdwHeaderBar,
    AdwPreferencesGroup,
    AdwStatusPage,
    AdwToggle,
    AdwToggleGroup,
    AdwToolbarView,
} from "@gtkx/jsx/adw";

export const TogglesPage = () => (
    <AdwToolbarView top={<AdwHeaderBar showTitle={false} />}>
        <AdwStatusPage
            iconName="widget-toggle-group-symbolic"
            title="Toggle Groups"
            description="A group of toggle buttons"
        >
            <AdwClamp maximumSize={400} tighteningThreshold={300}>
                <AdwPreferencesGroup>
                    <AdwActionRow
                        title="Group with Labels"
                        suffix={
                            <AdwToggleGroup valign={Gtk.Align.CENTER}>
                                <AdwToggle label="24-hour" name="24" />
                                <AdwToggle label="AM / PM" name="12" />
                            </AdwToggleGroup>
                        }
                    />
                    <AdwActionRow
                        title="Group with Icons"
                        suffix={
                            <AdwToggleGroup valign={Gtk.Align.CENTER}>
                                <AdwToggle iconName="view-grid-symbolic" tooltip="Grid View" name="grid" />
                                <AdwToggle iconName="view-list-symbolic" tooltip="List View" name="list" />
                                <AdwToggle iconName="view-dual-symbolic" tooltip="Dual View" name="columns" />
                            </AdwToggleGroup>
                        }
                    />
                    <AdwActionRow
                        title="Flat Group"
                        suffix={
                            <AdwToggleGroup valign={Gtk.Align.CENTER} cssClasses={["flat"]}>
                                <AdwToggle iconName="format-justify-left-symbolic" tooltip="Left Align" name="left" />
                                <AdwToggle
                                    iconName="format-justify-center-symbolic"
                                    tooltip="Center Align"
                                    name="center"
                                />
                                <AdwToggle
                                    iconName="format-justify-right-symbolic"
                                    tooltip="Right Align"
                                    name="right"
                                />
                                <AdwToggle iconName="format-justify-fill-symbolic" tooltip="Justify" name="fill" />
                            </AdwToggleGroup>
                        }
                    />
                    <AdwActionRow
                        title="Round Group"
                        suffix={
                            <AdwToggleGroup valign={Gtk.Align.CENTER} cssClasses={["round"]}>
                                <AdwToggle iconName="camera-photo-symbolic" tooltip="Picture Mode" name="picture" />
                                <AdwToggle iconName="camera-video-symbolic" tooltip="Recording Mode" name="recording" />
                            </AdwToggleGroup>
                        }
                    />
                </AdwPreferencesGroup>
            </AdwClamp>
        </AdwStatusPage>
    </AdwToolbarView>
);
