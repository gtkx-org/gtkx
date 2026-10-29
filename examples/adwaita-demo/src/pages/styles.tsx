import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import {
    AdwActionRow,
    AdwBin,
    AdwBreakpoint,
    AdwDialog,
    AdwHeaderBar,
    AdwNavigationPage,
    AdwNavigationSplitView,
    AdwOverlaySplitView,
    AdwPreferencesGroup,
    AdwPreferencesPage,
    AdwStatusPage,
    AdwSwitchRow,
    AdwToggle,
    AdwToggleGroup,
    AdwToolbarView,
} from "@gtkx/jsx/adw";
import { GMenu, GSimpleAction, GSimpleActionGroup } from "@gtkx/jsx/gio";
import {
    GtkAdjustment,
    GtkBox,
    GtkButton,
    GtkCheckButton,
    GtkEntry,
    GtkFrame,
    GtkGrid,
    GtkGridLayoutChild,
    GtkImage,
    GtkLabel,
    GtkListBox,
    GtkMenuButton,
    GtkOverlay,
    GtkProgressBar,
    GtkScale,
    GtkScaleButton,
    GtkScrolledWindow,
    GtkSeparator,
    GtkToggleButton,
} from "@gtkx/jsx/gtk";
import { Fragment, useState } from "react";
import { useDemo } from "../context.js";

const galleryCondition = Adw.BreakpointCondition.parse("max-width: 550sp");
const statusCondition = Adw.BreakpointCondition.parse("max-width: 450sp");
const sidebarCondition = Adw.BreakpointCondition.parse("max-width: 400sp");

const ButtonStyles = ({ narrow }: { narrow: boolean }) => (
    <AdwPreferencesGroup
        title="Buttons"
        description={
            'The "flat", "suggested-action" and "destructive" style classes action can be used together with "pill" or "circular".\n\nThe "opaque" style class allows to create buttons with custom colors that look similar to "suggested-action".'
        }
    >
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6}>
            <GtkBox
                orientation={narrow ? Gtk.Orientation.VERTICAL : Gtk.Orientation.HORIZONTAL}
                spacing={6}
                homogeneous
            >
                <GtkBox spacing={6} homogeneous>
                    <GtkButton label="Regular" canShrink />
                    <GtkButton label="Flat" tooltipText="flat" canShrink cssClasses={["flat"]} />
                </GtkBox>
                <GtkBox spacing={6} homogeneous>
                    <GtkButton
                        label="Suggested"
                        tooltipText="suggested-action"
                        canShrink
                        cssClasses={["suggested-action"]}
                    />
                    <GtkButton
                        label="Destructive"
                        tooltipText="destructive-action"
                        canShrink
                        cssClasses={["destructive-action"]}
                    />
                </GtkBox>
            </GtkBox>
        </GtkBox>
        <GtkBox spacing={6} marginTop={12}>
            <GtkBox spacing={6} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} hexpand tooltipText="circular">
                <GtkButton
                    iconName="list-add-symbolic"
                    accessibleLabel="Add"
                    halign={Gtk.Align.CENTER}
                    valign={Gtk.Align.CENTER}
                    tooltipText="pill"
                    cssClasses={["circular"]}
                />
                <GtkButton label="A" tooltipText="circular" cssClasses={["circular"]} />
            </GtkBox>
            <GtkButton
                label="Pill Button"
                halign={Gtk.Align.CENTER}
                valign={Gtk.Align.CENTER}
                hexpand
                tooltipText="pill"
                canShrink
                cssClasses={["pill"]}
            />
            <GtkBox spacing={6} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} hexpand>
                <GtkButton
                    iconName="go-previous-symbolic"
                    accessibleLabel="Previous"
                    tooltipText="osd"
                    cssClasses={["osd"]}
                />
                <GtkButton iconName="go-next-symbolic" accessibleLabel="Next" tooltipText="osd" cssClasses={["osd"]} />
            </GtkBox>
        </GtkBox>
    </AdwPreferencesGroup>
);

