export type EnkryptStatus = 'pass' | 'flagged' | 'fallback' | 'unavailable';

export function resolveEnkryptStatus(
  passed: boolean,
  issues: string[],
  validationUnavailable = false,
): EnkryptStatus {
  if (passed && validationUnavailable) {
    return 'unavailable';
  }

  if (passed) {
    return 'pass';
  }

  const hasContentIssues = issues.some(
    (issue) => !issue.toLowerCase().includes('unavailable'),
  );

  return hasContentIssues ? 'flagged' : 'unavailable';
}
