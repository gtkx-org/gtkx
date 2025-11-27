import * as Gtk from "@gtkx/ffi/gtk";
import {
    AboutDialog,
    ActionBar,
    ApplicationWindow,
    Box,
    Button,
    Calendar,
    CenterBox,
    CheckButton,
    ColorDialogButton,
    DropDown,
    EmojiChooser,
    Entry,
    Expander,
    FontDialogButton,
    Frame,
    Grid,
    HeaderBar,
    Label,
    LevelBar,
    LinkButton,
    ListBox,
    ListBoxRow,
    ListView,
    MenuButton,
    Notebook,
    Overlay,
    Paned,
    Popover,
    ProgressBar,
    quit,
    Revealer,
    render,
    Scale,
    ScrolledWindow,
    SearchBar,
    SearchEntry,
    Separator,
    SpinButton,
    Spinner,
    Switch,
    TextView,
    ToggleButton,
} from "@gtkx/gtkx";
import { useEffect, useMemo, useState } from "react";

const ButtonsSection = () => {
    const [clickCount, setClickCount] = useState(0);
    const [toggleActive, setToggleActive] = useState(false);
    const [selectedEmoji, setSelectedEmoji] = useState("😊");

    return (
        <Frame.Root>
            <Frame.LabelWidget>
                <Label.Root label="Buttons & Choosers" />
            </Frame.LabelWidget>
            <Frame.Child>
                <Box spacing={10} marginTop={10} marginBottom={10} marginStart={10} marginEnd={10}>
                    <Button
                        label={`Clicked ${clickCount} times`}
                        onClicked={() => setClickCount((c) => c + 1)}
                        tooltipText="Click me!"
                    />
                    <ToggleButton.Root
                        label={toggleActive ? "Toggle: ON" : "Toggle: OFF"}
                        active={toggleActive}
                        onToggled={() => setToggleActive((a) => !a)}
                    />
                    <LinkButton label="Open GTK4 docs" uri="https://www.gtk.org/docs/" />
                    <Box spacing={10}>
                        <ColorDialogButton />
                        <FontDialogButton />
                    </Box>
                    <Box spacing={10}>
                        <MenuButton.Root label={`Emoji: ${selectedEmoji}`}>
                            <MenuButton.Popover>
                                <EmojiChooser
                                    onEmojiPicked={(emoji: string) => {
                                        if (emoji) setSelectedEmoji(emoji);
                                    }}
                                />
                            </MenuButton.Popover>
                        </MenuButton.Root>
                    </Box>
                </Box>
            </Frame.Child>
        </Frame.Root>
    );
};

const InputsSection = () => {
    const [checked, setChecked] = useState(false);
    const [switchOn, setSwitchOn] = useState(true);
    const [selectedRadio, setSelectedRadio] = useState(0);
    const [spinValue, setSpinValue] = useState(50);

    const spinAdjustment = useMemo(() => new Gtk.Adjustment(50, 0, 100, 1, 10, 0), []);
    const scaleAdjustment = useMemo(() => new Gtk.Adjustment(50, 0, 100, 1, 10, 0), []);

    return (
        <Frame.Root>
            <Frame.LabelWidget>
                <Label.Root label="Inputs" />
            </Frame.LabelWidget>
            <Frame.Child>
                <Box spacing={10} marginTop={10} marginBottom={10} marginStart={10} marginEnd={10}>
                    <Box spacing={5}>
                        <Label.Root label="Entry:" />
                        <Entry placeholderText="Type something..." />
                    </Box>
                    <Box spacing={5}>
                        <Label.Root label="Search:" />
                        <SearchEntry placeholderText="Search..." />
                    </Box>
                    <CheckButton.Root
                        label={checked ? "Checked" : "Unchecked"}
                        active={checked}
                        onToggled={() => setChecked((c) => !c)}
                    />
                    <Separator />
                    <Label.Root label="Radio Buttons:" />
                    <CheckButton.Root
                        label="Option 1"
                        active={selectedRadio === 0}
                        onToggled={() => setSelectedRadio(0)}
                    />
                    <CheckButton.Root
                        label="Option 2"
                        active={selectedRadio === 1}
                        onToggled={() => setSelectedRadio(1)}
                    />
                    <CheckButton.Root
                        label="Option 3"
                        active={selectedRadio === 2}
                        onToggled={() => setSelectedRadio(2)}
                    />
                    <Separator />
                    <Box spacing={10}>
                        <Label.Root label="Switch:" />
                        <Switch
                            active={switchOn}
                            onStateSet={() => {
                                setSwitchOn((s) => !s);
                                return true;
                            }}
                        />
                        <Label.Root label={switchOn ? "ON" : "OFF"} />
                    </Box>
                    <Box spacing={10}>
                        <Label.Root label="SpinButton:" />
                        <SpinButton
                            adjustment={spinAdjustment.ptr}
                            onValueChanged={() => setSpinValue(Math.round(spinAdjustment.getValue()))}
                        />
                        <Label.Root label={`Value: ${spinValue}`} />
                    </Box>
                    <Box spacing={10} hexpand>
                        <Label.Root label="Scale:" />
                        <Scale hexpand drawValue adjustment={scaleAdjustment.ptr} />
                    </Box>
                </Box>
            </Frame.Child>
        </Frame.Root>
    );
};

