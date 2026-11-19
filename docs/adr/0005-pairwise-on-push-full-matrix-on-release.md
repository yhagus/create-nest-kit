# Pairwise combos on every push, the full matrix on release

Every push to `main` runs a 20-combo pairwise subset (`prSubset()` in `options.ts`), which covers every pair of values from any two code-shaping options. A bug that needs three options together can slip past it, so a release runs all 480 combos before publishing. Releases are rare and the matrix runs one parallel CI job per combo, so the cost is small next to shipping a broken combo.

## Considered Options

- Full matrix on every push: too slow and costly for every change.
- A scheduled full run: dropped earlier (commit `17f3bdf`); it reports breakage after the fact, not before a release.
