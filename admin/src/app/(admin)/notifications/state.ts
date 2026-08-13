/**
 * Shared shapes for the composer. Kept out of `actions.ts` because a
 * `'use server'` module may only export async functions.
 */

import type { ActionResult } from '../tournaments/[id]/state';

export interface AudiencePreview {
  count: number;
  label: string;
  title: string;
  body: string;
}

export interface ComposerState extends ActionResult {
  /** Set once the audience has been resolved; cleared after a send. */
  preview: AudiencePreview | null;
}

export const EMPTY_COMPOSER_STATE: ComposerState = { ok: false, message: '', preview: null };