const EntryStyles = ({ narrow }: { narrow: boolean }) => (
    <AdwPreferencesGroup title="Entries">
        <GtkBox spacing={6} orientation={Gtk.Orientation.VERTICAL}>
            {[
                ["Regular", "Success"],
                ["Warning", "Error"],
            ].map((labels, index) => (
                <GtkBox
                    key={index}
                    spacing={6}
                    homogeneous
                    hexpand
                    orientation={narrow ? Gtk.Orientation.VERTICAL : Gtk.Orientation.HORIZONTAL}
                >
                    {labels.map((label) => (
                        <GtkEntry
                            key={label}
                            placeholderText={label}
                            text={label}
                            secondaryIconName="edit-copy-symbolic"
                            tooltipText={label === "Regular" ? undefined : label.toLowerCase()}
                            cssClasses={label === "Regular" ? [] : [label.toLowerCase()]}
                        />
                    ))}
                </GtkBox>
            ))}
        </GtkBox>
    </AdwPreferencesGroup>
);

const ToggleStyles = ({ narrow }: { narrow: boolean }) => (
    <AdwPreferencesGroup
        title="Toggle Groups"
        description={'The "flat", "round" and "osd" style classes action can all be used together'}
    >
        <GtkBox spacing={6} homogeneous orientation={narrow ? Gtk.Orientation.VERTICAL : Gtk.Orientation.HORIZONTAL}>
            {["Flat", "Round", "OSD"].map((label) => (
                <AdwToggleGroup key={label} tooltipText={label.toLowerCase()} cssClasses={[label.toLowerCase()]}>
                    <AdwToggle label={label} />
                    <AdwToggle label={label} />
                </AdwToggleGroup>
            ))}
        </GtkBox>
    </AdwPreferencesGroup>
);

const LinkedStyles = () => {
    const [toggle, setToggle] = useState<Gtk.ToggleButton | null>(null);

    return (
        <AdwPreferencesGroup
            title="Linked Controls"
            description={
                'The "linked" style on GtkBox and similar containers allows to visually join related button-like and entry-like widgets'
            }
        >
            <GtkBox spacing={6}>
                <GtkBox tooltipText="linked" cssClasses={["linked"]}>
                    <GtkToggleButton ref={setToggle} iconName="view-grid-symbolic" accessibleLabel="Grid view" active />
                    <GtkToggleButton
                        iconName="view-list-symbolic"
                        accessibleLabel="List view"
                        group={toggle ?? undefined}
                    />
                </GtkBox>
                <GtkBox tooltipText="linked" cssClasses={["linked"]}>
                    <GtkEntry placeholderText="Entry" hexpand />
                    <GtkEntry placeholderText="Entry" hexpand />
                    <GtkButton label="Button" canShrink />
                </GtkBox>
            </GtkBox>
            <GtkBox spacing={6} marginTop={6}>
                <GtkBox orientation={Gtk.Orientation.VERTICAL} tooltipText="linked" cssClasses={["linked"]}>
                    <GtkButton iconName="edit-cut-symbolic" accessibleLabel="Cut" />
                    <GtkButton iconName="edit-copy-symbolic" accessibleLabel="Copy" />
                    <GtkButton iconName="edit-paste-symbolic" accessibleLabel="Paste" />
                </GtkBox>
                <GtkBox orientation={Gtk.Orientation.VERTICAL} hexpand tooltipText="linked" cssClasses={["linked"]}>
                    <GtkEntry placeholderText="Street" />
                    <GtkEntry placeholderText="City" />
                    <GtkEntry placeholderText="Province" />
                </GtkBox>
            </GtkBox>
        </AdwPreferencesGroup>
    );
};

const textStyles = [
    ["Title 1", "title-1"],
    ["Title 2", "title-2"],
    ["Title 3", "title-3"],
    ["Title 4", "title-4"],
    ["Monospace", "monospace"],
    ["Numeric (1234567890)", "numeric"],
    ["Accent", "accent"],
    ["Success", "success"],
    ["Warning", "warning"],
    ["Error", "error"],
] as const;

const StyledLabel = ({ label, styleClass }: { label: string; styleClass: string }) => (
    <GtkLabel
        label={label}
        xalign={0}
        ellipsize={Pango.EllipsizeMode.END}
        tooltipText={styleClass}
        cssClasses={[styleClass]}
    />
);

