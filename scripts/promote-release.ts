import { checkReleaseChannel, promoteRelease } from "./release-channel.js";
import { releasePackageDirectories } from "./release-package-set.js";

const args = process.argv.slice(2);
const isCheckOnly = args[0] === "--check-only";
const directories = isCheckOnly ? args.slice(1) : args;
const selected = directories.length === 0 ? releasePackageDirectories() : directories;

if (isCheckOnly) {
    await checkReleaseChannel(selected);
} else {
    await promoteRelease(selected);
}
