import { mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type NoteFile = [name: string, text: string];

const notes: NoteFile[] = [
    [
        "Recipes",
        "# Recipes\n\nWeeknight dinners that take under half an hour.\n",
    ],
    ["Book club", "# Book club\n\nNext up: *Piranesi* by Susanna Clarke.\n"],
    [
        "Trip to Lisbon",
        "# Trip to Lisbon\n\nTram 28 early, before the crowds.\n",
    ],
    [
        "Meeting notes",
        "# Meeting notes\n\nKickoff with design and docs, Tuesday 10:00.\n",
    ],
    [
        "Website relaunch",
        [
            "# Website relaunch",
            "",
            "Goals for the **new site**, agreed at the [kickoff](<Meeting notes.md>).",
            "",
            "## Milestones",
            "",
            "1. Content audit by *Friday*",
            "2. New landing page",
            "3. Launch on `docs.example.org`",
            "",
        ].join("\n"),
    ],
];

const seedNotes = (folder: string, files: NoteFile[] = notes): void => {
    if (!folder.startsWith(tmpdir())) {
        throw new Error(
            `Refusing to seed notes outside ${tmpdir()}: ${folder}`,
        );
    }
    rmSync(folder, { recursive: true, force: true });
    mkdirSync(folder, { recursive: true });
    files.forEach(([name, text], index) => {
        const path = join(folder, `${name}.md`);
        writeFileSync(path, text);
        const time = new Date(Date.UTC(2026, 10, 1 + index, 9));
        utimesSync(path, time, time);
    });
};

export { type NoteFile, seedNotes };