const StyledParagraph = ({
    label,
    styleClass,
    markup = false,
}: {
    label: string;
    styleClass: string;
    markup?: boolean;
}) => (
    <GtkLabel
        label={label}
        useMarkup={markup}
        xalign={0}
        wrap
        wrapMode={Pango.WrapMode.WORD_CHAR}
        maxWidthChars={25}
        tooltipText={styleClass}
        cssClasses={[styleClass]}
    />
);

const LabelStyles = ({ narrow }: { narrow: boolean }) => (
    <AdwPreferencesGroup title="Labels">
        <GtkBox spacing={narrow ? 12 : 18} orientation={narrow ? Gtk.Orientation.VERTICAL : Gtk.Orientation.HORIZONTAL}>
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12} hexpand>
                {textStyles.map(([label, styleClass]) => (
                    <StyledLabel key={styleClass} label={label} styleClass={styleClass} />
                ))}
            </GtkBox>
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12} hexpand>
                <StyledParagraph
                    label="This is a document paragraph. It should be used for the app's main content."
                    styleClass="document"
                    markup
                />
                <StyledLabel label="Heading" styleClass="heading" />
                <StyledParagraph
                    label="This is a paragraph of a body copy, to be used for medium-long text such as descriptions in the UI."
                    styleClass="body"
                    markup
                />
                <StyledLabel label="Caption Heading" styleClass="caption-heading" />
                <StyledParagraph
                    label="Caption body text, to be used for body copy on image captions and the like"
                    styleClass="caption"
                />
                <StyledParagraph
                    label="This is a dimmed paragraph, mostly used for secondary labels or descriptions."
                    styleClass="dimmed"
                />
            </GtkBox>
        </GtkBox>
    </AdwPreferencesGroup>
);

const CardStyles = () => (
    <AdwPreferencesGroup
        title="Cards and Boxed Lists"
        description={
            'The "boxed-list" style class can be used with GtkListBox to create boxed lists.\n\nThe "card" style class can be used to achieve the same style with GtkBox or similar containers, and with GtkButton. If used together with "activatable" style class, or on a GtkButton, the card will also have hover and press styles.'
        }
    >
        <GtkBox homogeneous heightRequest={100} marginBottom={12} spacing={12}>
            <AdwBin tooltipText="card" cssClasses={["card"]}>
                <GtkLabel label="Card" wrap wrapMode={Pango.WrapMode.WORD_CHAR} />
            </AdwBin>
            <AdwBin tooltipText="card, activatable" focusable cssClasses={["card", "activatable"]}>
                <GtkLabel label="Card (Activatable)" wrap wrapMode={Pango.WrapMode.WORD_CHAR} />
            </AdwBin>
            <GtkButton tooltipText="card" cssClasses={["card"]}>
                <GtkLabel label="Card (Button)" wrap wrapMode={Pango.WrapMode.WORD_CHAR} />
            </GtkButton>
        </GtkBox>
        <GtkListBox selectionMode={Gtk.SelectionMode.NONE} tooltipText="boxed-list" cssClasses={["boxed-list"]}>
            <AdwActionRow title="Row" />
            <AdwActionRow title="Row (Activatable)" activatable />
        </GtkListBox>
    </AdwPreferencesGroup>
);

const AppIconStyles = () => (
    <AdwPreferencesGroup
        title="App Icons"
        description={
            'The "icon-dropshadow" style class ensures legibility when displaying app icons. For 32x32 and smaller app icons, "lowres-icon" should be used instead.'
        }
    >
        <GtkGrid rowSpacing={6} columnSpacing={12}>
            {[128, 64, 32].map((size, column) => (
                <Fragment key={size}>
                    <GtkGridLayoutChild column={column} row={0}>
                        <GtkImage
                            iconName="org.gnome.Boxes"
                            pixelSize={size}
                            valign={Gtk.Align.END}
                            tooltipText={size > 32 ? "icon-dropshadow" : "lowres-icon"}
                            cssClasses={[size > 32 ? "icon-dropshadow" : "lowres-icon"]}
                        />
                    </GtkGridLayoutChild>
                    <GtkGridLayoutChild column={column} row={1}>
                        <GtkLabel label={String(size)} xalign={0.5} />
                    </GtkGridLayoutChild>
                </Fragment>
            ))}
        </GtkGrid>
    </AdwPreferencesGroup>
);

