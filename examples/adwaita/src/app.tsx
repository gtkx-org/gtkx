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
    Box,
    Button,
    Image,
    Label,
    ListBox,
    quit,
    ScrolledWindow,
} from "@gtkx/react";
import { useState } from "react";

type EditableEntryRow = Adw.EntryRow & { getText(): string };

const PreferencesSection = () => {
    const [darkMode, setDarkMode] = useState(false);
    const [notifications, setNotifications] = useState(true);
    const [username, setUsername] = useState("");

    return (
        <ScrolledWindow vexpand hexpand>
            <AdwPreferencesPage title="Settings" iconName="preferences-system-symbolic">
                <AdwPreferencesGroup.Root title="Appearance" description="Customize the look and feel">
                    <AdwSwitchRow
                        title="Dark Mode"
                        subtitle="Use dark color scheme"
                        active={darkMode}
                        onActivate={() => setDarkMode(!darkMode)}
                    />
                </AdwPreferencesGroup.Root>

                <AdwPreferencesGroup.Root title="Account" description="Manage your profile">
                    <AdwActionRow.Root title="Profile Picture" subtitle="Set your avatar">
                        <AdwActionRow.ActivatableWidget>
                            <AdwAvatar size={48} text={username || "User"} showInitials valign={Gtk.Align.CENTER} />
                        </AdwActionRow.ActivatableWidget>
                    </AdwActionRow.Root>
                    <AdwEntryRow
                        title="Username"
                        text={username}
                        onChanged={(self) => setUsername((self as EditableEntryRow).getText())}
                    />
                    <AdwPasswordEntryRow title="Password" />
                </AdwPreferencesGroup.Root>

                <AdwPreferencesGroup.Root title="Notifications">
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
                </AdwPreferencesGroup.Root>
            </AdwPreferencesPage>
        </ScrolledWindow>
    );
};

const ListsSection = () => (
    <ScrolledWindow vexpand hexpand>
        <AdwClamp maximumSize={600} marginTop={24} marginBottom={24} marginStart={12} marginEnd={12}>
            <Box orientation={Gtk.Orientation.VERTICAL} spacing={24}>
                <ListBox cssClasses={["boxed-list"]} selectionMode={Gtk.SelectionMode.NONE}>
                    <AdwActionRow.Root title="Simple Action Row" subtitle="A basic row with title and subtitle">
                        <AdwActionRow.ActivatableWidget>
                            <Image iconName="go-next-symbolic" valign={Gtk.Align.CENTER} />
                        </AdwActionRow.ActivatableWidget>
                    </AdwActionRow.Root>

                    <AdwActionRow.Root title="Row with Icon" subtitle="Includes a prefix icon">
                        <Image iconName="starred-symbolic" valign={Gtk.Align.CENTER} cssClasses={["accent"]} />
                    </AdwActionRow.Root>

                    <AdwButtonRow title="Button Row" startIconName="list-add-symbolic" />

                    <AdwActionRow.Root title="With Badge" subtitle="Shows additional info">
                        <Label label="3" cssClasses={["accent", "badge"]} valign={Gtk.Align.CENTER} />
                    </AdwActionRow.Root>
                </ListBox>

                <ListBox cssClasses={["boxed-list"]} selectionMode={Gtk.SelectionMode.NONE}>
                    <AdwExpanderRow title="Expandable Section" subtitle="Click to expand" iconName="folder-symbolic">
                        <AdwActionRow.Root title="Child Item 1" />
                        <AdwActionRow.Root title="Child Item 2" />
                        <AdwActionRow.Root title="Child Item 3" />
                    </AdwExpanderRow>
                </ListBox>
            </Box>
        </AdwClamp>
    </ScrolledWindow>
);

