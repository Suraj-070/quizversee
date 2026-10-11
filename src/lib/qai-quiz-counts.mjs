/**
 * Available quiz-size presets. Admin presets are suggestions, not a minimum.
 * The custom field permits any integer from 1 through publishedCount.
 */
export function quizCountChoices(rawCounts, publishedCount) {
  const defaults = [1, 3, 5, 10];
  const presets = Array.isArray(rawCounts) ? rawCounts : defaults;
  return [...new Set([1, publishedCount, ...presets])]
    .filter(n => Number.isSafeInteger(n) && n > 0 && n <= 1000)
    .sort((a, b) => a - b)
    .map(count => ({ count, available: count <= publishedCount }));
}
