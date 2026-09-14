export const COLOR_THEME_IDS = [
    'Dark 2026',
    'Dark Modern',
    'Dark+',
    'Visual Studio Dark',
    'Light 2026',
    'Light Modern',
    'Light+',
    'Visual Studio Light',
    'Default High Contrast',
    'Default High Contrast Light',
] as const;

export const FILE_ICON_THEME_IDS = ['vs-seti', 'vs-minimal'] as const;

export type ColorThemeId = (typeof COLOR_THEME_IDS)[number];
export type FileIconThemeId = (typeof FILE_ICON_THEME_IDS)[number] | null;

export type ThemePreferences = {
    colorTheme: ColorThemeId;
    fileIconTheme: FileIconThemeId;
};

export const DEFAULT_THEME_PREFERENCES: ThemePreferences = {
    colorTheme: 'Dark Modern',
    fileIconTheme: 'vs-seti',
};

const STORAGE_KEY = 'lernumi.code.themePreferences';
const colorThemes = new Set<string>(COLOR_THEME_IDS);
const fileIconThemes = new Set<string>(FILE_ICON_THEME_IDS);

type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Theme settings live outside the versioned tool path so they survive package upgrades. */
export function loadThemePreferences(storage: ThemeStorage | null = browserStorage()): ThemePreferences {
    if (!storage) return { ...DEFAULT_THEME_PREFERENCES };

    try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULT_THEME_PREFERENCES };
        const value = JSON.parse(raw) as Record<string, unknown>;
        return {
            colorTheme: colorThemes.has(String(value.colorTheme))
                ? value.colorTheme as ColorThemeId
                : DEFAULT_THEME_PREFERENCES.colorTheme,
            fileIconTheme: value.fileIconTheme === null || fileIconThemes.has(String(value.fileIconTheme))
                ? value.fileIconTheme as FileIconThemeId
                : DEFAULT_THEME_PREFERENCES.fileIconTheme,
        };
    } catch {
        return { ...DEFAULT_THEME_PREFERENCES };
    }
}

export function saveThemePreferences(
    preferences: { colorTheme?: unknown; fileIconTheme?: unknown },
    storage: ThemeStorage | null = browserStorage(),
): void {
    if (!storage) return;

    const normalized: ThemePreferences = {
        colorTheme: colorThemes.has(String(preferences.colorTheme))
            ? preferences.colorTheme as ColorThemeId
            : DEFAULT_THEME_PREFERENCES.colorTheme,
        fileIconTheme: preferences.fileIconTheme === null || fileIconThemes.has(String(preferences.fileIconTheme))
            ? preferences.fileIconTheme as FileIconThemeId
            : DEFAULT_THEME_PREFERENCES.fileIconTheme,
    };

    try {
        storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch {
        // Theme switching remains available for the current page when storage is blocked or full.
    }
}

function browserStorage(): ThemeStorage | null {
    try {
        return typeof window === 'undefined' ? null : window.localStorage;
    } catch {
        return null;
    }
}
