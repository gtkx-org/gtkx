import type { RecordedPackage } from "../../internal/build-manifest.js";
import type { NoticeSection } from "../types.js";
import { dependencyNotices } from "./dependencies.js";
import { gtkxNotices } from "./gtkx.js";

const bundledNotices = (bundleFile: string, addonFile: string, packages: RecordedPackage[]): NoticeSection[] => [
    gtkxNotices(bundleFile, addonFile, packages),
    dependencyNotices(bundleFile, packages),
].filter((section) => section.notices.length > 0);

export { bundledNotices };