const CheckStyles = () => (
    <AdwPreferencesGroup
        title="Check Buttons"
        description={'The "selection-mode" style class can be used with GtkCheckButton to make them large and round'}
    >
        <GtkGrid rowSpacing={6} columnSpacing={12} halign={Gtk.Align.START}>
            {[false, true].map((selection, index) => (
                <Fragment key={String(selection)}>
                    {[true, false].map((active, offset) => (
                        <GtkGridLayoutChild key={String(active)} column={index * 2 + offset} row={0}>
                            <GtkCheckButton
                                halign={active ? Gtk.Align.END : Gtk.Align.START}
                                valign={Gtk.Align.END}
                                active={active}
                                accessibleLabel={selection ? "Selection mode check button" : "Regular check button"}
                                tooltipText={selection ? "selection-mode" : undefined}
                                cssClasses={selection ? ["selection-mode"] : []}
                            />
                        </GtkGridLayoutChild>
                    ))}
                    <GtkGridLayoutChild column={index * 2} row={1} columnSpan={2}>
                        <GtkLabel
                            label={selection ? "Selection Mode" : "Regular"}
                            xalign={0.5}
                            marginStart={12}
                            marginEnd={12}
                            wrap
                            wrapMode={Pango.WrapMode.WORD_CHAR}
                        />
                    </GtkGridLayoutChild>
                </Fragment>
            ))}
        </GtkGrid>
    </AdwPreferencesGroup>
);

const DemoMenu = () => (
    <GMenu items={[{ section: [1, 2, 3].map((index) => ({ label: `Item ${index}`, action: "style.dummy" })) }]} />
);

const ToolbarStyles = () => (
    <AdwPreferencesGroup
        title="Toolbars"
        description={
            'The "toolbar" style class on GtkBox and similar containers gives the same padding, spacing and button appearance as GtkHeaderBar and GtkActionBar have. A toolbar can additionally have the "osd" style class, useful for floating media controls.\n\nThe "raised" style class can be used to make a button inside a toolbar use default appearance instead.'
        }
    >
        <GtkFrame cssClasses={["toolbar-demo"]} marginBottom={12}>
            <GtkBox tooltipText="toolbar" cssClasses={["toolbar"]}>
                <GtkMenuButton label="Open" menuModel={<DemoMenu />} />
                <GtkButton iconName="tab-new-symbolic" accessibleLabel="New tab" />
                <GtkSeparator hexpand cssClasses={["spacer"]} />
                <GtkButton iconName="edit-undo-symbolic" accessibleLabel="Undo" />
                <GtkButton iconName="edit-redo-symbolic" accessibleLabel="Redo" />
                <GtkSeparator cssClasses={["spacer"]} />
                <GtkMenuButton iconName="view-more-symbolic" accessibleLabel="More" menuModel={<DemoMenu />} />
            </GtkBox>
        </GtkFrame>
        <GtkBox tooltipText="toolbar, osd" cssClasses={["toolbar", "osd"]}>
            <GtkButton iconName="media-skip-backward-symbolic" accessibleLabel="Previous track" />
            <GtkButton iconName="media-playback-pause-symbolic" accessibleLabel="Pause" />
            <GtkButton iconName="media-skip-forward-symbolic" accessibleLabel="Next track" />
            <GtkScale
                hexpand
                accessibleLabel="Playback position"
                adjustment={<GtkAdjustment lower={0} upper={100} value={50} />}
            />
            <GtkScaleButton
                accessibleLabel="Volume"
                icons={["audio-volume-muted", "audio-volume-high", "audio-volume-low", "audio-volume-medium"]}
            />
        </GtkBox>
    </AdwPreferencesGroup>
);

