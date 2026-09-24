import type { RecordedPackage } from "../../internal/build-manifest.js";
import type { DeploySettings, DeployTargetName, NodeRuntime, NoticeSection } from "../types.js";
import { BUNDLE_FILENAME } from "../../vite-plugins/esm-extension.js";
import { BINDING_FILENAME } from "../native-addon.js";
import { bundledNotices } from "./bundled.js";
import { libraryNotices } from "./libraries.js";
import { nodeNotices, sdkNodeNotices } from "./node-runtime.js";

type NoticeRequest = {
    settings: DeploySettings;
    node: NodeRuntime | null;
    shouldIncludeNode: boolean;
    packages: RecordedPackage[];
};

const collectNotices = ({
    settings,
    node,
    packages,
    shouldIncludeNode,
}: NoticeRequest): Record<DeployTargetName, NoticeSection[]> => {
    const lib = `lib/${settings.binaryName}`;
    const platform = libraryNotices(settings);
    const common = [
        ...bundledNotices(`${lib}/${BUNDLE_FILENAME}`, `${lib}/${BINDING_FILENAME}`, packages),
        platform,
    ];
    const bundled = shouldIncludeNode ? [nodeNotices(settings, node), ...common] : common;

    return {
        appimage: bundled,
        deb: bundled,
        flatpak: settings.deploy.flatpak?.mode === "source" ? [sdkNodeNotices(settings), platform] : bundled,
        rpm: bundled,
    };
};

export { collectNotices };