const ProgressSection = () => {
    const [progress, setProgress] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const interval = setInterval(() => {
            setProgress((p) => (p >= 1 ? 0 : p + 0.01));
        }, 100);
        return () => clearInterval(interval);
    }, []);

    return (
        <Frame.Root>
            <Frame.LabelWidget>
                <Label.Root label="Progress Indicators" />
            </Frame.LabelWidget>
            <Frame.Child>
                <Box spacing={10} marginTop={10} marginBottom={10} marginStart={10} marginEnd={10}>
                    <Box spacing={5}>
                        <Label.Root label="ProgressBar:" />
                        <ProgressBar fraction={progress} showText hexpand />
                    </Box>
                    <Box spacing={5}>
                        <Label.Root label="LevelBar:" />
                        <LevelBar value={progress} hexpand />
                    </Box>
                    <Box spacing={10}>
                        <Button
                            label={loading ? "Stop Spinner" : "Start Spinner"}
                            onClicked={() => setLoading((l) => !l)}
                        />
                        <Spinner spinning={loading} />
                    </Box>
                </Box>
            </Frame.Child>
        </Frame.Root>
    );
};

const NotebookSection = () => (
    <Frame.Root vexpand>
        <Frame.LabelWidget>
            <Label.Root label="Notebook (Tabs)" />
        </Frame.LabelWidget>
        <Frame.Child>
            <Box marginTop={10} marginBottom={10} marginStart={10} marginEnd={10} vexpand>
                <Notebook hexpand vexpand>
                    <Box>
                        <Label.Root label="Tab 1 Content - You can add any widgets here" />
                    </Box>
                    <Box>
                        <Label.Root label="Tab 2 Content - Each tab is a separate page" />
                    </Box>
                    <Box>
                        <Label.Root label="Tab 3 Content - Navigate using the tabs above" />
                    </Box>
                </Notebook>
            </Box>
        </Frame.Child>
    </Frame.Root>
);

const ListBoxSection = () => (
    <Frame.Root>
        <Frame.LabelWidget>
            <Label.Root label="ListBox" />
        </Frame.LabelWidget>
        <Frame.Child>
            <Box marginTop={10} marginBottom={10} marginStart={10} marginEnd={10}>
                <ListBox hexpand selectionMode={Gtk.SelectionMode.SINGLE}>
                    <ListBoxRow>
                        <Box spacing={10} marginStart={10} marginEnd={10} marginTop={5} marginBottom={5}>
                            <Label.Root label="Row 1 - Click to select" />
                        </Box>
                    </ListBoxRow>
                    <ListBoxRow>
                        <Box spacing={10} marginStart={10} marginEnd={10} marginTop={5} marginBottom={5}>
                            <Label.Root label="Row 2 - Selectable row" />
                        </Box>
                    </ListBoxRow>
                    <ListBoxRow>
                        <Box spacing={10} marginStart={10} marginEnd={10} marginTop={5} marginBottom={5}>
                            <Label.Root label="Row 3 - Another row" />
                        </Box>
                    </ListBoxRow>
                </ListBox>
            </Box>
        </Frame.Child>
    </Frame.Root>
);

