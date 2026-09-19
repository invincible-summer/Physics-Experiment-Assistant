/** 标准配置注册表 */
import { GBT_27418_2017 } from './gbt-27418-2017';
import { TSINGHUA_A1_2026 } from './tsinghua-a1-2026';
import { TSINGHUA_FOUNDATION_2020 } from './tsinghua-foundation-2020';
import { buildCustomProfile, DEFAULT_CUSTOM_OPTIONS } from './custom';
import { StandardProfile } from './types';

export * from './types';
export { TSINGHUA_A1_2026, TSINGHUA_FOUNDATION_2020, GBT_27418_2017 };
export * from './custom';

const PROFILES: Record<string, StandardProfile> = {
  [TSINGHUA_A1_2026.id]: TSINGHUA_A1_2026,
  [TSINGHUA_FOUNDATION_2020.id]: TSINGHUA_FOUNDATION_2020,
  [GBT_27418_2017.id]: GBT_27418_2017,
  custom: buildCustomProfile(DEFAULT_CUSTOM_OPTIONS),
};

export function listProfiles(): StandardProfile[] {
  return Object.values(PROFILES);
}

export function getProfile(id: string): StandardProfile {
  const p = PROFILES[id];
  if (!p) throw new Error(`未知标准配置：${id}`);
  return p;
}

export function tryGetProfile(id: string): StandardProfile | undefined {
  return PROFILES[id];
}

export const DEFAULT_PROFILE_ID = TSINGHUA_A1_2026.id;
