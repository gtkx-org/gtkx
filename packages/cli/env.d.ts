/// <reference types="vite/client" />

declare module "*.css?url" {
    const path: string;
    export default path;
}

declare module "*.data" {
    const path: string;
    export default path;
}