const BackgroundStyles = () => (
    <AdwPreferencesGroup
        title="Backgrounds"
        description="These style classes can be applied to any widgets that need the specific background and text color"
    >
        <GtkBox homogeneous heightRequest={100}>
            {["Background", "View", "OSD"].map((label) => (
                <AdwBin key={label} tooltipText={label.toLowerCase()} cssClasses={[label.toLowerCase()]}>
                    <GtkLabel label={label} wrap wrapMode={Pango.WrapMode.WORD_CHAR} />
                </AdwBin>
            ))}
        </GtkBox>
    </AdwPreferencesGroup>
);

const StatusStylesDialog = ({ onClose }: { onClose: () => void }) => {
    const [collapsed, setCollapsed] = useState(false);
    const [showSidebar, setShowSidebar] = useState(true);

    return (
        <AdwDialog
            title="Status Pages"
            contentWidth={640}
            contentHeight={480}
            widthRequest={360}
            heightRequest={200}
            onClosed={onClose}
            breakpoints={
                <AdwBreakpoint
                    condition={statusCondition}
                    onApply={() => setCollapsed(true)}
                    onUnapply={() => setCollapsed(false)}
                />
            }
        >
            <AdwToolbarView
                topBarStyle={Adw.ToolbarStyle.RAISED}
                top={
                    <AdwHeaderBar
                        start={
                            <GtkToggleButton
                                iconName="view-sidebar-start"
                                accessibleLabel="Toggle compact status page"
                                active={showSidebar}
                                onToggled={(button) => setShowSidebar(button.getActive())}
                            />
                        }
                    />
                }
            >
                <AdwOverlaySplitView
                    collapsed={collapsed}
                    showSidebar={showSidebar}
                    onNotifyShowSidebar={(value) => setShowSidebar(value ?? false)}
                    sidebar={
                        <AdwStatusPage
                            iconName="welcome-symbolic"
                            title="Compact"
                            description={'This status page has the "compact" style class'}
                            tooltipText="compact"
                            cssClasses={["compact"]}
                        >
                            <GtkButton label="Button" halign={Gtk.Align.CENTER} cssClasses={["pill"]} />
                        </AdwStatusPage>
                    }
                >
                    <AdwStatusPage
                        hexpand
                        iconName="welcome-symbolic"
                        title="Regular"
                        description="This is a regular status page"
                    >
                        <GtkButton label="Button" halign={Gtk.Align.CENTER} cssClasses={["pill"]} />
                    </AdwStatusPage>
                </AdwOverlaySplitView>
            </AdwToolbarView>
        </AdwDialog>
    );
};

const SidebarStylesDialog = ({ onClose }: { onClose: () => void }) => {
    const [collapsed, setCollapsed] = useState(false);
    const [showContent, setShowContent] = useState(false);

    return (
        <AdwDialog
            title="Sidebar"
            contentWidth={720}
            contentHeight={480}
            widthRequest={360}
            heightRequest={240}
            onClosed={onClose}
            breakpoints={
                <AdwBreakpoint
                    condition={sidebarCondition}
                    onApply={() => setCollapsed(true)}
                    onUnapply={() => setCollapsed(false)}
                />
            }
        >
            <AdwNavigationSplitView
                minSidebarWidth={140}
                maxSidebarWidth={240}
                collapsed={collapsed}
                showContent={showContent}
                onNotifyShowContent={(value) => setShowContent(value ?? false)}
                sidebar={
                    <AdwNavigationPage title="Sidebar">
                        <AdwToolbarView top={<AdwHeaderBar showTitle={false} />}>
                            <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                                <GtkListBox
                                    tooltipText="navigation-sidebar"
                                    selectionMode={collapsed ? Gtk.SelectionMode.NONE : Gtk.SelectionMode.BROWSE}
                                    onRowActivated={() => setShowContent(true)}
                                    cssClasses={["navigation-sidebar"]}
                                >
                                    {[1, 2, 3, 4, 5].map((index) => (
                                        <GtkLabel
                                            key={index}
                                            label={`Item ${index}`}
                                            ellipsize={Pango.EllipsizeMode.END}
                                            xalign={0}
                                        />
                                    ))}
                                </GtkListBox>
                            </GtkScrolledWindow>
                        </AdwToolbarView>
                    </AdwNavigationPage>
                }
            >
                <AdwNavigationPage title="Sidebar" tag="content">
                    <AdwToolbarView top={<AdwHeaderBar />}>
                        <AdwStatusPage
                            title="Sidebar"
                            description={'"navigation-sidebar" style class on GtkListBox or GtkListView'}
                        />
                    </AdwToolbarView>
                </AdwNavigationPage>
            </AdwNavigationSplitView>
        </AdwDialog>
    );
};

