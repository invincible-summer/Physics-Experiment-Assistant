/** 公式注册表：聚合 + 搜索 + 版本查询（plan.md §8、§13） */
import { FormulaDefinition, FormulaCategory, CATEGORY_LABELS } from './types';
import { MEASUREMENT_FORMULAS, INSTRUMENT_FORMULAS } from './measurement';
import { FRICTION_FORMULAS } from './friction';
import { HALL_FORMULAS, THERMAL_FORMULAS } from './hall';
import { OSCILLATION_FORMULAS } from './oscillation';
import { WAVES_FORMULAS } from './waves';
import { OPTICS_FORMULAS } from './optics';
import { GBT_FORMULAS } from './gbt';

export * from './types';

const ALL: FormulaDefinition[] = [
  ...MEASUREMENT_FORMULAS,
  ...INSTRUMENT_FORMULAS,
  ...FRICTION_FORMULAS,
  ...HALL_FORMULAS,
  ...THERMAL_FORMULAS,
  ...OSCILLATION_FORMULAS,
  ...WAVES_FORMULAS,
  ...OPTICS_FORMULAS,
  ...GBT_FORMULAS,
];

const BY_ID = new Map(ALL.map((f) => [f.id, f]));

/** experimental 公式不默认展示（AGENTS §8） */
export const VISIBLE_FORMULAS = ALL.filter((f) => f.provenance.status !== 'experimental');

export function getFormula(id: string): FormulaDefinition | undefined {
  return BY_ID.get(id);
}

export function listFormulas(category?: FormulaCategory): FormulaDefinition[] {
  return VISIBLE_FORMULAS.filter((f) => !category || f.category === category);
}

export function listCategories(): FormulaCategory[] {
  const seen = new Set<FormulaCategory>();
  for (const f of VISIBLE_FORMULAS) seen.add(f.category);
  return [...seen];
}

/** 搜索：标题/别名/类别/变量名，支持中英文与拼音首字母以外的直接子串匹配 */
export function searchFormulas(query: string): FormulaDefinition[] {
  const q = query.trim().toLowerCase();
  if (!q) return VISIBLE_FORMULAS;
  return VISIBLE_FORMULAS.filter((f) => {
    if (f.title.toLowerCase().includes(q)) return true;
    if (f.id.toLowerCase().includes(q)) return true;
    if (f.aliases.some((a) => a.toLowerCase().includes(q))) return true;
    if (CATEGORY_LABELS[f.category].toLowerCase().includes(q)) return true;
    if (f.variables.some((v) => v.name.toLowerCase().includes(q) || v.label.includes(q))) return true;
    if (f.latex.toLowerCase().includes(q)) return true;
    return false;
  });
}