const PopoverSection = () => (
    <Frame.Root>
        <Frame.LabelWidget>
            <Label.Root label="Popover & MenuButton" />
        </Frame.LabelWidget>
        <Frame.Child>
            <Box spacing={10} marginTop={10} marginBottom={10} marginStart={10} marginEnd={10}>
                <MenuButton.Root label="Open Popover">
                    <MenuButton.Popover>
                        <Popover.Root>
                            <Popover.Child>
                                <Box spacing={10} marginTop={10} marginBottom={10} marginStart={10} marginEnd={10}>
                                    <Label.Root label="Popover Content!" />
                                    <Button label="Action 1" onClicked={() => {}} />
                                    <Button label="Action 2" onClicked={() => {}} />
                                </Box>
                            </Popover.Child>
                        </Popover.Root>
                    </MenuButton.Popover>
                </MenuButton.Root>
                <MenuButton.Root label="Menu Button">
                    <MenuButton.Popover>
                        <Popover.Root>
                            <Popover.Child>
                                <Box spacing={5} marginTop={10} marginBottom={10} marginStart={10} marginEnd={10}>
                                    <Button label="Menu Item 1" onClicked={() => {}} />
                                    <Button label="Menu Item 2" onClicked={() => {}} />
                                    <Separator />
                                    <Button label="Menu Item 3" onClicked={() => {}} />
                                </Box>
                            </Popover.Child>
                        </Popover.Root>
                    </MenuButton.Popover>
                </MenuButton.Root>
            </Box>
        </Frame.Child>
    </Frame.Root>
);

const RevealerSection = () => {
    const [revealed, setRevealed] = useState(false);

    return (
        <Frame.Root>
            <Frame.LabelWidget>
                <Label.Root label="Revealer & Expander" />
            </Frame.LabelWidget>
            <Frame.Child>
                <Box spacing={10} marginTop={10} marginBottom={10} marginStart={10} marginEnd={10}>
                    <Button
                        label={revealed ? "Hide Content" : "Show Content"}
                        onClicked={() => setRevealed((r) => !r)}
                    />
                    <Revealer revealChild={revealed} transitionType={Gtk.RevealerTransitionType.SLIDE_DOWN}>
                        <Label.Root label="This content was revealed!" cssClasses={["accent"]} />
                    </Revealer>
                    <Expander.Root label="Click to expand">
                        <Expander.Child>
                            <Box spacing={5}>
                                <Label.Root label="Hidden content inside expander" />
                                <Button label="A button inside" onClicked={() => {}} />
                            </Box>
                        </Expander.Child>
                    </Expander.Root>
                </Box>
            </Frame.Child>
        </Frame.Root>
    );
};

const OverlaySection = () => (
    <Frame.Root>
        <Frame.LabelWidget>
            <Label.Root label="Overlay" />
        </Frame.LabelWidget>
        <Frame.Child>
            <Box marginTop={10} marginBottom={10} marginStart={10} marginEnd={10}>
                <Overlay hexpand>
                    <Box hexpand vexpand cssClasses={["card"]}>
                        <Label.Root label="Base content (underneath)" hexpand vexpand />
                    </Box>
                    <Label.Root label="Overlay on top!" halign={Gtk.Align.END} valign={Gtk.Align.START} />
                </Overlay>
            </Box>
        </Frame.Child>
    </Frame.Root>
);

const CenterBoxSection = () => {
    const [counter, setCounter] = useState(0);

    return (
        <Frame.Root>
            <Frame.LabelWidget>
                <Label.Root label="CenterBox (Named Slots)" />
            </Frame.LabelWidget>
            <Frame.Child>
                <Box marginTop={10} marginBottom={10} marginStart={10} marginEnd={10}>
                    <CenterBox.Root hexpand>
                        <CenterBox.StartWidget>
                            <Button label="Left" onClicked={() => setCounter((c) => c - 1)} />
                        </CenterBox.StartWidget>
                        <CenterBox.CenterWidget>
                            <Label.Root label={`Count: ${counter}`} />
                        </CenterBox.CenterWidget>
                        <CenterBox.EndWidget>
                            <Button label="Right" onClicked={() => setCounter((c) => c + 1)} />
                        </CenterBox.EndWidget>
                    </CenterBox.Root>
                </Box>
            </Frame.Child>
        </Frame.Root>
    );
};

const ActionBarSection = () => {
    const [actionText, setActionText] = useState("Ready");

    return (
        <Frame.Root>
            <Frame.LabelWidget>
                <Label.Root label="ActionBar" />
            </Frame.LabelWidget>
            <Frame.Child>
                <Box marginTop={10} marginBottom={10} marginStart={10} marginEnd={10}>
                    <ActionBar revealed hexpand>
                        <Button label="Action 1" onClicked={() => setActionText("Action 1 clicked!")} />
                        <Button label="Action 2" onClicked={() => setActionText("Action 2 clicked!")} />
                    </ActionBar>
                    <Label.Root label={actionText} marginTop={10} />
                </Box>
            </Frame.Child>
        </Frame.Root>
    );
};

