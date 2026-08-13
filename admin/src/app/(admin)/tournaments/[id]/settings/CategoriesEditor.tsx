'use client';

import { Fragment, useActionState, useEffect, useState, useTransition } from 'react';

import { SKILL_LEVELS, type TournamentCategory } from '~/types';
import { deleteCategory, saveCategory } from '../../actions';
import { EMPTY_FORM_STATE, type ActionResult, type FormState } from '../state';

export default function CategoriesEditor({
  tournamentId,
  categories,
}: {
  tournamentId: string;
  categories: TournamentCategory[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const remove = (category: TournamentCategory) => {
    const confirmed = window.confirm(
      `Delete "${category.name}"? Its ${category.current_players} approved ` +
        `entries and every match in it are deleted too. This cannot be undone.`
    );
    if (!confirmed) return;
    startTransition(async () => setFeedback(await deleteCategory(tournamentId, category.id)));
  };

  return (
    <section className="card">
      <div className="card-header">
        <h2>Categories</h2>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            setAdding((open) => !open);
            setEditingId(null);
          }}
        >
          {adding ? 'Cancel' : 'Add category'}
        </button>
      </div>

      {feedback ? (
        <p
          className={`alert ${feedback.ok ? 'alert-success' : 'alert-error'}`}
          style={{ margin: 16 }}
          role="status"
        >
          {feedback.message}
        </p>
      ) : null}

      {adding ? (
        <div className="card-pad" style={{ background: 'var(--surface-alt)' }}>
          <CategoryForm
            tournamentId={tournamentId}
            category={null}
            onResult={setFeedback}
            onDone={() => setAdding(false)}
          />
        </div>
      ) : null}

      {categories.length === 0 ? (
        <div className="empty">No categories yet.</div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Entry fee</th>
                <th>Approved / max</th>
                <th>Skill</th>
                <th>Prize</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <Fragment key={category.id}>
                  <tr style={{ opacity: pending ? 0.5 : 1 }}>
                    <td>
                      <strong>{category.name}</strong>
                    </td>
                    <td>₹{category.entry_fee}</td>
                    <td>
                      {category.current_players} / {category.max_players}
                    </td>
                    <td>{category.skill_level}</td>
                    <td>{category.prize ?? '—'}</td>
                    <td>
                      <div className="cell-actions">
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() =>
                            setEditingId((current) =>
                              current === category.id ? null : category.id
                            )
                          }
                        >
                          {editingId === category.id ? 'Close' : 'Edit'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => remove(category)}
                          disabled={pending}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                  {editingId === category.id ? (
                    <tr>
                      <td colSpan={6} style={{ background: 'var(--surface-alt)' }}>
                        <CategoryForm
                          tournamentId={tournamentId}
                          category={category}
                          onResult={setFeedback}
                          onDone={() => setEditingId(null)}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CategoryForm({
  tournamentId,
  category,
  onResult,
  onDone,
}: {
  tournamentId: string;
  category: TournamentCategory | null;
  onResult: (result: ActionResult) => void;
  onDone: () => void;
}) {
  const action = saveCategory.bind(null, tournamentId, category?.id ?? null);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    EMPTY_FORM_STATE
  );

  useEffect(() => {
    if (!state.message) return;
    onResult(state);
    if (state.ok) onDone();
  }, [state, onResult, onDone]);

  return (
    <form action={formAction} className="stack" style={{ gap: 12 }}>
      <div className="form-grid">
        <label className="field">
          Name
          <input name="name" defaultValue={category?.name ?? ''} placeholder="Men's Singles" required />
        </label>
        <label className="field">
          Entry fee (₹)
          <input name="entry_fee" type="number" min={0} defaultValue={category?.entry_fee ?? 0} />
        </label>
        <label className="field">
          Max players
          <input
            name="max_players"
            type="number"
            min={1}
            defaultValue={category?.max_players ?? 32}
          />
        </label>
        <label className="field">
          Skill level
          <select name="skill_level" defaultValue={category?.skill_level ?? 'open'}>
            {SKILL_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Prize
          <input name="prize" defaultValue={category?.prize ?? ''} placeholder="₹10,000" />
        </label>
      </div>
      <div className="row">
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? 'Saving…' : category ? 'Save category' : 'Add category'}
        </button>
        <button type="button" className="btn btn-sm" onClick={onDone} disabled={pending}>
          Cancel
        </button>
        <span className="faint">
          Lowering max players below the current count does not remove anyone.
        </span>
      </div>
    </form>
  );
}
