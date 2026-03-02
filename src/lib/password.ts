export type PasswordCriteria = {
  hasMinLength: boolean;
  hasLower: boolean;
  hasUpper: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
};

/** Return per-criterion booleans (pure, safe for client & server). */
export function passwordCriteria(pw: string): PasswordCriteria {
  const len = pw?.length ?? 0;
  return {
    hasMinLength: len >= 8,
    hasLower: /[a-z]/.test(pw),
    hasUpper: /[A-Z]/.test(pw),
    hasNumber: /[0-9]/.test(pw),
    hasSymbol: /[^A-Za-z0-9]/.test(pw),
  };
}

/** Validate password and return structured result for server-side use. */
export function validatePassword(pw: string): { valid: boolean; errors: string[] } {
  const c = passwordCriteria(pw);
  const errors: string[] = [];
  if (!c.hasMinLength) errors.push("minLength");
  if (!c.hasLower) errors.push("lowercase");
  if (!c.hasUpper) errors.push("uppercase");
  if (!c.hasNumber) errors.push("number");
  if (!c.hasSymbol) errors.push("symbol");
  return { valid: errors.length === 0, errors };
}

export function isPasswordValid(pw: string): boolean {
  return validatePassword(pw).valid;
}
