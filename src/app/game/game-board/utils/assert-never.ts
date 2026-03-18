/**
 * Exhaustive switch helper — causes a compile error if a switch is missing a case.
 * Use in the default branch of enum switches:
 *   default: assertNever(value);
 */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${value}`);
}
