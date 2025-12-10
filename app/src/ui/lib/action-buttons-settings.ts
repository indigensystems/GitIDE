import {
  IActionButtonsSettings,
  ActionButtonTheme,
  defaultActionButtonsSettings,
} from '../../models/preferences'

const actionButtonsSettingsKey = 'actionButtonsSettings'

/**
 * Get the persisted action buttons settings from localStorage
 */
export function getPersistedActionButtonsSettings(): IActionButtonsSettings {
  const stored = localStorage.getItem(actionButtonsSettingsKey)

  if (!stored) {
    return defaultActionButtonsSettings
  }

  try {
    const parsed = JSON.parse(stored)
    // Merge with defaults to handle any missing fields from older versions
    return {
      ...defaultActionButtonsSettings,
      ...parsed,
      // Ensure enum values are valid
      theme: Object.values(ActionButtonTheme).includes(parsed.theme)
        ? parsed.theme
        : defaultActionButtonsSettings.theme,
      // Ensure customColors is an object
      customColors:
        typeof parsed.customColors === 'object' && parsed.customColors !== null
          ? parsed.customColors
          : defaultActionButtonsSettings.customColors,
      // Ensure customButtons is an array
      customButtons: Array.isArray(parsed.customButtons)
        ? parsed.customButtons
        : defaultActionButtonsSettings.customButtons,
    }
  } catch {
    return defaultActionButtonsSettings
  }
}

/**
 * Persist action buttons settings to localStorage
 */
export function setPersistedActionButtonsSettings(
  settings: IActionButtonsSettings
): void {
  localStorage.setItem(actionButtonsSettingsKey, JSON.stringify(settings))
}