const PanedSection = () => (
    <Frame.Root vexpand>
        <Frame.LabelWidget>
            <Label.Root label="Paned (Resizable)" />
        </Frame.LabelWidget>
        <Frame.Child>
            <Box marginTop={10} marginBottom={10} marginStart={10} marginEnd={10} vexpand>
                <Paned.Root wideHandle vexpand>
                    <Paned.StartChild>
                        <Box hexpand vexpand cssClasses={["card"]} marginEnd={5}>
                            <Label.Root label="Left pane - drag the handle" hexpand vexpand />
                        </Box>
                    </Paned.StartChild>
                    <Paned.EndChild>
                        <Box hexpand vexpand cssClasses={["card"]} marginStart={5}>
                            <Label.Root label="Right pane" hexpand vexpand />
                        </Box>
                    </Paned.EndChild>
                </Paned.Root>
            </Box>
        </Frame.Child>
    </Frame.Root>
);

const SearchBarSection = () => {
    const [searchMode, setSearchMode] = useState(false);

    return (
        <Frame.Root>
            <Frame.LabelWidget>
                <Label.Root label="SearchBar" />
            </Frame.LabelWidget>
            <Frame.Child>
                <Box spacing={10} marginTop={10} marginBottom={10} marginStart={10} marginEnd={10}>
                    <Button
                        label={searchMode ? "Close Search" : "Open Search"}
                        onClicked={() => setSearchMode((s) => !s)}
                    />
                    <SearchBar.Root searchModeEnabled={searchMode} showCloseButton>
                        <SearchBar.Child>
                            <SearchEntry placeholderText="Type to search..." hexpand />
                        </SearchBar.Child>
                    </SearchBar.Root>
                    <Label.Root label={`Search mode: ${searchMode ? "enabled" : "disabled"}`} />
                </Box>
            </Frame.Child>
        </Frame.Root>
    );
};

const ListViewSection = () => {
    const [items, setItems] = useState([
        { id: 1, text: "Learn GTK4" },
        { id: 2, text: "Build React renderer" },
        { id: 3, text: "Create kitchen sink" },
        { id: 4, text: "Ship awesome apps" },
    ]);

    const addItem = () => {
        setItems((i) => [...i, { id: Date.now(), text: `New item ${i.length + 1}` }]);
    };

    const removeItem = () => {
        setItems((i) => i.slice(0, -1));
    };

    const renderItem = (item: { id: number; text: string } | null) => {
        const box = new Gtk.Box(Gtk.Orientation.HORIZONTAL, 0);
        const label = new Gtk.Label(item?.text ?? "");
        box.append(label);
        box.setMarginStart(10);
        box.setMarginEnd(10);
        box.setMarginTop(5);
        box.setMarginBottom(5);
        return box;
    };

    return (
        <Frame.Root vexpand>
            <Frame.LabelWidget>
                <Label.Root label="ListView with Dynamic Items" />
            </Frame.LabelWidget>
            <Frame.Child>
                <Box spacing={10} marginTop={10} marginBottom={10} marginStart={10} marginEnd={10} vexpand>
                    <Box spacing={5}>
                        <Button label="+ Add" onClicked={addItem} />
                        <Button label="- Remove" onClicked={removeItem} sensitive={items.length > 0} />
                        <Label.Root label={`Total: ${items.length}`} />
                    </Box>
                    <ScrolledWindow vexpand hexpand>
                        <ListView.Root vexpand renderItem={renderItem}>
                            {items.map((item) => (
                                <ListView.Item item={item} key={item.id} />
                            ))}
                        </ListView.Root>
                    </ScrolledWindow>
                </Box>
            </Frame.Child>
        </Frame.Root>
    );
};

const CalendarSection = () => (
    <Frame.Root>
        <Frame.LabelWidget>
            <Label.Root label="Calendar" />
        </Frame.LabelWidget>
        <Frame.Child>
            <Box spacing={10} marginTop={10} marginBottom={10} marginStart={10} marginEnd={10}>
                <Calendar showDayNames showHeading showWeekNumbers />
            </Box>
        </Frame.Child>
    </Frame.Root>
);

const TextViewSection = () => (
    <Frame.Root>
        <Frame.LabelWidget>
            <Label.Root label="TextView" />
        </Frame.LabelWidget>
        <Frame.Child>
            <Box marginTop={10} marginBottom={10} marginStart={10} marginEnd={10}>
                <ScrolledWindow hexpand heightRequest={100}>
                    <TextView hexpand vexpand editable wrapMode={Gtk.WrapMode.WORD} />
                </ScrolledWindow>
            </Box>
        </Frame.Child>
    </Frame.Root>
);

