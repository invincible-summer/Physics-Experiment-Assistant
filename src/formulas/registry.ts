/**
 * 公式注册表：domain/topic 聚合 + 搜索 + 静态校验（plan §5、§8、§10.4）。
 * 单一数据源：结果元数据收回 FormulaDefinition.result，不再维护并行映射。
 */
import katex from 'katex';
import {
  FormulaDefinition, FormulaDomain, DOMAIN_LABELS, DOMAIN_TOPICS, topicLabel,
} from './types';
import { compileExpression } from '../core/expression';
import { tryGetUnitDef } from '../core/quantity';
import { MEASUREMENT_FORMULAS, INSTRUMENT_FORMULAS } from './measurement';
import { KINEMATICS_FORMULAS } from './mechanics/kinematics';
import { DYNAMICS_FORMULAS } from './mechanics/dynamics';
import { ENERGY_MOMENTUM_FORMULAS } from './mechanics/energy-momentum';
import {
  ROTATION_FORMULAS, ELASTICITY_FORMULAS, GRAVITY_FORMULAS, FLUID_FORMULAS,
} from './mechanics/rotation-gravity-fluids';
import { FRICTION_FORMULAS } from './mechanics/friction';
import { HEAT_TRANSFER_FORMULAS } from './thermal/heat-transfer';
import { THERMAL_PROPERTIES_FORMULAS } from './thermal/thermal-properties';
import { GAS_FORMULAS, THERMODYNAMICS_FORMULAS } from './thermal/thermodynamics';
import { ELECTROSTATICS_FORMULAS } from './em/electrostatics';
import { CIRCUITS_FORMULAS } from './em/circuits';
import { MAGNETISM_FORMULAS } from './em/magnetism';
import { HALL_FORMULAS } from './em/hall';
import { INDUCTION_AC_FORMULAS } from './em/induction-ac';
import { OSCILLATIONS_FORMULAS } from './waves/oscillations';
import { WAVES_SOUND_FORMULAS } from './waves/waves-sound';
import { GEOMETRIC_OPTICS_FORMULAS } from './optics/geometric';
import { PHYSICAL_OPTICS_FORMULAS } from './optics/physical';
import { RELATIVITY_FORMULAS } from './modern/relativity';
import { QUANTUM_ATOMIC_FORMULAS } from './modern/quantum-atomic';
import { NUCLEAR_SOLID_FORMULAS } from './modern/nuclear-solid';
import { GBT_FORMULAS } from './standards/gbt';

export * from './types';

const ALL: FormulaDefinition[] = [
  ...MEASUREMENT_FORMULAS,
  ...INSTRUMENT_FORMULAS,
  ...KINEMATICS_FORMULAS,
  ...DYNAMICS_FORMULAS,
  ...ENERGY_MOMENTUM_FORMULAS,
  ...ROTATION_FORMULAS,
  ...ELASTICITY_FORMULAS,
  ...GRAVITY_FORMULAS,
  ...FLUID_FORMULAS,
  ...FRICTION_FORMULAS,
  ...HEAT_TRANSFER_FORMULAS,
  ...THERMAL_PROPERTIES_FORMULAS,
  ...GAS_FORMULAS,
  ...THERMODYNAMICS_FORMULAS,
  ...ELECTROSTATICS_FORMULAS,
  ...CIRCUITS_FORMULAS,
  ...MAGNETISM_FORMULAS,
  ...HALL_FORMULAS,
  ...INDUCTION_AC_FORMULAS,
  ...OSCILLATIONS_FORMULAS,
  ...WAVES_SOUND_FORMULAS,
  ...GEOMETRIC_OPTICS_FORMULAS,
  ...PHYSICAL_OPTICS_FORMULAS,
  ...RELATIVITY_FORMULAS,
  ...QUANTUM_ATOMIC_FORMULAS,
  ...NUCLEAR_SOLID_FORMULAS,
  ...GBT_FORMULAS,
];

const BY_ID = new Map(ALL.map((f) => [f.id, f]));

/** experimental 公式不默认展示（AGENTS §8） */
export const VISIBLE_FORMULAS = ALL.filter((f) => f.provenance.status !== 'experimental');

export function getFormula(id: string): FormulaDefinition | undefined {
  return BY_ID.get(id);
}

export interface FormulaFilter {
  domain?: FormulaDomain;
  topic?: string;
}

export function listFormulas(filter?: FormulaFilter): FormulaDefinition[] {
  return VISIBLE_FORMULAS.filter((f) =>
    (!filter?.domain || f.domain === filter.domain) && (!filter?.topic || f.topic === filter.topic));
}

/** 一级 domain 列表（按注册表声明顺序，只返回有公式的） */
export function listDomains(): FormulaDomain[] {
  const seen = new Set<FormulaDomain>();
  for (const f of VISIBLE_FORMULAS) seen.add(f.domain);
  return (Object.keys(DOMAIN_LABELS) as FormulaDomain[]).filter((d) => seen.has(d));
}

/** 某域下有公式的 topic 列表（返回登记过的 TopicDef） */
export function listTopics(domain: FormulaDomain): { id: string; label: string }[] {
  const seen = new Set<string>();
  for (const f of VISIBLE_FORMULAS) {
    if (f.domain === domain) seen.add(f.topic);
  }
  return DOMAIN_TOPICS[domain].filter((t) => seen.has(t.id));
}

