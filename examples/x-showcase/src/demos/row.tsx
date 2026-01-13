import * as Gtk from "@gtkx/ffi/gtk";
import {
    AdwActionRow,
    AdwExpanderRow,
    AdwPreferencesGroup,
    AdwToolbarView,
    GtkBox,
    GtkButton,
    GtkCheckButton,
    GtkFrame,
    GtkImage,
    GtkLabel,
    GtkSwitch,
    x,
} from "@gtkx/react";
import { useState } from "react";

export const RowDemo = () => {
    const [switchValue, setSwitchValue] = useState(false);
    const [checkValue, setCheckValue] = useState(true);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={24}
            marginTop={24}
            marginBottom={24}
            marginStart={24}
            marginEnd={24}
        >
            <GtkLabel label="Row Components" cssClasses={["title-1"]} halign={Gtk.Align.START} />

            <AdwPreferencesGroup
                title="x.ActionRowPrefix / x.ActionRowSuffix"
                description="Add widgets to the start or end of action rows"
            >
                <AdwActionRow title="Notifications" subtitle="Receive push notifications">
                    <x.ActionRowPrefix>
                        <GtkImage iconName="preferences-system-notifications-symbolic" />
                    </x.ActionRowPrefix>
                    <x.ActionRowSuffix>
                        <GtkSwitch
                            valign={Gtk.Align.CENTER}
                            active={switchValue}
                            onStateSet={(_, state) => {
                                setSwitchValue(state);
                                return true;
                            }}
                        />
                    </x.ActionRowSuffix>
                </AdwActionRow>

                <AdwActionRow title="Dark Mode" subtitle="Use dark color scheme">
                    <x.ActionRowPrefix>
                        <GtkImage iconName="weather-clear-night-symbolic" />
                    </x.ActionRowPrefix>
                    <x.ActionRowSuffix>
                        <GtkCheckButton active={checkValue} onToggled={(button) => setCheckValue(button.getActive())} />
                    </x.ActionRowSuffix>
                </AdwActionRow>

                <AdwActionRow title="Account" subtitle="Manage your account settings" activatable>
                    <x.ActionRowPrefix>
                        <GtkImage iconName="avatar-default-symbolic" />
                    </x.ActionRowPrefix>
                    <x.ActionRowSuffix>
                        <GtkImage iconName="go-next-symbolic" cssClasses={["dim-label"]} />
                    </x.ActionRowSuffix>
                </AdwActionRow>
            </AdwPreferencesGroup>

            <AdwPreferencesGroup title="x.ExpanderRowRow" description="Nested rows inside an expander row">
                <AdwExpanderRow title="Network Settings" subtitle="Configure network options">
                    <x.ActionRowPrefix>
                        <GtkImage iconName="network-wired-symbolic" />
                    </x.ActionRowPrefix>
                    <x.ExpanderRowRow>
                        <AdwActionRow title="WiFi">
                            <x.ActionRowSuffix>
                                <GtkSwitch valign={Gtk.Align.CENTER} active />
                            </x.ActionRowSuffix>
                        </AdwActionRow>
                        <AdwActionRow title="Bluetooth">
                            <x.ActionRowSuffix>
                                <GtkSwitch valign={Gtk.Align.CENTER} />
                            </x.ActionRowSuffix>
                        </AdwActionRow>
                        <AdwActionRow title="Airplane Mode">
                            <x.ActionRowSuffix>
                                <GtkSwitch valign={Gtk.Align.CENTER} />
                            </x.ActionRowSuffix>
                        </AdwActionRow>
                    </x.ExpanderRowRow>
                </AdwExpanderRow>

                <AdwExpanderRow title="Privacy" subtitle="Control your privacy settings">
                    <x.ActionRowPrefix>
                        <GtkImage iconName="channel-secure-symbolic" />
                    </x.ActionRowPrefix>
                    <x.ExpanderRowRow>
                        <AdwActionRow title="Location Services" activatable>
                            <x.ActionRowSuffix>
                                <GtkImage iconName="go-next-symbolic" cssClasses={["dim-label"]} />
                            </x.ActionRowSuffix>
                        </AdwActionRow>
                        <AdwActionRow title="Camera Access" activatable>
                            <x.ActionRowSuffix>
                                <GtkImage iconName="go-next-symbolic" cssClasses={["dim-label"]} />
                            </x.ActionRowSuffix>
                        </AdwActionRow>
                        <AdwActionRow title="Microphone Access" activatable>
                            <x.ActionRowSuffix>
                                <GtkImage iconName="go-next-symbolic" cssClasses={["dim-label"]} />
                            </x.ActionRowSuffix>
                        </AdwActionRow>
                    </x.ExpanderRowRow>
                </AdwExpanderRow>
            </AdwPreferencesGroup>

            <AdwPreferencesGroup title="x.ExpanderRowAction" description="Action widgets in the expander row header">
                <AdwExpanderRow title="Accounts" subtitle="Manage connected accounts">
                    <x.ActionRowPrefix>
                        <GtkImage iconName="system-users-symbolic" />
                    </x.ActionRowPrefix>
                    <x.ExpanderRowAction>
                        <GtkButton
                            iconName="list-add-symbolic"
                            valign={Gtk.Align.CENTER}
                            cssClasses={["flat"]}
                            tooltipText="Add Account"
                        />
                    </x.ExpanderRowAction>
                    <x.ExpanderRowRow>
                        <AdwActionRow title="Google" subtitle="alice@gmail.com">
                            <x.ActionRowPrefix>
                                <GtkImage iconName="mail-symbolic" />
                            </x.ActionRowPrefix>
                        </AdwActionRow>
                        <AdwActionRow title="GitHub" subtitle="alice-dev">
                            <x.ActionRowPrefix>
                                <GtkImage iconName="applications-development-symbolic" />
                            </x.ActionRowPrefix>
                        </AdwActionRow>
                    </x.ExpanderRowRow>
                </AdwExpanderRow>
            </AdwPreferencesGroup>

            <AdwPreferencesGroup
                title="x.ToolbarTop / x.ToolbarBottom"
                description="Place toolbars at top or bottom of AdwToolbarView"
            >
                <GtkFrame marginTop={12}>
                    <AdwToolbarView>
                        <x.ToolbarTop>
                            <GtkBox cssClasses={["toolbar"]} spacing={6}>
                                <GtkButton iconName="document-new-symbolic" tooltipText="New" />
                                <GtkButton iconName="document-open-symbolic" tooltipText="Open" />
                                <GtkButton iconName="document-save-symbolic" tooltipText="Save" />
                            </GtkBox>
                        </x.ToolbarTop>

                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            halign={Gtk.Align.CENTER}
                            valign={Gtk.Align.CENTER}
                            heightRequest={100}
                        >
                            <GtkLabel label="Content Area" cssClasses={["dim-label"]} />
                        </GtkBox>

                        <x.ToolbarBottom>
                            <GtkBox cssClasses={["toolbar"]} spacing={6}>
                                <GtkLabel label="Status: Ready" hexpand halign={Gtk.Align.START} marginStart={6} />
                                <GtkButton iconName="zoom-out-symbolic" tooltipText="Zoom Out" />
                                <GtkButton iconName="zoom-in-symbolic" tooltipText="Zoom In" />
                            </GtkBox>
                        </x.ToolbarBottom>
                    </AdwToolbarView>
                </GtkFrame>
            </AdwPreferencesGroup>
        </GtkBox>
    );
};
