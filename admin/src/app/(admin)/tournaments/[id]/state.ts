/**
 * Shared shapes for the server actions. They live outside `actions.ts` because a
 * `'use server'` module is only allowed to export async functions — a plain
 * const like `EMPTY_FORM_STATE` there is a build error.
 */

export interface ActionResult {
  ok: boolean;
  message: string;
}

/** `useActionState` shape. `version` bumps only on a successful write. */
export interface FormState extends ActionResult {
  version: number;
}

export const EMPTY_FORM_STATE: FormState = { ok: false, message: '', version: 0 };

export function ok(message: string): ActionResult {
  return { ok: true, message };
}

export function fail(message: string): ActionResult {
  return { ok: false, message };
}
