/**
 * 全局设置 store（localStorage 持久化的轻量偏好，AGENTS.md §13）。
 * 设置页的完整字段见 plan.md §3。
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_PROFILE_ID, buildCustomProfile, CustomProfileOptions, DEFAULT_CUSTOM_OPTIONS,
  StandardProfile, tryGetProfile,
} from '../standards/registry';

export type MathStyle = 'dollar' | 'parens';
export type UnitOutput = 'auto' | 'si' | 'follow-input';

export interface Preferences {
  standardProfileId: string;
  customOptions: CustomProfileOptions;
  /** 显示设置（profile 优先，用户覆盖需显式选择） */
  uncertaintyDigitsOverride: 'profile' | 1 | 2;
  showDimensionCheck: boolean;
  angleUnit: 'deg' | 'rad';
  defaultPlotFormat: 'svg' | 'png';
  plotWhiteBackground: boolean;
  showFitR: boolean;
  showRR2: boolean;
  defaultErrorBars: boolean;
  mathStyle: MathStyle;
  latexUnitStyle: boolean; // \mathrm{}
  showSafety: boolean;
  showProvenance: boolean;
  showDiagnostics: boolean;
  expertMode: boolean;
  theme: 'light' | 'dark';
  autosave: boolean;
}

interface SettingsState extends Preferences {
  set<K extends keyof Preferences>(key: K, value: Preferences[K]): void;
  setCustomOptions(opts: Partial<CustomProfileOptions>): void;
  /** 当前生效的标准配置对象 */
  activeProfile(): StandardProfile;
}

const defaults: Preferences = {
  standardProfileId: DEFAULT_PROFILE_ID,
  customOptions: DEFAULT_CUSTOM_OPTIONS,
  uncertaintyDigitsOverride: 'profile',
  showDimensionCheck: true,
  angleUnit: 'deg',
  defaultPlotFormat: 'svg',
  plotWhiteBackground: true,
  showFitR: true,
  showRR2: false,
  defaultErrorBars: true,
  mathStyle: 'dollar',
  latexUnitStyle: true,
  showSafety: true,
  showProvenance: true,
  showDiagnostics: true,
  expertMode: false,
  theme: 'light',
  autosave: true,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...defaults,
      set: (key, value) => set({ [key]: value } as Partial<SettingsState>),
      setCustomOptions: (opts) =>
        set((s) => ({ customOptions: { ...s.customOptions, ...opts } })),
      activeProfile: () => {
        const s = get();
        if (s.standardProfileId === 'custom') {
          return buildCustomProfile(s.customOptions);
        }
        return tryGetProfile(s.standardProfileId) ?? tryGetProfile(DEFAULT_PROFILE_ID)!;
      },
    }),
    {
      name: 'pea.settings',
      partialize: (s) => ({ ...s, set: undefined, setCustomOptions: undefined, activeProfile: undefined }) as unknown as Preferences,
    },
  ),
);
