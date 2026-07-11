import test from 'node:test';
import assert from 'node:assert/strict';
import { ClaimParser } from './assistant/ClaimParser.js';
import { ClaimType } from './assistant/ClaimType.js';
import { DecisionEngine } from './DecisionEngine.js';
import { ValidationMode } from './ValidationMode.js';

test('assistant claim parser separates facts from recommendations', () => {
  const claims = new ClaimParser().parse(
    'My monthly income is ₹80,000. You could reduce ATM withdrawals.',
  );

  assert.equal(claims[0]?.type, ClaimType.FACT);
  assert.equal(claims[1]?.type, ClaimType.RECOMMENDATION);
});

test('decision engine replaces only safety failures', () => {
  const decision = new DecisionEngine().decide({
    safetyPassed: false,
    factualPassed: false,
    adherenceScore: 0.2,
    safetyScore: 0,
    validationMode: ValidationMode.ASSISTANT,
    safetyIssues: ['Unsafe content'],
    factualIssues: [],
    warnings: [],
    responseId: 'response-1',
    durationMs: 10,
    validationUnavailable: false,
    finalText: 'original',
    responseReplaced: false,
  });

  assert.equal(decision.responseReplaced, true);
  assert.notEqual(decision.finalText, 'original');
});

test('decision engine keeps original response on factual/adherence failure', () => {
  const decision = new DecisionEngine().decide({
    safetyPassed: true,
    factualPassed: false,
    adherenceScore: 0.2,
    safetyScore: 1,
    validationMode: ValidationMode.ASSISTANT,
    safetyIssues: [],
    factualIssues: ['Low adherence'],
    warnings: [],
    responseId: 'response-2',
    durationMs: 10,
    validationUnavailable: false,
    finalText: 'original',
    responseReplaced: false,
  });

  assert.equal(decision.responseReplaced, false);
  assert.equal(decision.finalText, 'original');
});