type DropDownOption = { id: number; label: string };

const dropdownOptions: DropDownOption[] = [
    { id: 1, label: "Option 1" },
    { id: 2, label: "Option 2" },
    { id: 3, label: "Option 3" },
    { id: 4, label: "Option 4" },
];

const DropDownSection = () => {
    const [selected, setSelected] = useState<DropDownOption | null>(null);

    return (
        <Frame.Root>
            <Frame.LabelWidget>
                <Label.Root label="DropDown" />
            </Frame.LabelWidget>
            <Frame.Child>
                <Box spacing={10} marginTop={10} marginBottom={10} marginStart={10} marginEnd={10}>
                    <Label.Root label="Select an option:" />
                    <DropDown.Root
                        hexpand
                        itemLabel={(item: DropDownOption) => item.label}
                        onSelectionChanged={(item: DropDownOption) => setSelected(item)}
                    >
                        {dropdownOptions.map((option) => (
                            <DropDown.Item key={option.id} item={option} />
                        ))}
                    </DropDown.Root>
                    <Label.Root label={`Selected: ${selected?.label ?? "None"}`} />
                </Box>
            </Frame.Child>
        </Frame.Root>
    );
};

const AboutDialogSection = () => {
    const [showAbout, setShowAbout] = useState(false);

    return (
        <Frame.Root>
            <Frame.LabelWidget>
                <Label.Root label="Dialogs" />
            </Frame.LabelWidget>
            <Frame.Child>
                <Box spacing={10} marginTop={10} marginBottom={10} marginStart={10} marginEnd={10}>
                    <Button label="Show About Dialog" onClicked={() => setShowAbout(true)} />
                    {showAbout && (
                        <AboutDialog
                            programName="GTKX Kitchen Sink"
                            version="1.0.0"
                            comments="A comprehensive demo of GTKX widgets"
                            copyright="Copyright 2024"
                            authors={["Author 1", "Author 2"]}
                            onCloseRequest={() => {
                                setShowAbout(false);
                                return false;
                            }}
                        />
                    )}
                </Box>
            </Frame.Child>
        </Frame.Root>
    );
};

const GridLayoutSection = () => (
    <Frame.Root>
        <Frame.LabelWidget>
            <Label.Root label="Grid Layout (2x2)" />
        </Frame.LabelWidget>
        <Frame.Child>
            <Box marginTop={10} marginBottom={10} marginStart={10} marginEnd={10}>
                <Grid.Root rowSpacing={10} columnSpacing={10} hexpand>
                    <Grid.Child column={0} row={0}>
                        <Button label="Top Left" hexpand />
                    </Grid.Child>
                    <Grid.Child column={1} row={0}>
                        <Button label="Top Right" hexpand />
                    </Grid.Child>
                    <Grid.Child column={0} row={1}>
                        <Button label="Bottom Left" hexpand />
                    </Grid.Child>
                    <Grid.Child column={1} row={1}>
                        <Button label="Bottom Right" hexpand />
                    </Grid.Child>
                    <Grid.Child column={0} row={2} columnSpan={2}>
                        <Button label="Full Width (spans 2 columns)" hexpand />
                    </Grid.Child>
                </Grid.Root>
            </Box>
        </Frame.Child>
    </Frame.Root>
);

export const App = () => (
    <ApplicationWindow title="GTKX Kitchen Sink" defaultWidth={1000} defaultHeight={800} onCloseRequest={quit}>
        <HeaderBar.Root>
            <HeaderBar.TitleWidget>
                <Label.Root label="GTKX Kitchen Sink" />
            </HeaderBar.TitleWidget>
        </HeaderBar.Root>
        <ScrolledWindow vexpand>
            <Box spacing={20} marginTop={20} marginBottom={20} marginStart={20} marginEnd={20}>
                Welcome to the GTKX Kitchen Sink! This demo showcases GTK4 widgets rendered through React.
                <Separator />
                <ButtonsSection />
                <InputsSection />
                <ProgressSection />
                <RevealerSection />
                <OverlaySection />
                <CenterBoxSection />
                <ActionBarSection />
                <PopoverSection />
                <SearchBarSection />
                <ListBoxSection />
                <DropDownSection />
                <TextViewSection />
                <CalendarSection />
                <AboutDialogSection />
                <GridLayoutSection />
                <NotebookSection />
                <PanedSection />
                <ListViewSection />
            </Box>
        </ScrolledWindow>
    </ApplicationWindow>
);

render(<App />, "com.gtkx.kitchen-sink");
