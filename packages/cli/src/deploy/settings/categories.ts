type CategoryMapping = {
    section: string;
    group: string;
};

const DEFAULT_MAPPING: CategoryMapping = { section: "misc", group: "Applications/System" };

const MAPPING_BY_CATEGORY: Record<string, CategoryMapping> = {
    Audio: { section: "sound", group: "Applications/Multimedia" },
    AudioVideo: { section: "sound", group: "Applications/Multimedia" },
    Development: { section: "devel", group: "Development/Tools" },
    Education: { section: "education", group: "Applications/Education" },
    Game: { section: "games", group: "Amusements/Games" },
    Graphics: { section: "graphics", group: "Applications/Multimedia" },
    Network: { section: "net", group: "Applications/Internet" },
    Office: { section: "gnome", group: "Applications/Productivity" },
    Science: { section: "science", group: "Applications/Engineering" },
    Settings: { section: "gnome", group: "Applications/System" },
    System: { section: "admin", group: "Applications/System" },
    Utility: { section: "utils", group: "Applications/Utilities" },
    Video: { section: "video", group: "Applications/Multimedia" },
};

const mappingForCategories = (categories: string[]): CategoryMapping => {
    for (const category of categories) {
        const mapping = MAPPING_BY_CATEGORY[category];

        if (mapping !== undefined) {
            return mapping;
        }
    }

    return DEFAULT_MAPPING;
};

const sectionForCategories = (categories: string[]): string => mappingForCategories(categories).section;
const groupForCategories = (categories: string[]): string => mappingForCategories(categories).group;

export { groupForCategories, sectionForCategories };