const StyleDemoDialog = ({ onClose }: { onClose: () => void }) => {
    const { devel, setDevel } = useDemo();
    const [narrow, setNarrow] = useState(false);
    const [progress, setProgress] = useState(false);
    const [dialog, setDialog] = useState<"status" | "sidebar" | null>(null);

    return (
        <AdwDialog
            title="Style Classes"
            contentWidth={800}
            widthRequest={360}
            heightRequest={150}
            onClosed={onClose}
            breakpoints={
                <AdwBreakpoint
                    condition={galleryCondition}
                    onApply={() => setNarrow(true)}
                    onUnapply={() => setNarrow(false)}
                />
            }
            actionGroups={
                <GSimpleActionGroup prefix="style" actions={<GSimpleAction name="dummy" onActivate={() => {}} />} />
            }
        >
            <AdwToolbarView top={<AdwHeaderBar />}>
                <GtkOverlay
                    overlay={
                        <GtkProgressBar
                            valign={Gtk.Align.START}
                            fraction={0.5}
                            tooltipText="osd"
                            visible={progress}
                            cssClasses={["osd"]}
                        />
                    }
                >
                    <AdwPreferencesPage
                        widthRequest={360}
                        description="Hover over widgets to see their exact style class names"
                    >
                        <ButtonStyles narrow={narrow} />
                        <EntryStyles narrow={narrow} />
                        <ToggleStyles narrow={narrow} />
                        <LinkedStyles />
                        <LabelStyles narrow={narrow} />
                        <CardStyles />
                        <AppIconStyles />
                        <CheckStyles />
                        <ToolbarStyles />
                        <BackgroundStyles />
                        <AdwPreferencesGroup title="Misc">
                            <AdwActionRow
                                title="Status Pages"
                                activatable
                                onActivated={() => setDialog("status")}
                                suffix={<GtkImage iconName="go-next-symbolic" cssClasses={["dimmed"]} />}
                            />
                            <AdwActionRow
                                title="Sidebar"
                                activatable
                                onActivated={() => setDialog("sidebar")}
                                suffix={<GtkImage iconName="go-next-symbolic" cssClasses={["dimmed"]} />}
                            />
                            <AdwSwitchRow
                                title="Development Window"
                                subtitle={'"devel" style class on GtkWindow'}
                                active={devel}
                                onNotifyActive={(value) => setDevel(value ?? false)}
                            />
                            <AdwSwitchRow
                                title="OSD Progress Bar"
                                subtitle={'"osd" style class on GtkProgressBar'}
                                active={progress}
                                onNotifyActive={(value) => setProgress(value ?? false)}
                            />
                        </AdwPreferencesGroup>
                    </AdwPreferencesPage>
                </GtkOverlay>
                {dialog === "status" && <StatusStylesDialog onClose={() => setDialog(null)} />}
                {dialog === "sidebar" && <SidebarStylesDialog onClose={() => setDialog(null)} />}
            </AdwToolbarView>
        </AdwDialog>
    );
};

export const StylesPage = () => {
    const [open, setOpen] = useState(false);

    return (
        <AdwToolbarView top={<AdwHeaderBar showTitle={false} />}>
            <AdwStatusPage
                iconName="style-classes-symbolic"
                title="Style Classes"
                description="Various widget styles available for use"
            >
                <GtkButton
                    label="Run the Demo"
                    halign={Gtk.Align.CENTER}
                    cssClasses={["pill"]}
                    onClicked={() => setOpen(true)}
                />
            </AdwStatusPage>
            {open && <StyleDemoDialog onClose={() => setOpen(false)} />}
        </AdwToolbarView>
    );
};