/** 搜索：title/别名/id/tags/domain/topic 中文标签/变量名与中文名/LaTeX 的轻量线性过滤 */
export function searchFormulas(query: string): FormulaDefinition[] {
  const q = query.trim().toLowerCase();
  if (!q) return VISIBLE_FORMULAS;
  return VISIBLE_FORMULAS.filter((f) => {
    if (f.title.toLowerCase().includes(q)) return true;
    if (f.id.toLowerCase().includes(q)) return true;
    if (f.aliases.some((a) => a.toLowerCase().includes(q))) return true;
    if ((f.tags ?? []).some((t) => t.toLowerCase().includes(q))) return true;
    if (DOMAIN_LABELS[f.domain].toLowerCase().includes(q)) return true;
    if (topicLabel(f.domain, f.topic).toLowerCase().includes(q)) return true;
    if (f.variables.some((v) => v.name.toLowerCase().includes(q) || v.label.includes(q))) return true;
    if (f.latex.toLowerCase().includes(q)) return true;
    return false;
  });
}

/**
 * 注册表静态校验（plan §10.4）：
 * 返回违规描述列表；空数组 = 全部通过。测试与 CI 必须断言为空。
 */
export function validateRegistry(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const domainIds = new Set(Object.keys(DOMAIN_LABELS));
  for (const f of ALL) {
    const tag = `${f.id}`;
    if (ids.has(f.id)) errors.push(`${tag}: id 重复`);
    ids.add(f.id);
    if (!Number.isInteger(f.version) || f.version < 1) errors.push(`${tag}: version 必须为正整数`);
    if (!(f.domain in DOMAIN_LABELS) || !domainIds.has(f.domain)) errors.push(`${tag}: 未登记的 domain ${f.domain}`);
    if (!DOMAIN_TOPICS[f.domain].some((t) => t.id === f.topic)) {
      errors.push(`${tag}: domain ${f.domain} 下未登记 topic ${f.topic}`);
    }
    if (!f.title || f.title.length < 2) errors.push(`${tag}: title 缺失`);
    if (!f.latex || f.latex.length < 3) errors.push(`${tag}: latex 缺失`);
    // KaTeX 可渲染
    try {
      katex.renderToString(f.latex, { throwOnError: true, output: 'html', trust: false });
    } catch (err) {
      errors.push(`${tag}: latex 无法渲染：${(err as Error).message.split('\n')[0]}`);
    }
    if (!f.provenance?.status) errors.push(`${tag}: provenance 缺失`);
    if (f.provenance?.status === 'experimental') {
      errors.push(`${tag}: experimental 条目不得进入注册表`);
    }
    // 变量：名称合法、去重、单位可解析
    const varNames = new Set<string>();
    for (const v of f.variables) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v.name)) errors.push(`${tag}: 非法变量名 ${v.name}`);
      if (varNames.has(v.name)) errors.push(`${tag}: 变量重复 ${v.name}`);
      varNames.add(v.name);
      if (v.unit !== '' && !tryGetUnitDef(v.unit)) errors.push(`${tag}: 变量 ${v.name} 单位 "${v.unit}" 不可解析`);
    }
    if (f.kind === 'computable') {
      if (!f.expression) {
        errors.push(`${tag}: computable 公式缺少 expression`);
      } else {
        try {
          const compiled = compileExpression(f.expression);
          if (!f.customCompute) {
            for (const v of f.variables) {
              if (!compiled.variables.includes(v.name)) {
                errors.push(`${tag}: 表达式未引用变量 ${v.name}`);
              }
            }
          }
        } catch (err) {
          errors.push(`${tag}: 表达式不可编译：${(err as Error).message}`);
        }
      }
      if (!f.result?.symbol) errors.push(`${tag}: computable 公式缺少 result.symbol`);
      if (f.result?.unit && !tryGetUnitDef(f.result.unit)) {
        errors.push(`${tag}: result 单位 "${f.result.unit}" 不可解析`);
      }
      if (!f.examples?.length) errors.push(`${tag}: computable 公式至少 1 个 example`);
    } else {
      // reference：不得硬凑数值计算
      if (f.expression) errors.push(`${tag}: reference 公式不得携带 expression`);
      if (f.solveFor.length > 0) errors.push(`${tag}: reference 公式 solveFor 必须为空`);
      if (f.result) errors.push(`${tag}: reference 公式不应携带 result`);
      if (!f.conditions) errors.push(`${tag}: reference 公式必须给出适用条件`);
    }
    for (const [target, expr] of Object.entries(f.solutions ?? {})) {
      try {
        compileExpression(expr);
      } catch (err) {
        errors.push(`${tag}: 解 ${target} 不可编译：${(err as Error).message}`);
      }
      if (!f.solveFor.includes(target)) errors.push(`${tag}: 解 ${target} 未登记在 solveFor`);
    }
    for (const t of f.solveFor) {
      if (!varNames.has(t)) errors.push(`${tag}: solveFor 目标 ${t} 不在变量表中`);
    }
    for (const c of f.constraints ?? []) {
      try {
        compileExpression(c.expression);
      } catch (err) {
        errors.push(`${tag}: 约束不可编译：${(err as Error).message}`);
      }
    }
  }
  return errors;
}
