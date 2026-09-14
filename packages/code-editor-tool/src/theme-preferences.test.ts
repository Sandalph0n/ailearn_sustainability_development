import { describe, expect, it } from 'vitest';

import {
    DEFAULT_THEME_PREFERENCES,
    loadThemePreferences,
    saveThemePreferences,
} from './theme-preferences';

function memoryStorage(initial?: string) {
    let value = initial ?? null;
    return {
        getItem: () => value,
        setItem: (_key: string, next: string) => {
            value = next;
        },
        value: () => value,
    };
}

describe('theme preferences', () => {
    it('defaults to the VS Code Dark Modern and Seti themes', () => {
        expect(loadThemePreferences(memoryStorage())).toEqual(DEFAULT_THEME_PREFERENCES);
    });

    it('persists supported color and file icon themes', () => {
        const storage = memoryStorage();
        saveThemePreferences({ colorTheme: 'Light+', fileIconTheme: 'vs-minimal' }, storage);

        expect(loadThemePreferences(storage)).toEqual({
            colorTheme: 'Light+',
            fileIconTheme: 'vs-minimal',
        });
    });

    it('supports the built-in no-file-icons option', () => {
        const storage = memoryStorage();
        saveThemePreferences({ colorTheme: 'Dark 2026', fileIconTheme: null }, storage);

        expect(loadThemePreferences(storage).fileIconTheme).toBeNull();
    });

    it('does not restore unknown or malformed theme values', () => {
        const storage = memoryStorage(JSON.stringify({
            colorTheme: 'missing-theme',
            fileIconTheme: 'missing-icons',
        }));

        expect(loadThemePreferences(storage)).toEqual(DEFAULT_THEME_PREFERENCES);
    });
});
