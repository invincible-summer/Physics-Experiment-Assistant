/** 实验注册表（2026 A(1) 七个必做实验） */
import { ExperimentDefinition } from '../types';
import { FrictionExperiment } from './friction';
import { HallExperiment } from './hall';
import { ThermalExperiment } from './thermal';
import { DampingExperiment } from './damping';
import { ScopeSoundExperiment } from './scope-sound';
import { LensExperiment } from './lens';
import { MichelsonExperiment } from './michelson';

export * from '../types';
export { FrictionExperiment, HallExperiment, ThermalExperiment, DampingExperiment, ScopeSoundExperiment, LensExperiment, MichelsonExperiment };

const ALL: ExperimentDefinition[] = [
  FrictionExperiment,
  HallExperiment,
  ThermalExperiment,
  DampingExperiment,
  ScopeSoundExperiment,
  LensExperiment,
  MichelsonExperiment,
];

const BY_ID = new Map(ALL.map((e) => [e.id, e]));

export function listExperiments(): ExperimentDefinition[] {
  return ALL;
}

export function getExperiment(id: string): ExperimentDefinition | undefined {
  return BY_ID.get(id);
}
