import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkImage, GtkLabel, GtkNotebook, x } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./tabs.tsx?raw";

interface Tab {
    id: number;
    title: string;
    icon: string;
    content: string;
}

const TabsDemo = () => {
    const [currentPage, setCurrentPage] = useState(0);
    const [tabs, setTabs] = useState<Tab[]>([
        { id: 1, title: "Documents", icon: "folder-documents-symbolic", content: "Your documents are stored here." },
        { id: 2, title: "Downloads", icon: "folder-download-symbolic", content: "Downloaded files appear here." },
        { id: 3, title: "Pictures", icon: "folder-pictures-symbolic", content: "Image files and photos." },
    ]);
    const [nextId, setNextId] = useState(4);
    const [tabPosition, setTabPosition] = useState<Gtk.PositionType>(Gtk.PositionType.TOP);

    const addTab = () => {
        const newTab: Tab = {
            id: nextId,
            title: `Tab ${nextId}`,
            icon: "folder-symbolic",
            content: `This is the content for Tab ${nextId}.`,
        };
        setTabs([...tabs, newTab]);
        setNextId(nextId + 1);
        setCurrentPage(tabs.length);
    };

    const closeTab = (id: number) => {
        if (tabs.length <= 1) return;
        const index = tabs.findIndex((t) => t.id === id);
        setTabs(tabs.filter((t) => t.id !== id));
        if (currentPage >= tabs.length - 1) {
            setCurrentPage(Math.max(0, tabs.length - 2));
        } else if (currentPage > index) {
            setCurrentPage(currentPage - 1);
        }
    };

    const positions = [
        { type: Gtk.PositionType.TOP, label: "Top" },
        { type: Gtk.PositionType.BOTTOM, label: "Bottom" },
        { type: Gtk.PositionType.LEFT, label: "Left" },
        { type: Gtk.PositionType.RIGHT, label: "Right" },
    ];

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={20}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="Tabs" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="About GtkNotebook" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkNotebook provides a tabbed interface with built-in tab strip. Each tab can have a label and optional close button. Tabs can be positioned at any edge of the content area."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>

            <GtkFrame>
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkLabel label="Basic Tabbed Interface" cssClasses={["heading"]} halign={Gtk.Align.START} />
                    <GtkNotebook cssClasses={["card"]}>
                        <x.NotebookPage label="Overview">
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={8}
                                marginStart={16}
                                marginEnd={16}
                                marginTop={16}
                                marginBottom={16}
                            >
                                <GtkLabel label="Overview" cssClasses={["title-3"]} halign={Gtk.Align.START} />
                                <GtkLabel
                                    label="This is the overview tab. Click on other tabs to switch content."
                                    wrap
                                    cssClasses={["dim-label"]}
                                />
                            </GtkBox>
                        </x.NotebookPage>
                        <x.NotebookPage label="Details">
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={8}
                                marginStart={16}
                                marginEnd={16}
                                marginTop={16}
                                marginBottom={16}
                            >
                                <GtkLabel label="Details" cssClasses={["title-3"]} halign={Gtk.Align.START} />
                                <GtkLabel
                                    label="Detailed information goes here. Each tab maintains its own content."
                                    wrap
                                    cssClasses={["dim-label"]}
                                />
                            </GtkBox>
                        </x.NotebookPage>
                        <x.NotebookPage label="Actions">
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={8}
                                marginStart={16}
                                marginEnd={16}
                                marginTop={16}
                                marginBottom={16}
                            >
                                <GtkLabel label="Actions" cssClasses={["title-3"]} halign={Gtk.Align.START} />
                                <GtkBox spacing={8}>
                                    <GtkButton label="Save" cssClasses={["suggested-action"]} />
                                    <GtkButton label="Export" />
                                    <GtkButton label="Delete" cssClasses={["destructive-action"]} />
                                </GtkBox>
                            </GtkBox>
                        </x.NotebookPage>
                    </GtkNotebook>
                </GtkBox>
            </GtkFrame>

            <GtkFrame>
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkLabel label="Dynamic Tabs" cssClasses={["heading"]} halign={Gtk.Align.START} />
                    <GtkLabel
                        label="Add and remove tabs dynamically. The notebook updates automatically."
                        wrap
                        cssClasses={["dim-label"]}
                        halign={Gtk.Align.START}
                    />
                    <GtkBox spacing={8}>
                        <GtkButton label="Add Tab" onClicked={addTab} cssClasses={["suggested-action"]} />
                        <GtkLabel
                            label={`${tabs.length} tabs open`}
                            cssClasses={["dim-label"]}
                            valign={Gtk.Align.CENTER}
                        />
                    </GtkBox>
                    <GtkNotebook
                        page={currentPage}
                        onSwitchPage={(_self, _page, pageNum) => setCurrentPage(pageNum)}
                        tabPos={tabPosition}
                        scrollable
                        cssClasses={["card"]}
                        heightRequest={220}
                    >
                        {tabs.map((tab) => (
                            <x.NotebookPage key={tab.id} label={tab.title}>
                                <GtkBox
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={12}
                                    marginStart={16}
                                    marginEnd={16}
                                    marginTop={16}
                                    marginBottom={16}
                                >
                                    <GtkBox spacing={8}>
                                        <GtkImage iconName={tab.icon} pixelSize={24} />
                                        <GtkLabel label={tab.title} cssClasses={["title-3"]} />
                                    </GtkBox>
                                    <GtkLabel
                                        label={tab.content}
                                        wrap
                                        cssClasses={["dim-label"]}
                                        halign={Gtk.Align.START}
                                    />
                                    <GtkButton
                                        label="Close Tab"
                                        onClicked={() => closeTab(tab.id)}
                                        cssClasses={["destructive-action"]}
                                        halign={Gtk.Align.START}
                                        sensitive={tabs.length > 1}
                                    />
                                </GtkBox>
                            </x.NotebookPage>
                        ))}
                    </GtkNotebook>
                </GtkBox>
            </GtkFrame>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Tab Position" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Tabs can be positioned at any edge of the content area."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
                <GtkBox spacing={8} halign={Gtk.Align.CENTER}>
                    {positions.map((pos) => (
                        <GtkButton
                            key={pos.type}
                            label={pos.label}
                            onClicked={() => setTabPosition(pos.type)}
                            cssClasses={tabPosition === pos.type ? ["suggested-action"] : []}
                        />
                    ))}
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Controlled Navigation" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Navigate programmatically using the page prop and onSwitchPage callback."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
                <GtkBox spacing={8} halign={Gtk.Align.CENTER}>
                    <GtkButton
                        label="Previous"
                        onClicked={() => setCurrentPage(Math.max(0, currentPage - 1))}
                        sensitive={currentPage > 0}
                    />
                    <GtkLabel label={`Tab ${currentPage + 1} of ${tabs.length}`} cssClasses={["dim-label"]} />
                    <GtkButton
                        label="Next"
                        onClicked={() => setCurrentPage(Math.min(tabs.length - 1, currentPage + 1))}
                        sensitive={currentPage < tabs.length - 1}
                    />
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Key Properties" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="page: Current page index (0-based). tabPos: Position of tabs (TOP, BOTTOM, LEFT, RIGHT). scrollable: Allow tab scrolling when many tabs. : Show or hide tab strip. onSwitchPage: Callback when tab changes."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const tabsDemo: Demo = {
    id: "tabs",
    title: "Tabs",
    description: "Tabbed interface with GtkNotebook for organizing content.",
    keywords: ["tabs", "notebook", "pages", "tabbed", "navigation", "GtkNotebook", "x.NotebookPage"],
    component: TabsDemo,
    sourceCode,
};
