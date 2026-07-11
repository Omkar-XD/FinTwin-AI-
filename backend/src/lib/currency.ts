export function resolveCurrencySymbol(currencyCode: string | null | undefined): string {
  const code = (currencyCode ?? '').toUpperCase();
  if (code === 'USD') return '$';
  if (code === 'INR' || code === '') return '₹'; // default to ₹ when unlabeled
  if (code === 'EUR') return '€';
  if (code === 'GBP') return '£';
  return code || '₹'; // fallback: show raw code for anything else
}