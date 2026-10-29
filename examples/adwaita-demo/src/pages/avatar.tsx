import * as Adw from "@gtkx/gi/adw";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import {
    AdwActionRow,
    AdwAvatar,
    AdwClamp,
    AdwEntryRow,
    AdwHeaderBar,
    AdwPreferencesGroup,
    AdwSpinRow,
    AdwSwitchRow,
    AdwToolbarView,
} from "@gtkx/jsx/adw";
import { GtkAdjustment, GtkBox, GtkButton, GtkImage, GtkLabel, GtkListBox, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { useParentWindow } from "@gtkx/react";
import { useEffect, useState } from "react";
import { useDemo } from "../context.js";

const firstNames = [
    "Adam",
    "Adrian",
    "Anna",
    "Charlotte",
    "Frédérique",
    "Ilaria",
    "Jakub",
    "Jennyfer",
    "Julia",
    "Justin",
    "Mario",
    "Miriam",
    "Mohamed",
    "Nourimane",
    "Owen",
    "Peter",
    "Petra",
    "Rachid",
    "Rebecca",
    "Sarah",
    "Thibault",
    "Wolfgang",
];
const lastNames = [
    "Bailey",
    "Berat",
    "Chen",
    "Farquharson",
    "Ferber",
    "Franco",
    "Galinier",
    "Han",
    "Lawrence",
    "Lepied",
    "Lopez",
    "Mariotti",
    "Rossi",
    "Urasawa",
    "Zwickelman",
];
const randomName = () =>
    `${firstNames[Math.floor(Math.random() * firstNames.length)] ?? "Anna"} ${lastNames[Math.floor(Math.random() * lastNames.length)] ?? "Chen"}`;

const isCancellation = (error: unknown) =>
    (error instanceof Gtk.DialogError &&
        (error.code === Gtk.DialogError.DISMISSED || error.code === Gtk.DialogError.CANCELLED)) ||
    (error instanceof Gio.IOErrorEnum && error.code === Gio.IOErrorEnum.CANCELLED);

const AvatarPage = () => {
    const window = useParentWindow();
    const { notify } = useDemo();
    const [avatar, setAvatar] = useState<Adw.Avatar | null>(null);
    const [text, setText] = useState(randomName);
    const [initials, setInitials] = useState(true);
    const [size, setSize] = useState(128);
    const [image, setImage] = useState<Gdk.Texture | null>(null);
    const [filename, setFilename] = useState("(None)");
    const [contacts] = useState(() => Array.from({ length: 30 }, (_, id) => ({ id, name: randomName() })));
    const [cancellable] = useState(() => new Gio.Cancellable());
    useEffect(() => () => cancellable.cancel(), [cancellable]);

    const openImage = async () => {
        const dialog = Gtk.FileDialog.new();
        dialog.setTitle("Select an Avatar");
        try {
            const file = await dialog.open(window, cancellable);
            if (cancellable.isCancelled()) {
                return;
            }
            const texture = Gdk.Texture.newFromFile(file);
            const info = file.queryInfo("standard::display-name", Gio.FileQueryInfoFlags.NONE, cancellable);
            setImage(texture);
            setFilename(info.getDisplayName());
        } catch (error) {
            if (!isCancellation(error)) {
                notify(`Unable to open avatar: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    };

    const saveImage = async () => {
        const dialog = Gtk.FileDialog.new();
        dialog.setTitle("Save Avatar");
        dialog.setInitialName("avatar.png");
        try {
            const file = await dialog.save(window, cancellable);
            if (cancellable.isCancelled() || !avatar) {
                return;
            }
            const path = file.getPath();
            if (!path) {
                notify("Choose a local file to save the avatar.");
                return;
            }
            if (!avatar.drawToTexture(avatar.getScaleFactor()).saveToPng(path)) {
                notify("Unable to save the avatar.");
            }
        } catch (error) {
            if (!isCancellation(error)) {
                notify(`Unable to save avatar: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    };

    return (
        <AdwToolbarView top={<AdwHeaderBar showTitle={false} />}>
            <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                <GtkBox orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.START} cssClasses={["avatar-page"]}>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                        <AdwAvatar
                            ref={setAvatar}
                            valign={Gtk.Align.CENTER}
                            size={size}
                            showInitials={initials}
                            text={text}
                            customImage={image}
                            marginBottom={36}
                        />
                        <GtkLabel
                            label="Avatar"
                            wrap
                            wrapMode={Pango.WrapMode.WORD_CHAR}
                            justify={Gtk.Justification.CENTER}
                            cssClasses={["title", "title-1"]}
                        />
                        <GtkLabel
                            label="A user avatar with generated fallback"
                            justify={Gtk.Justification.CENTER}
                            wrap
                            cssClasses={["body", "description"]}
                        />
                    </GtkBox>
                    <AdwClamp maximumSize={400} tighteningThreshold={300}>
                        <GtkBox valign={Gtk.Align.CENTER} orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                            <AdwPreferencesGroup>
                                <AdwEntryRow
                                    title="Text"
                                    text={text}
                                    onChanged={(entry) => setText(entry.getText())}
                                    inputPurpose={Gtk.InputPurpose.NAME}
                                    inputHints={Gtk.InputHints.NO_SPELLCHECK | Gtk.InputHints.UPPERCASE_WORDS}
                                />
                                <AdwSwitchRow
                                    title="Show Initials"
                                    active={initials}
                                    onNotifyActive={(value) => setInitials(value ?? false)}
                                />
                                <AdwActionRow
                                    title="File"
                                    suffix={
                                        <>
                                            <GtkButton
                                                valign={Gtk.Align.CENTER}
                                                accessibleLabel="Select an Avatar"
                                                onClicked={() => {
                                                    void openImage();
                                                }}
                                            >
                                                <GtkBox spacing={6}>
                                                    <GtkImage iconName="document-open-symbolic" />
                                                    <GtkLabel label={filename} ellipsize={Pango.EllipsizeMode.MIDDLE} />
                                                </GtkBox>
                                            </GtkButton>
                                            <GtkButton
                                                valign={Gtk.Align.CENTER}
                                                iconName="user-trash-symbolic"
                                                accessibleLabel="Remove avatar image"
                                                sensitive={image !== null}
                                                cssClasses={["flat"]}
                                                onClicked={() => {
                                                    setImage(null);
                                                    setFilename("(None)");
                                                }}
                                            />
                                        </>
                                    }
                                />
                                <AdwSpinRow
                                    title="Size"
                                    numeric
                                    value={size}
                                    onNotifyValue={(value) => setSize(value ?? 128)}
                                    adjustment={
                                        <GtkAdjustment
                                            lower={24}
                                            upper={320}
                                            value={128}
                                            pageIncrement={8}
                                            stepIncrement={8}
                                        />
                                    }
                                />
                                <AdwActionRow
                                    title="Export to File"
                                    suffix={
                                        <>
                                            <GtkButton
                                                valign={Gtk.Align.CENTER}
                                                iconName="document-save-symbolic"
                                                accessibleLabel="Save Avatar"
                                                cssClasses={["flat"]}
                                                onClicked={() => {
                                                    void saveImage();
                                                }}
                                            />
                                        </>
                                    }
                                />
                            </AdwPreferencesGroup>
                            <GtkListBox selectionMode={Gtk.SelectionMode.NONE} cssClasses={["boxed-list"]}>
                                {contacts.map((contact) => (
                                    <AdwActionRow
                                        key={contact.id}
                                        title={contact.name}
                                        prefix={
                                            <AdwAvatar
                                                size={40}
                                                text={contact.name}
                                                showInitials
                                                marginTop={12}
                                                marginBottom={12}
                                            />
                                        }
                                    />
                                ))}
                            </GtkListBox>
                        </GtkBox>
                    </AdwClamp>
                </GtkBox>
            </GtkScrolledWindow>
        </AdwToolbarView>
    );
};

export { AvatarPage };
