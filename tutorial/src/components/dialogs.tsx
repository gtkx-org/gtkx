import { About } from "./about.js";
import { Preferences } from "./preferences.js";
import { RenameDialog } from "./rename-dialog.js";
import { Shortcuts } from "./shortcuts.js";

type Dialog =
    | { kind: "none" }
    | { kind: "about" }
    | { kind: "shortcuts" }
    | { kind: "preferences" }
    | { kind: "rename"; name: string };

type DialogsProps = {
    dialog: Dialog;
    onClose: () => void;
    onRename: (from: string, to: string) => void;
    onError: (error: unknown) => void;
};

const Dialogs = ({ dialog, onClose, onRename, onError }: DialogsProps) => {
    switch (dialog.kind) {
        case "about": {
            return <About onClose={onClose} />;
        }
        case "shortcuts": {
            return <Shortcuts onClose={onClose} />;
        }
        case "preferences": {
            return <Preferences onClose={onClose} onError={onError} />;
        }
        case "rename": {
            return <RenameDialog name={dialog.name} onRename={(to) => onRename(dialog.name, to)} onClose={onClose} />;
        }
        case "none": {
            return null;
        }
    }
};

export { type Dialog, Dialogs };
