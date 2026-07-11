import type { ContextAdherenceValidator } from '../ContextAdherenceValidator.js';
import { ValidationMode } from '../ValidationMode.js';
import type { ValidationInput, ValidationStrategy } from '../ValidationStrategy.js';
import type { ScenarioContext } from '../../scenarios.js';

export type FinancialProfile = Record<string, unknown>;

export interface SimulationValidationContext {
  scenarioContext?: ScenarioContext;
  currentProfile: FinancialProfile | null;
  scenarioParameters: Record<string, unknown>;
  projection: Record<string, unknown>;
  assumptions: string[];
  projectionHorizon: string;
}

export class SimulationValidator implements ValidationStrategy {
  mode = ValidationMode.SIMULATION;

  constructor(private readonly validateAdherence: ContextAdherenceValidator) {}

  validateContext(input: ValidationInput) {
    const suppliedContext = this.parseSimulationValidationContext(
      input.context['simulationValidationContext'],
    );
    const projection = suppliedContext?.projection ?? input.metadata.projection ?? this.parseProjection(input.text);
    const scenario = input.context['scenario'] as Record<string, unknown> | undefined;
    const scenarioParameters = (
      suppliedContext?.scenarioContext?.scenarioParameters
      ?? suppliedContext?.scenarioParameters
      ?? (scenario?.['params'] && typeof scenario['params'] === 'object'
        ? scenario['params']
        : {})
    ) as Record<string, unknown>;
    const assumptions = Array.isArray(projection['assumptions'])
      ? projection['assumptions'].filter((item): item is string => typeof item === 'string')
      : [];
    const projectionHorizon = suppliedContext?.projectionHorizon ?? input.metadata.projectionHorizon ?? '12/24/36 months';
    const simulationContext: SimulationValidationContext = {
      scenarioContext: suppliedContext?.scenarioContext,
      currentProfile:
        suppliedContext?.currentProfile
        ?? (input.context['financialProfile'] as FinancialProfile | null)
        ?? null,
      scenarioParameters,
      projection,
      assumptions: suppliedContext?.assumptions ?? assumptions,
      projectionHorizon,
    };
    const warnings = this.validateProjectionShape(simulationContext, scenario);

    return this.validateAdherence(
      input.text,
      JSON.stringify(
        {
          simulationValidationContext: simulationContext,
          riskScore: input.context['riskScore'],
          scenario,
          currencySymbol: input.context['currencySymbol'],
          scenarioType: input.metadata.scenarioType,
          instruction:
            'Validate the simulation only against scenario parameters, assumptions, internal consistency, scenario references, projection horizon, verified starting values, and risk consistency. Never compare projected ending values against current profile values; projected values are expected to differ from current net worth, cash flow, savings, and debt.',
        },
        null,
        2,
      ),
    ).then((result) => ({
      ...result,
      factualPassed: result.factualPassed && warnings.length === 0,
      factualIssues: [...result.factualIssues, ...warnings],
      warnings: result.warnings,
    }));
  }

  private parseProjection(text: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }

  private parseSimulationValidationContext(value: unknown): SimulationValidationContext | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const candidate = value as Record<string, unknown>;
    const projection = candidate['projection'];
    const scenarioContext = candidate['scenarioContext'];
    const scenarioParameters = candidate['scenarioParameters'];
    const assumptions = candidate['assumptions'];
    const projectionHorizon = candidate['projectionHorizon'];
    const currentProfile = candidate['currentProfile'];

    if (
      !projection
      || typeof projection !== 'object'
      || Array.isArray(projection)
      || !scenarioParameters
      || typeof scenarioParameters !== 'object'
      || Array.isArray(scenarioParameters)
      || !Array.isArray(assumptions)
      || typeof projectionHorizon !== 'string'
    ) {
      return null;
    }

    return {
      scenarioContext:
        scenarioContext && typeof scenarioContext === 'object' && !Array.isArray(scenarioContext)
          ? scenarioContext as ScenarioContext
          : undefined,
      currentProfile:
        currentProfile && typeof currentProfile === 'object' && !Array.isArray(currentProfile)
          ? currentProfile as FinancialProfile
          : null,
      scenarioParameters: scenarioParameters as Record<string, unknown>,
      projection: projection as Record<string, unknown>,
      assumptions: assumptions.filter((item): item is string => typeof item === 'string'),
      projectionHorizon,
    };
  }

  private validateProjectionShape(
    context: SimulationValidationContext,
    scenario: Record<string, unknown> | undefined,
  ): string[] {
    const issues: string[] = [];

    if (!scenario?.['type']) {
      issues.push('Simulation scenario type is missing');
    }

    if (Object.keys(context.scenarioParameters).length === 0) {
      issues.push('Simulation scenario parameters are missing');
    }

    if (context.assumptions.length === 0) {
      issues.push('Simulation projection assumptions are missing');
    }

    if (!context.projection['projectedNetWorth'] || !context.projection['projectedCashFlow']) {
      issues.push('Simulation projection is missing expected projection fields');
    }

    for (const field of ['projectedNetWorth', 'projectedCashFlow']) {
      const values = context.projection[field];
      if (!values || typeof values !== 'object') {
        continue;
      }

      for (const horizon of ['months12', 'months24', 'months36']) {
        const value = (values as Record<string, unknown>)[horizon];
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          issues.push(`Simulation projection ${field}.${horizon} must be a finite number`);
        }
      }
    }

    if (!context.projectionHorizon) {
      issues.push('Simulation projection horizon is missing');
    }

    if (!context.currentProfile) {
      issues.push('Simulation verified starting profile is missing');
    }

    const narrative = context.projection['narrative'];
    if (typeof narrative !== 'string' || narrative.trim().length === 0) {
      issues.push('Simulation projection narrative is missing');
    }

    const risks = context.projection['risks'];
    if (!Array.isArray(risks) || risks.some((risk) => typeof risk !== 'string')) {
      issues.push('Simulation projection risks must be an array of strings');
    }

    return issues;
  }
}
