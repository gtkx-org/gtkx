import type * as Adw from "@gtkx/ffi/adw";
import * as Gtk from "@gtkx/ffi/gtk";
import {
    AdwActionRow,
    AdwApplicationWindow,
    AdwAvatar,
    AdwBanner,
    AdwButtonRow,
    AdwClamp,
    AdwEntryRow,
    AdwExpanderRow,
    AdwHeaderBar,
    AdwPasswordEntryRow,
    AdwPreferencesGroup,
    AdwPreferencesPage,
    AdwSpinner,
    AdwStatusPage,
    AdwSwitchRow,
    AdwToolbarView,
    AdwWindowTitle,
    GtkBox,
    GtkButton,
    GtkImage,
    GtkLabel,
    GtkListBox,
    GtkScrolledWindow,
    quit,
    Slot,
    Toolbar,
} from "@gtkx/react";
import { useState } from "react";

type EditableEntryRow = Adw.EntryRow & { getText(): string };

const PreferencesSection = () => {
    const [darkMode, setDarkMode] = useState(false);
    const [notifications, setNotifications] = useState(true);
    const [username, setUsername] = useState("");

    return (
        <GtkScrolledWindow vexpand hexpand>
            <AdwPreferencesPage title="Settings" iconName="preferences-system-symbolic">
                <AdwPreferencesGroup title="Appearance" description="Customize the look and feel">
                    <AdwSwitchRow
                        title="Dark Mode"
                        subtitle="Use dark color scheme"
                        active={darkMode}
                        onActivate={() => setDarkMode(!darkMode)}
                    />
                </AdwPreferencesGroup>

                <AdwPreferencesGroup title="Account" description="Manage your profile">
                    <AdwActionRow title="Profile Picture" subtitle="Set your avatar">
                        <Slot for={AdwActionRow} id="activatableWidget">
                            <AdwAvatar size={48} text={username || "User"} showInitials valign={Gtk.Align.CENTER} />
                        </Slot>
                    </AdwActionRow>
                    <AdwEntryRow
                        title="Username"
                        text={username}
                        onChanged={(self) => setUsername((self as EditableEntryRow).getText())}
                    />
                    <AdwPasswordEntryRow title="Password" />
                </AdwPreferencesGroup>

                <AdwPreferencesGroup title="Notifications">
                    <AdwSwitchRow
                        title="Enable Notifications"
                        subtitle="Receive updates and alerts"
                        active={notifications}
                        onActivate={() => setNotifications(!notifications)}
                    />
                    <AdwExpanderRow title="Advanced Options" subtitle="Fine-tune notification behavior">
                        <AdwSwitchRow title="Sound" subtitle="Play notification sounds" active />
                        <AdwSwitchRow title="Badges" subtitle="Show notification badges" active />
                        <AdwSwitchRow title="Lock Screen" subtitle="Show notifications on lock screen" active={false} />
                    </AdwExpanderRow>
                </AdwPreferencesGroup>
            </AdwPreferencesPage>
        </GtkScrolledWindow>
    );
};

const ListsSection = () => (
    <GtkScrolledWindow vexpand hexpand>
        <AdwClamp maximumSize={600} marginTop={24} marginBottom={24} marginStart={12} marginEnd={12}>
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
                <GtkListBox cssClasses={["boxed-list"]} selectionMode={Gtk.SelectionMode.NONE}>
                    <AdwActionRow title="Simple Action Row" subtitle="A basic row with title and subtitle">
                        <Slot for={AdwActionRow} id="activatableWidget">
                            <GtkImage iconName="go-next-symbolic" valign={Gtk.Align.CENTER} />
                        </Slot>
                    </AdwActionRow>

                    <AdwActionRow title="Row with Icon" subtitle="Includes a prefix icon">
                        <GtkImage iconName="starred-symbolic" valign={Gtk.Align.CENTER} cssClasses={["accent"]} />
                    </AdwActionRow>

                    <AdwButtonRow title="Button Row" startIconName="list-add-symbolic" />

                    <AdwActionRow title="With Badge" subtitle="Shows additional info">
                        <GtkLabel label="3" cssClasses={["accent", "badge"]} valign={Gtk.Align.CENTER} />
                    </AdwActionRow>
                </GtkListBox>

                <GtkListBox cssClasses={["boxed-list"]} selectionMode={Gtk.SelectionMode.NONE}>
                    <AdwExpanderRow title="Expandable Section" subtitle="Click to expand" iconName="folder-symbolic">
                        <AdwActionRow title="Child Item 1" />
                        <AdwActionRow title="Child Item 2" />
                        <AdwActionRow title="Child Item 3" />
                    </AdwExpanderRow>
                </GtkListBox>
            </GtkBox>
        </AdwClamp>
    </GtkScrolledWindow>
);

