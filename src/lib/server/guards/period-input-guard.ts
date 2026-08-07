import { evaluateInputForDate, isInputClosedForDate } from "@/lib/server/services/cutoff-policy-service";

export type PeriodInputResult =
  | { ok: true; late: boolean }
  | { ok: false; status: number; error: string };

/**
 * Reusable H+1 period-input guard for daily-transaction write routes. Composes
 * the two config-driven rules into one check so every create/edit/import path
 * enforces them identically:
 *  1. The transaction date must not be in the future, and input for date D is
 *     flagged late once past D+1 (the H+1 rule).
 *  2. Input is closed once the date's invoice period has passed its cut-off.
 *
 * Returns `{ ok: true, late }` when input is permitted (late-flag surfaced for
 * the caller to persist), or `{ ok: false, status, error }` with the HTTP status
 * and message to return.
 */
export function validatePeriodInput(
  projectCode: string,
  trxDate: string,
  ref = new Date(),
): PeriodInputResult {
  const dateCheck = evaluateInputForDate(trxDate, ref);
  if (!dateCheck.allowed) {
    return { ok: false, status: 422, error: dateCheck.reason };
  }
  if (isInputClosedForDate(projectCode, trxDate, ref)) {
    return { ok: false, status: 409, error: "Periode sudah melewati cut-off — input ditutup." };
  }
  return { ok: true, late: dateCheck.late };
}
