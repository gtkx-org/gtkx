import * as Gtk from "@gtkx/ffi/gtk";
import {
    AdwActionRow,
    AdwHeaderBar,
    AdwNavigationSplitView,
    AdwNavigationView,
    AdwPreferencesGroup,
    AdwToolbarView,
    GtkBox,
    GtkButton,
    GtkFrame,
    GtkImage,
    GtkLabel,
    GtkListBox,
    GtkNotebook,
    GtkScrolledWindow,
    GtkStack,
    GtkStackSwitcher,
    x,
} from "@gtkx/react";
import { useCallback, useState } from "react";

interface SplitViewItem {
    id: string;
    title: string;
    icon: string;
    count: number;
}

const defaultSplitViewItem: SplitViewItem = { id: "inbox", title: "Inbox", icon: "mail-unread-symbolic", count: 12 };

const splitViewItems: SplitViewItem[] = [
    defaultSplitViewItem,
    { id: "starred", title: "Starred", icon: "starred-symbolic", count: 3 },
    { id: "sent", title: "Sent", icon: "mail-send-symbolic", count: 0 },
    { id: "drafts", title: "Drafts", icon: "document-edit-symbolic", count: 2 },
];

export const NavigationDemo = () => {
    const [stackPage, setStackPage] = useState("page1");
    const [stack, setStack] = useState<Gtk.Stack>();
    const [history, setHistory] = useState(["home"]);
    const [selectedItem, setSelectedItem] = useState(defaultSplitViewItem);

    const handleStackRef = useCallback((instance: Gtk.Stack | null) => {
        setStack(instance ?? undefined);
    }, []);

    const handleHistoryChanged = useCallback((newHistory: string[]) => {
        setHistory(newHistory);
    }, []);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={24}
            marginTop={24}
            marginBottom={24}
            marginStart={24}
            marginEnd={24}
        >
            <GtkLabel label="Navigation Components" cssClasses={["title-1"]} halign={Gtk.Align.START} />

            <AdwPreferencesGroup title="x.StackPage" description="Named pages within a GtkStack or AdwViewStack">
                <GtkFrame marginTop={12}>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                        <GtkStackSwitcher stack={stack} halign={Gtk.Align.CENTER} marginTop={12} />
                        <GtkStack ref={handleStackRef} page={stackPage} heightRequest={150}>
                            <x.StackPage id="page1" title="Home" iconName="go-home-symbolic">
                                <GtkBox
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={12}
                                    halign={Gtk.Align.CENTER}
                                    valign={Gtk.Align.CENTER}
                                >
                                    <GtkImage iconName="go-home-symbolic" iconSize={Gtk.IconSize.LARGE} />
                                    <GtkLabel label="Welcome to the Home page" />
                                </GtkBox>
                            </x.StackPage>
                            <x.StackPage id="page2" title="Documents" iconName="folder-documents-symbolic">
                                <GtkBox
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={12}
                                    halign={Gtk.Align.CENTER}
                                    valign={Gtk.Align.CENTER}
                                >
                                    <GtkImage iconName="folder-documents-symbolic" iconSize={Gtk.IconSize.LARGE} />
                                    <GtkLabel label="Your documents appear here" />
                                </GtkBox>
                            </x.StackPage>
                            <x.StackPage id="page3" title="Settings" iconName="emblem-system-symbolic">
                                <GtkBox
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={12}
                                    halign={Gtk.Align.CENTER}
                                    valign={Gtk.Align.CENTER}
                                >
                                    <GtkImage iconName="emblem-system-symbolic" iconSize={Gtk.IconSize.LARGE} />
                                    <GtkLabel label="Application settings" />
                                </GtkBox>
                            </x.StackPage>
                        </GtkStack>
                        <GtkBox spacing={6} halign={Gtk.Align.CENTER} marginBottom={12}>
                            <GtkButton
                                label="Home"
                                onClicked={() => setStackPage("page1")}
                                cssClasses={stackPage === "page1" ? ["suggested-action"] : []}
                            />
                            <GtkButton
                                label="Documents"
                                onClicked={() => setStackPage("page2")}
                                cssClasses={stackPage === "page2" ? ["suggested-action"] : []}
                            />
                            <GtkButton
                                label="Settings"
                                onClicked={() => setStackPage("page3")}
                                cssClasses={stackPage === "page3" ? ["suggested-action"] : []}
                            />
                        </GtkBox>
                    </GtkBox>
                </GtkFrame>
            </AdwPreferencesGroup>

            <AdwPreferencesGroup
                title="x.NavigationPage + history"
                description="Declarative navigation with React-controlled history and onHistoryChanged for back gestures"
            >
                <GtkFrame marginTop={12}>
                    <AdwNavigationView history={history} onHistoryChanged={handleHistoryChanged} heightRequest={280}>
                        <x.NavigationPage for={AdwNavigationView} id="home" title="Home">
                            <AdwToolbarView>
                                <x.ToolbarTop>
                                    <AdwHeaderBar />
                                </x.ToolbarTop>
                                <GtkBox
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={12}
                                    halign={Gtk.Align.CENTER}
                                    valign={Gtk.Align.CENTER}
                                >
                                    <GtkImage iconName="go-home-symbolic" iconSize={Gtk.IconSize.LARGE} />
                                    <GtkLabel label="Home Page" cssClasses={["title-3"]} />
                                    <GtkButton
                                        label="Go to Details →"
                                        onClicked={() => setHistory([...history, "details"])}
                                        cssClasses={["suggested-action", "pill"]}
                                    />
                                </GtkBox>
                            </AdwToolbarView>
                        </x.NavigationPage>
                        <x.NavigationPage for={AdwNavigationView} id="details" title="Details">
                            <AdwToolbarView>
                                <x.ToolbarTop>
                                    <AdwHeaderBar />
                                </x.ToolbarTop>
                                <GtkBox
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={12}
                                    halign={Gtk.Align.CENTER}
                                    valign={Gtk.Align.CENTER}
                                >
                                    <GtkImage iconName="emblem-documents-symbolic" iconSize={Gtk.IconSize.LARGE} />
                                    <GtkLabel label="Details Page" cssClasses={["title-3"]} />
                                    <GtkBox spacing={6}>
                                        <GtkButton
                                            label="← Back"
                                            onClicked={() => setHistory(history.slice(0, -1))}
                                            sensitive={history.length > 1}
                                        />
                                        <GtkButton
                                            label="Go to Settings →"
                                            onClicked={() => setHistory([...history, "settings"])}
                                            cssClasses={["suggested-action", "pill"]}
                                        />
                                    </GtkBox>
                                </GtkBox>
                            </AdwToolbarView>
                        </x.NavigationPage>
                        <x.NavigationPage for={AdwNavigationView} id="settings" title="Settings">
                            <AdwToolbarView>
                                <x.ToolbarTop>
                                    <AdwHeaderBar />
                                </x.ToolbarTop>
                                <GtkBox
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={12}
                                    halign={Gtk.Align.CENTER}
                                    valign={Gtk.Align.CENTER}
                                >
                                    <GtkImage iconName="emblem-system-symbolic" iconSize={Gtk.IconSize.LARGE} />
                                    <GtkLabel label="Settings Page" cssClasses={["title-3"]} />
                                    <GtkButton
                                        label="← Back"
                                        onClicked={() => setHistory(history.slice(0, -1))}
                                        sensitive={history.length > 1}
                                    />
                                </GtkBox>
                            </AdwToolbarView>
                        </x.NavigationPage>
                    </AdwNavigationView>
                </GtkFrame>
                <GtkLabel
                    label={`History: [${history.map((h) => `"${h}"`).join(", ")}] (swipe right or click header back button to pop)`}
                    cssClasses={["dim-label", "monospace"]}
                    marginTop={8}
                />
            </AdwPreferencesGroup>

            <AdwPreferencesGroup
                title="x.NavigationPage + AdwNavigationSplitView"
                description="Sidebar/content split layout with declarative page slots"
            >
                <GtkFrame marginTop={12}>
                    <AdwNavigationSplitView sidebarWidthFraction={0.35} minSidebarWidth={200} maxSidebarWidth={300}>
                        <x.NavigationPage for={AdwNavigationSplitView} id="sidebar" title="Mail">
                            <AdwToolbarView>
                                <x.ToolbarTop>
                                    <AdwHeaderBar showTitle={false} />
                                </x.ToolbarTop>
                                <GtkScrolledWindow vexpand propagateNaturalHeight>
                                    <GtkListBox
                                        cssClasses={["navigation-sidebar"]}
                                        onRowSelected={(_, row) => {
                                            if (!row) return;
                                            const item = splitViewItems[row.getIndex()];
                                            if (item) setSelectedItem(item);
                                        }}
                                    >
                                        {splitViewItems.map((item) => (
                                            <AdwActionRow key={item.id} title={item.title} cssClasses={["activatable"]}>
                                                <x.ActionRowPrefix>
                                                    <GtkImage iconName={item.icon} />
                                                </x.ActionRowPrefix>
                                                {item.count > 0 && (
                                                    <x.ActionRowSuffix>
                                                        <GtkLabel
                                                            label={String(item.count)}
                                                            cssClasses={["dim-label"]}
                                                        />
                                                    </x.ActionRowSuffix>
                                                )}
                                            </AdwActionRow>
                                        ))}
                                    </GtkListBox>
                                </GtkScrolledWindow>
                            </AdwToolbarView>
                        </x.NavigationPage>

                        <x.NavigationPage for={AdwNavigationSplitView} id="content" title={selectedItem.title}>
                            <AdwToolbarView>
                                <x.ToolbarTop>
                                    <AdwHeaderBar />
                                </x.ToolbarTop>
                                <GtkBox
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={12}
                                    halign={Gtk.Align.CENTER}
                                    valign={Gtk.Align.CENTER}
                                    heightRequest={200}
                                >
                                    <GtkImage iconName={selectedItem.icon} iconSize={Gtk.IconSize.LARGE} />
                                    <GtkLabel label={selectedItem.title} cssClasses={["title-2"]} />
                                    <GtkLabel
                                        label={selectedItem.count > 0 ? `${selectedItem.count} items` : "No items"}
                                        cssClasses={["dim-label"]}
                                    />
                                </GtkBox>
                            </AdwToolbarView>
                        </x.NavigationPage>
                    </AdwNavigationSplitView>
                </GtkFrame>
                <GtkLabel
                    label={`Selected: "${selectedItem.id}" → content title updates to "${selectedItem.title}"`}
                    cssClasses={["dim-label", "monospace"]}
                    marginTop={8}
                />
            </AdwPreferencesGroup>

            <AdwPreferencesGroup title="x.NotebookPage" description="Tabbed pages with string labels">
                <GtkFrame marginTop={12}>
                    <GtkNotebook>
                        <x.NotebookPage label="General">
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={12}
                                halign={Gtk.Align.CENTER}
                                valign={Gtk.Align.CENTER}
                                heightRequest={120}
                            >
                                <GtkLabel label="General Settings" cssClasses={["title-3"]} />
                                <GtkLabel label="Configure basic application options" cssClasses={["dim-label"]} />
                            </GtkBox>
                        </x.NotebookPage>
                        <x.NotebookPage label="Appearance">
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={12}
                                halign={Gtk.Align.CENTER}
                                valign={Gtk.Align.CENTER}
                                heightRequest={120}
                            >
                                <GtkLabel label="Appearance Settings" cssClasses={["title-3"]} />
                                <GtkLabel label="Customize the look and feel" cssClasses={["dim-label"]} />
                            </GtkBox>
                        </x.NotebookPage>
                        <x.NotebookPage label="Advanced">
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={12}
                                halign={Gtk.Align.CENTER}
                                valign={Gtk.Align.CENTER}
                                heightRequest={120}
                            >
                                <GtkLabel label="Advanced Settings" cssClasses={["title-3"]} />
                                <GtkLabel label="Expert configuration options" cssClasses={["dim-label"]} />
                            </GtkBox>
                        </x.NotebookPage>
                    </GtkNotebook>
                </GtkFrame>
            </AdwPreferencesGroup>

            <AdwPreferencesGroup title="x.NotebookPageTab" description="Custom widget tabs for notebook pages">
                <GtkFrame marginTop={12}>
                    <GtkNotebook>
                        <x.NotebookPage>
                            <x.NotebookPageTab>
                                <GtkBox spacing={6}>
                                    <GtkImage iconName="mail-unread-symbolic" />
                                    <GtkLabel label="Inbox (3)" />
                                </GtkBox>
                            </x.NotebookPageTab>
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                halign={Gtk.Align.CENTER}
                                valign={Gtk.Align.CENTER}
                                heightRequest={100}
                            >
                                <GtkLabel label="3 unread messages" />
                            </GtkBox>
                        </x.NotebookPage>
                        <x.NotebookPage>
                            <x.NotebookPageTab>
                                <GtkBox spacing={6}>
                                    <GtkImage iconName="mail-send-symbolic" />
                                    <GtkLabel label="Sent" />
                                </GtkBox>
                            </x.NotebookPageTab>
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                halign={Gtk.Align.CENTER}
                                valign={Gtk.Align.CENTER}
                                heightRequest={100}
                            >
                                <GtkLabel label="Sent messages" />
                            </GtkBox>
                        </x.NotebookPage>
                        <x.NotebookPage>
                            <x.NotebookPageTab>
                                <GtkBox spacing={6}>
                                    <GtkImage iconName="user-trash-symbolic" />
                                    <GtkLabel label="Trash" />
                                </GtkBox>
                            </x.NotebookPageTab>
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                halign={Gtk.Align.CENTER}
                                valign={Gtk.Align.CENTER}
                                heightRequest={100}
                            >
                                <GtkLabel label="Deleted messages" />
                            </GtkBox>
                        </x.NotebookPage>
                    </GtkNotebook>
                </GtkFrame>
            </AdwPreferencesGroup>
        </GtkBox>
    );
};