const WidgetsSection = () => {
    const [loading, setLoading] = useState(false);

    return (
        <GtkScrolledWindow vexpand hexpand>
            <AdwClamp maximumSize={600} marginTop={24} marginBottom={24} marginStart={12} marginEnd={12}>
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
                    <AdwPreferencesGroup title="Avatars" description="User representation">
                        <GtkBox
                            orientation={Gtk.Orientation.HORIZONTAL}
                            spacing={12}
                            halign={Gtk.Align.CENTER}
                            marginTop={12}
                            marginBottom={12}
                        >
                            <AdwAvatar size={32} text="Small" showInitials />
                            <AdwAvatar size={48} text="Medium" showInitials />
                            <AdwAvatar size={64} text="Large" showInitials />
                            <AdwAvatar size={80} text="XL" showInitials />
                        </GtkBox>
                    </AdwPreferencesGroup>

                    <AdwPreferencesGroup title="Loading States" description="Spinners and progress">
                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={16}
                            halign={Gtk.Align.CENTER}
                            marginTop={12}
                            marginBottom={12}
                        >
                            {loading && <AdwSpinner widthRequest={48} heightRequest={48} />}

                            <GtkButton
                                label={loading ? "Stop Loading" : "Start Loading"}
                                cssClasses={["pill"]}
                                onClicked={() => setLoading(!loading)}
                            />
                        </GtkBox>
                    </AdwPreferencesGroup>

                    <AdwPreferencesGroup title="Buttons" description="Various button styles">
                        <GtkBox
                            orientation={Gtk.Orientation.HORIZONTAL}
                            spacing={12}
                            halign={Gtk.Align.CENTER}
                            marginTop={12}
                            marginBottom={12}
                            homogeneous
                        >
                            <GtkButton label="Default" />
                            <GtkButton label="Suggested" cssClasses={["suggested-action"]} />
                            <GtkButton label="Destructive" cssClasses={["destructive-action"]} />
                        </GtkBox>
                        <GtkBox
                            orientation={Gtk.Orientation.HORIZONTAL}
                            spacing={12}
                            halign={Gtk.Align.CENTER}
                            marginBottom={12}
                            homogeneous
                        >
                            <GtkButton label="Pill" cssClasses={["pill"]} />
                            <GtkButton label="Flat" cssClasses={["flat"]} />
                            <GtkButton label="Circular" cssClasses={["circular"]} iconName="list-add-symbolic" />
                        </GtkBox>
                    </AdwPreferencesGroup>
                </GtkBox>
            </AdwClamp>
        </GtkScrolledWindow>
    );
};

type Page = "welcome" | "preferences" | "lists" | "widgets";

const App = () => {
    const [showBanner, setShowBanner] = useState(true);
    const [currentPage, setCurrentPage] = useState<Page>("welcome");

    const renderContent = () => {
        switch (currentPage) {
            case "welcome":
                return (
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0} vexpand>
                        <AdwBanner
                            title="Welcome to the Adwaita Demo!"
                            buttonLabel="Dismiss"
                            revealed={showBanner}
                            onButtonClicked={() => setShowBanner(false)}
                        />
                        <AdwStatusPage
                            iconName="applications-system-symbolic"
                            title="Adwaita Widgets"
                            description="This demo showcases common libadwaita widgets and patterns available in GTKX."
                            vexpand
                        >
                            <AdwClamp maximumSize={400}>
                                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                                    <GtkLabel
                                        label="Explore the different pages using the buttons below."
                                        wrap
                                        justify={Gtk.Justification.CENTER}
                                    />
                                    <GtkButton
                                        label="Show Banner Again"
                                        cssClasses={["suggested-action", "pill"]}
                                        halign={Gtk.Align.CENTER}
                                        onClicked={() => setShowBanner(true)}
                                    />
                                </GtkBox>
                            </AdwClamp>
                        </AdwStatusPage>
                    </GtkBox>
                );
            case "preferences":
                return <PreferencesSection />;
            case "lists":
                return <ListsSection />;
            case "widgets":
                return <WidgetsSection />;
        }
    };

    return (
        <AdwApplicationWindow title="Adwaita Demo" defaultWidth={900} defaultHeight={700} onCloseRequest={quit}>
            <Slot for={AdwApplicationWindow} id="content">
                <AdwToolbarView>
                    <Toolbar.Top>
                        <AdwHeaderBar>
                            <GtkButton
                                iconName="go-home-symbolic"
                                cssClasses={currentPage === "welcome" ? ["suggested-action"] : ["flat"]}
                                onClicked={() => setCurrentPage("welcome")}
                            />
                            <Slot for={AdwHeaderBar} id="titleWidget">
                                <AdwWindowTitle title="Adwaita Demo" subtitle="GTKX Widgets Showcase" />
                            </Slot>
                        </AdwHeaderBar>
                    </Toolbar.Top>
                    {renderContent()}
                    <Toolbar.Bottom>
                        <GtkBox
                            orientation={Gtk.Orientation.HORIZONTAL}
                            spacing={0}
                            homogeneous
                            cssClasses={["toolbar"]}
                        >
                            <GtkButton
                                label="Welcome"
                                iconName="go-home-symbolic"
                                cssClasses={currentPage === "welcome" ? ["flat", "suggested-action"] : ["flat"]}
                                onClicked={() => setCurrentPage("welcome")}
                            />
                            <GtkButton
                                label="Preferences"
                                iconName="emblem-system-symbolic"
                                cssClasses={currentPage === "preferences" ? ["flat", "suggested-action"] : ["flat"]}
                                onClicked={() => setCurrentPage("preferences")}
                            />
                            <GtkButton
                                label="Lists"
                                iconName="view-list-symbolic"
                                cssClasses={currentPage === "lists" ? ["flat", "suggested-action"] : ["flat"]}
                                onClicked={() => setCurrentPage("lists")}
                            />
                            <GtkButton
                                label="Widgets"
                                iconName="applications-graphics-symbolic"
                                cssClasses={currentPage === "widgets" ? ["flat", "suggested-action"] : ["flat"]}
                                onClicked={() => setCurrentPage("widgets")}
                            />
                        </GtkBox>
                    </Toolbar.Bottom>
                </AdwToolbarView>
            </Slot>
        </AdwApplicationWindow>
    );
};

export { App };

export default App;

export const appId = "org.gtkx.AdwaitaDemo";
