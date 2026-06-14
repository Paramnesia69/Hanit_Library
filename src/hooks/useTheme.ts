import { useCallback, useEffect, useState } from 'react';
import { applyTheme, getStoredTheme } from '../lib/theme';
import type { ThemeId } from '../lib/theme';

/** ניהול ערכת הנושא של האפליקציה, עם שמירה מתמשכת */
export function useTheme() {
    const [theme, setThemeState] = useState<ThemeId>(() => getStoredTheme());

    useEffect(() => {
        applyTheme(theme);
    }, [theme]);

    const setTheme = useCallback((id: ThemeId) => setThemeState(id), []);

    return { theme, setTheme };
}
