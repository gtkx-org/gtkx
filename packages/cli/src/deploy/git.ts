import { tryResolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";

const runGit = (root: string, args: string[]): string | null => {
    const git = tryResolveExecutable("git");

    if (git === undefined) {
        return null;
    }

    try {
        return execFileSync(git, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
        return null;
    }
};

const gitRemoteUrl = (root: string): string | null => runGit(root, ["remote", "get-url", "origin"]);

export { gitRemoteUrl, runGit };
