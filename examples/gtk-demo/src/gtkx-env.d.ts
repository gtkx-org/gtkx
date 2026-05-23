/// <reference types="vite/client" />

declare module "*.data" {
    const path: string;
    export default path;
}

declare module "*.gpa" {
    const path: string;
    export default path;
}
