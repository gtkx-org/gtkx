import { cleanupGtk } from "./setup.js";

export default async function globalSetup() {
    return async () => {
        cleanupGtk();
    };
}
