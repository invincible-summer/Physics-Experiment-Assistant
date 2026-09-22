import { z } from 'zod';
import type { FormulaDefinition } from './types';

export interface FormulaVarState { raw: string; unit: string; uncRaw: string }
export interface FormulaDraft {
  target: string;
  vars: Record<string, FormulaVarState>;
  rows: string[][];
}

const schema = z.object({
  target: z.string(),
  vars: z.record(z.object({ raw: z.string(), unit: z.string(), uncRaw: z.string() })),
  rows: z.array(z.array(z.string())),
});

export function initialFormulaDraft(formula: FormulaDefinition): FormulaDraft {
  return {
    target: '__primary__',
    vars: Object.fromEntries(formula.variables.map(v => [v.name, {
      raw: v.defaultValue === undefined ? '' : String(v.defaultValue), unit: v.unit, uncRaw: '',
    }])),
    rows: formula.aggregates ? Array.from({ length: 8 }, () => formula.aggregates!.columns.map(() => '')) : [],
  };
}

export function restoreFormulaDraft(raw: unknown, formula: FormulaDefinition): FormulaDraft {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return initialFormulaDraft(formula);
  const draft = parsed.data;
  if (draft.target !== '__primary__' && !formula.solveFor.includes(draft.target)) return initialFormulaDraft(formula);
  if (formula.aggregates && draft.rows.some(row => row.length !== formula.aggregates!.columns.length)) return initialFormulaDraft(formula);
  return { ...draft, vars: { ...initialFormulaDraft(formula).vars, ...draft.vars } };
}