const WidgetsSection = () => {
    const [loading, setLoading] = useState(false);

    return (
        <ScrolledWindow vexpand hexpand>
            <AdwClamp maximumSize={600} marginTop={24} marginBottom={24} marginStart={12} marginEnd={12}>
                <Box orientation={Gtk.Orientation.VERTICAL} spacing={24}>
                    <AdwPreferencesGroup.Root title="Avatars" description="User representation">
                        <Box
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
                        </Box>
                    </AdwPreferencesGroup.Root>

                    <AdwPreferencesGroup.Root title="Loading States" description="Spinners and progress">
                        <Box
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={16}
                            halign={Gtk.Align.CENTER}
                            marginTop={12}
                            marginBottom={12}
                        >
                            {loading && <AdwSpinner widthRequest={48} heightRequest={48} />}

                            <Button
                                label={loading ? "Stop Loading" : "Start Loading"}
                                cssClasses={["pill"]}
                                onClicked={() => setLoading(!loading)}
                            />
                        </Box>
                    </AdwPreferencesGroup.Root>

                    <AdwPreferencesGroup.Root title="Buttons" description="Various button styles">
                        <Box
                            orientation={Gtk.Orientation.HORIZONTAL}
                            spacing={12}
                            halign={Gtk.Align.CENTER}
                            marginTop={12}
                            marginBottom={12}
                            homogeneous
                        >
                            <Button label="Default" />
                            <Button label="Suggested" cssClasses={["suggested-action"]} />
                            <Button label="Destructive" cssClasses={["destructive-action"]} />
                        </Box>
                        <Box
                            orientation={Gtk.Orientation.HORIZONTAL}
                            spacing={12}
                            halign={Gtk.Align.CENTER}
                            marginBottom={12}
                            homogeneous
                        >
                            <Button label="Pill" cssClasses={["pill"]} />
                            <Button label="Flat" cssClasses={["flat"]} />
                            <Button label="Circular" cssClasses={["circular"]} iconName="list-add-symbolic" />
                        </Box>
                    </AdwPreferencesGroup.Root>
                </Box>
            </AdwClamp>
        </ScrolledWindow>
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
                    <Box orientation={Gtk.Orientation.VERTICAL} spacing={0} vexpand>
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
                                <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                                    <Label
                                        label="Explore the different pages using the buttons below."
                                        wrap
                                        justify={Gtk.Justification.CENTER}
                                    />
                                    <Button
                                        label="Show Banner Again"
                                        cssClasses={["suggested-action", "pill"]}
                                        halign={Gtk.Align.CENTER}
                                        onClicked={() => setShowBanner(true)}
                                    />
                                </Box>
                            </AdwClamp>
                        </AdwStatusPage>
                    </Box>
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
        <AdwApplicationWindow.Root title="Adwaita Demo" defaultWidth={900} defaultHeight={700} onCloseRequest={quit}>
            <AdwApplicationWindow.Content>
                <AdwToolbarView.Root>
                    <AdwToolbarView.Top>
                        <AdwHeaderBar.Root>
                            <Button
                                iconName="go-home-symbolic"
                                cssClasses={currentPage === "welcome" ? ["suggested-action"] : ["flat"]}
                                onClicked={() => setCurrentPage("welcome")}
                            />
                            <AdwHeaderBar.TitleWidget>
                                <AdwWindowTitle title="Adwaita Demo" subtitle="GTKX Widgets Showcase" />
                            </AdwHeaderBar.TitleWidget>
                        </AdwHeaderBar.Root>
                    </AdwToolbarView.Top>
                    <AdwToolbarView.Content>{renderContent()}</AdwToolbarView.Content>
                    <AdwToolbarView.Bottom>
                        <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={0} homogeneous cssClasses={["toolbar"]}>
                            <Button
                                label="Welcome"
                                iconName="go-home-symbolic"
                                cssClasses={currentPage === "welcome" ? ["flat", "suggested-action"] : ["flat"]}
                                onClicked={() => setCurrentPage("welcome")}
                            />
                            <Button
                                label="Preferences"
                                iconName="emblem-system-symbolic"
                                cssClasses={currentPage === "preferences" ? ["flat", "suggested-action"] : ["flat"]}
                                onClicked={() => setCurrentPage("preferences")}
                            />
                            <Button
                                label="Lists"
                                iconName="view-list-symbolic"
                                cssClasses={currentPage === "lists" ? ["flat", "suggested-action"] : ["flat"]}
                                onClicked={() => setCurrentPage("lists")}
                            />
                            <Button
                                label="Widgets"
                                iconName="applications-graphics-symbolic"
                                cssClasses={currentPage === "widgets" ? ["flat", "suggested-action"] : ["flat"]}
                                onClicked={() => setCurrentPage("widgets")}
                            />
                        </Box>
                    </AdwToolbarView.Bottom>
                </AdwToolbarView.Root>
            </AdwApplicationWindow.Content>
        </AdwApplicationWindow.Root>
    );
};

export { App };

export default App;

export const appId = "org.gtkx.AdwaitaDemo";
