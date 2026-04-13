import { connectDB } from '@/lib/db'
import Settings, { ISettingsDocument } from '@/models/Settings'
import { DEFAULT_SETTINGS } from '@/lib/defaultSettings'

export type SettingsData = typeof DEFAULT_SETTINGS & Partial<ISettingsDocument>

/**
 * Fetch settings from DB (server-side only).
 * Always returns a complete object — falls back to defaults if no doc exists.
 */
export async function getSettings(): Promise<SettingsData> {
  try {
    await connectDB()
    const doc = await Settings.findOne({}).lean()
    if (!doc) return DEFAULT_SETTINGS as SettingsData
    return { ...DEFAULT_SETTINGS, ...doc } as SettingsData
  } catch {
    return DEFAULT_SETTINGS as SettingsData
  }
}
