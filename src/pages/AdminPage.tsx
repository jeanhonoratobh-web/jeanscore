/**
 * `AdminPage` — the administrative control panel (`pages/AdminPage.tsx`,
 * Requirement 28).
 *
 * A tabbed admin surface (mounted at `/admin` behind the `requireAdmin` guard)
 * that composes the reusable component library into three management areas over
 * the injected Services:
 *
 * - **Usuários** — lists every account with status, role and registration date,
 *   and exposes Approve / Reject (via `users.setStatus`) and Promote / Demote
 *   (via `users.setRole`) actions (Requirements 28.1, 28.2). The logged-in admin
 *   can never demote their own account: the Demote action is disabled for the
 *   current user and guarded before the write (Requirement 28.11), using
 *   {@link useAuth}'s `session.username`.
 * - **Elenco** — a manual add/edit form with up-front required-field validation
 *   that highlights invalid fields in red without closing the form
 *   (Requirement 28.10), a delete action guarded by a confirmation {@link Modal}
 *   showing the player's name, and a JSON batch import validated by the Service
 *   with partial-success feedback (Requirements 28.5, 31.5).
 * - **Partidas** — a JSON batch import (Requirement 28.6), a per-fixture
 *   `liberado` toggle that releases a match for community rating
 *   (Requirement 28.8), and a lineup editor {@link Modal} that persists the
 *   called-up players, replacing any previous lineup (Requirement 28.7).
 *
 * Each section shows {@link Skeleton}s while its data loads and an
 * {@link EmptyState} on load failure or empty data; every outcome surfaces a
 * {@link useToast} notification. All styling comes from Design_Tokens via the
 * co-located CSS module (Requirement 3.4) and every string is resolved through
 * {@link useI18n} (Requirements 2.4, 3.3).
 */
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@components/controls';
import { EmptyState, Modal, Skeleton } from '@components/feedback';
import { useServices } from '@/context/ServicesContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useQuery } from '@hooks/useQuery';
import { useI18n } from '@i18n/index';
import type { I18nKey } from '@i18n/keys';
import type { Fixture, Player, Position, User } from '@/types/domain';
import type { BatchResult, PlayerInput } from '@/types/service';
import styles from './AdminPage.module.css';

/** The three management areas of the admin panel. */
type AdminTab = 'users' | 'squad' | 'fixtures';

/** Tab descriptors rendered in the top navigation (Requirement 28.1). */
const TABS: ReadonlyArray<{ id: AdminTab; labelKey: I18nKey }> = [
  { id: 'users', labelKey: 'admin.tab.users' },
  { id: 'squad', labelKey: 'admin.tab.squad' },
  { id: 'fixtures', labelKey: 'admin.tab.fixtures' },
];

/** Player field-position options for the manual add/edit form. */
const POSITION_OPTIONS: ReadonlyArray<{ value: Position; labelKey: I18nKey }> = [
  { value: 'Goalkeeper', labelKey: 'position.goalkeeper' },
  { value: 'Defender', labelKey: 'position.defender' },
  { value: 'Midfielder', labelKey: 'position.midfielder' },
  { value: 'Attacker', labelKey: 'position.attacker' },
];

/** Formats an ISO date string as a pt-BR short date, or `—` when absent. */
function formatDate(iso: string): string {
  if (!iso) return '\u2014';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('pt-BR');
}

/**
 * The admin panel shell: renders the header, tab navigation and the active
 * management area.
 *
 * @returns The `/admin` route composition.
 */
export function AdminPage(): JSX.Element {
  const { t } = useI18n();
  const [tab, setTab] = useState<AdminTab>('users');

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('admin.title')}</h1>
        <p className={styles.subtitle}>{t('admin.subtitle')}</p>
      </header>

      <nav className={styles.tabs} role="tablist" aria-label={t('admin.title')}>
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            className={`${styles.tab} ${tab === entry.id ? styles.tabActive : ''}`}
            onClick={() => setTab(entry.id)}
          >
            {t(entry.labelKey)}
          </button>
        ))}
      </nav>

      {tab === 'users' && <UsersTab />}
      {tab === 'squad' && <SquadTab />}
      {tab === 'fixtures' && <FixturesTab />}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Batch import (Requirements 28.5, 28.6, 31.5)
// ---------------------------------------------------------------------------

/** Props for {@link BatchImportPanel}. */
interface BatchImportPanelProps {
  /** i18n key for the panel heading (players or fixtures). */
  readonly titleKey: I18nKey;
  /** Runs the Service batch import over the parsed JSON array. */
  readonly importFn: (items: unknown[]) => Promise<BatchResult>;
  /** Invoked after a successful (full or partial) import to refresh the list. */
  readonly onDone: () => void;
}

/**
 * A JSON textarea + import action that parses the input into an array and runs
 * a Service `importBatch`, translating the {@link BatchResult} into a toast:
 * full success, partial success (Requirement 31.5), or whole-batch rejection
 * when up-front required-field validation fails (Requirements 28.5, 28.6).
 *
 * @param props - See {@link BatchImportPanelProps}.
 * @returns The batch-import panel.
 */
function BatchImportPanel({ titleKey, importFn, onDone }: BatchImportPanelProps): JSX.Element {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      showToast('error', 'admin.import.parseError');
      return;
    }
    if (!Array.isArray(parsed)) {
      showToast('error', 'admin.import.parseError');
      return;
    }

    setBusy(true);
    const result = await importFn(parsed);
    setBusy(false);

    if (result.ok) {
      showToast('success', 'admin.import.success', { count: result.succeeded });
      setText('');
      onDone();
    } else if (result.succeeded > 0) {
      // Partial success: some items persisted, others failed (Requirement 31.5).
      showToast('info', 'admin.import.partial', {
        succeeded: result.succeeded,
        failed: result.failed,
      });
      setText('');
      onDone();
    } else {
      // Whole-batch rejection: validation failed, nothing persisted.
      showToast('error', 'admin.import.rejected', { failed: result.failed });
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={`import-${titleKey}`}>
          {t(titleKey)}
        </label>
        <textarea
          id={`import-${titleKey}`}
          className={styles.textarea}
          value={text}
          placeholder={t('admin.import.placeholder')}
          onChange={(event) => setText(event.target.value)}
        />
      </div>
      <div className={styles.formActions}>
        <Button
          variant="primary"
          labelKey="admin.import.submit"
          loading={busy}
          disabled={text.trim().length === 0}
          onClick={() => void submit()}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Users tab (Requirements 28.1, 28.2, 28.11)
// ---------------------------------------------------------------------------

/** Maps a user status to its badge class and label key. */
const STATUS_META: Record<User['status'], { className: string; labelKey: I18nKey }> = {
  pending: { className: styles.badgePending, labelKey: 'admin.users.statusPending' },
  approved: { className: styles.badgeApproved, labelKey: 'admin.users.statusApproved' },
  rejected: { className: styles.badgeRejected, labelKey: 'admin.users.statusRejected' },
};

/**
 * User management: lists every account and exposes approve / reject and
 * promote / demote actions, preventing the current admin from demoting
 * themselves (Requirements 28.1, 28.2, 28.11).
 *
 * @returns The users management panel.
 */
function UsersTab(): JSX.Element {
  const { t } = useI18n();
  const { users } = useServices();
  const { session } = useAuth();
  const { showToast } = useToast();

  const query = useQuery<User[]>(() => users.getUsers(), []);
  const [busy, setBusy] = useState<string | null>(null);

  const loading = query.loading && query.data === undefined;
  const failed = query.error !== null && query.data === undefined;
  const list = query.data ?? [];

  /** Runs a write, then toasts the outcome and refreshes the list. */
  const run = async (
    username: string,
    write: () => Promise<{ ok: boolean }>,
    successKey: I18nKey,
  ): Promise<void> => {
    setBusy(username);
    const result = await write();
    setBusy(null);
    if (result.ok) {
      showToast('success', successKey);
      query.refetch();
    } else {
      showToast('error', 'admin.actionFailed');
    }
  };

  if (loading) {
    return <Skeleton shape="list" count={6} />;
  }
  if (failed || list.length === 0) {
    return (
      <EmptyState
        messageKey={failed ? 'admin.users.loadError' : 'admin.users.empty'}
        actionKey="common.retry"
        onAction={() => query.refetch()}
      />
    );
  }

  return (
    <div className={styles.panel} role="tabpanel">
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('admin.users.colUser')}</th>
              <th>{t('admin.users.colEmail')}</th>
              <th>{t('admin.users.colStatus')}</th>
              <th>{t('admin.users.colRole')}</th>
              <th>{t('admin.users.colCreated')}</th>
              <th>{t('admin.users.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((user) => {
              const isSelf = user.username === session?.username;
              const isAdmin = user.role === 'admin';
              const status = STATUS_META[user.status];
              const rowBusy = busy === user.username;
              return (
                <tr key={user.username}>
                  <td>{user.username}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`${styles.badge} ${status.className}`}>
                      {t(status.labelKey)}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${styles.badgeRole}`}>
                      {t(isAdmin ? 'admin.users.roleAdmin' : 'admin.users.roleUser')}
                    </span>
                  </td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>
                    <div className={styles.actions}>
                      {user.status !== 'approved' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          labelKey="admin.users.approve"
                          loading={rowBusy}
                          onClick={() =>
                            void run(
                              user.username,
                              () => users.setStatus(user.username, 'approved'),
                              'admin.users.statusUpdated',
                            )
                          }
                        />
                      )}
                      {user.status !== 'rejected' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          labelKey="admin.users.reject"
                          loading={rowBusy}
                          onClick={() =>
                            void run(
                              user.username,
                              () => users.setStatus(user.username, 'rejected'),
                              'admin.users.statusUpdated',
                            )
                          }
                        />
                      )}
                      {isAdmin ? (
                        <Button
                          variant="danger"
                          size="sm"
                          labelKey="admin.users.demote"
                          // Prevent self-demotion (Requirement 28.11).
                          disabled={isSelf}
                          loading={rowBusy}
                          onClick={() => {
                            if (isSelf) {
                              showToast('error', 'admin.users.cannotDemoteSelf');
                              return;
                            }
                            void run(
                              user.username,
                              () => users.setRole(user.username, 'user'),
                              'admin.users.roleUpdated',
                            );
                          }}
                        />
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          labelKey="admin.users.promote"
                          loading={rowBusy}
                          onClick={() =>
                            void run(
                              user.username,
                              () => users.setRole(user.username, 'admin'),
                              'admin.users.roleUpdated',
                            )
                          }
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Squad tab (Requirements 28.5, 28.10 + CRUD)
// ---------------------------------------------------------------------------

/** Validation errors for the required player fields (Requirement 28.10). */
interface PlayerFormErrors {
  id?: I18nKey;
  name?: I18nKey;
  position?: I18nKey;
}

/** Props for {@link PlayerForm}. */
interface PlayerFormProps {
  /** `add` creates a new player; `edit` updates an existing one. */
  readonly mode: 'add' | 'edit';
  /** Seed values when editing an existing player. */
  readonly initial?: Player;
  /** Whether a write is in flight. */
  readonly busy: boolean;
  /** Invoked with a valid {@link PlayerInput} once client validation passes. */
  readonly onSubmit: (input: PlayerInput) => void;
  /** Invoked when the form is dismissed without saving. */
  readonly onCancel: () => void;
}

/**
 * Manual add/edit player form. Validates the required fields (`id`, `name`,
 * `position`) on submit and, if any is empty, highlights it with a red border
 * and a specific message without submitting or closing the form
 * (Requirement 28.10). The `id` field is read-only in edit mode since it is the
 * upsert key.
 *
 * @param props - See {@link PlayerFormProps}.
 * @returns The player form body (rendered inside a {@link Modal}).
 */
function PlayerForm({ mode, initial, busy, onSubmit, onCancel }: PlayerFormProps): JSX.Element {
  const { t } = useI18n();
  const [id, setId] = useState(initial?.id ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [position, setPosition] = useState<Position | ''>(initial?.position ?? '');
  const [number, setNumber] = useState(initial?.number != null ? String(initial.number) : '');
  const [nationality, setNationality] = useState(initial?.nationality ?? '');
  const [photo, setPhoto] = useState(initial?.photo ?? '');
  const [errors, setErrors] = useState<PlayerFormErrors>({});

  const handleSubmit = (): void => {
    const next: PlayerFormErrors = {};
    if (id.trim() === '') next.id = 'admin.squad.required.id';
    if (name.trim() === '') next.name = 'admin.squad.required.name';
    if (position === '') next.position = 'admin.squad.required.position';
    setErrors(next);
    // Any empty required field aborts the submit and keeps the form open.
    if (next.id || next.name || next.position) return;

    onSubmit({
      id: id.trim(),
      name: name.trim(),
      position: position as Position,
      number: number.trim() === '' ? null : Number(number),
      nationality: nationality.trim() === '' ? null : nationality.trim(),
      photo: photo.trim() === '' ? null : photo.trim(),
    });
  };

  return (
    <div className={styles.form}>
      <div className={styles.formGrid}>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="player-id">
            {t('admin.squad.field.id')}
          </label>
          <input
            id="player-id"
            className={`${styles.input} ${errors.id ? styles.inputInvalid : ''}`}
            value={id}
            disabled={mode === 'edit'}
            aria-invalid={errors.id !== undefined}
            onChange={(event) => setId(event.target.value)}
          />
          {errors.id && <span className={styles.fieldError}>{t(errors.id)}</span>}
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="player-name">
            {t('admin.squad.field.name')}
          </label>
          <input
            id="player-name"
            className={`${styles.input} ${errors.name ? styles.inputInvalid : ''}`}
            value={name}
            aria-invalid={errors.name !== undefined}
            onChange={(event) => setName(event.target.value)}
          />
          {errors.name && <span className={styles.fieldError}>{t(errors.name)}</span>}
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="player-position">
            {t('admin.squad.field.position')}
          </label>
          <select
            id="player-position"
            className={`${styles.select} ${errors.position ? styles.inputInvalid : ''}`}
            value={position}
            aria-invalid={errors.position !== undefined}
            onChange={(event) => setPosition(event.target.value as Position | '')}
          >
            <option value="">{t('common.select')}</option>
            {POSITION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
          {errors.position && <span className={styles.fieldError}>{t(errors.position)}</span>}
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="player-number">
            {t('admin.squad.field.number')}
          </label>
          <input
            id="player-number"
            className={styles.input}
            type="number"
            value={number}
            onChange={(event) => setNumber(event.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="player-nationality">
            {t('admin.squad.field.nationality')}
          </label>
          <input
            id="player-nationality"
            className={styles.input}
            value={nationality}
            onChange={(event) => setNationality(event.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="player-photo">
            {t('admin.squad.field.photo')}
          </label>
          <input
            id="player-photo"
            className={styles.input}
            value={photo}
            onChange={(event) => setPhoto(event.target.value)}
          />
        </div>
      </div>

      <div className={styles.formActions}>
        <Button variant="ghost" labelKey="common.cancel" onClick={onCancel} />
        <Button variant="primary" labelKey="common.save" loading={busy} onClick={handleSubmit} />
      </div>
    </div>
  );
}

/**
 * Squad management: a sortable player table with manual add/edit, a
 * confirmation-guarded delete and a validated JSON batch import
 * (Requirements 28.5, 28.10).
 *
 * @returns The squad management panel.
 */
function SquadTab(): JSX.Element {
  const { t } = useI18n();
  const { squad } = useServices();
  const { showToast } = useToast();

  const query = useQuery<Player[]>(() => squad.getSquad(), []);
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Player | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Player | null>(null);
  const [busy, setBusy] = useState(false);

  const loading = query.loading && query.data === undefined;
  const failed = query.error !== null && query.data === undefined;
  const list = query.data ?? [];

  const closeForm = (): void => {
    setFormMode(null);
    setEditing(null);
  };

  const submitForm = async (input: PlayerInput): Promise<void> => {
    setBusy(true);
    const result =
      formMode === 'edit'
        ? await squad.updatePlayer(input.id, input)
        : await squad.addPlayer(input);
    setBusy(false);
    if (result.ok) {
      showToast('success', formMode === 'edit' ? 'admin.squad.updated' : 'admin.squad.added');
      closeForm();
      query.refetch();
    } else {
      showToast('error', 'admin.actionFailed');
    }
  };

  const confirmDelete = async (): Promise<void> => {
    if (deleteTarget === null) return;
    setBusy(true);
    const result = await squad.deletePlayer(deleteTarget.id);
    setBusy(false);
    if (result.ok) {
      showToast('success', 'admin.squad.deleted');
      setDeleteTarget(null);
      query.refetch();
    } else {
      showToast('error', 'admin.actionFailed');
    }
  };

  return (
    <div className={styles.panel} role="tabpanel">
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>{t('admin.squad.title')}</h2>
        <Button
          variant="primary"
          size="sm"
          labelKey="admin.squad.addTitle"
          onClick={() => {
            setEditing(null);
            setFormMode('add');
          }}
        />
      </div>

      {loading && <Skeleton shape="list" count={6} />}

      {!loading && (failed || list.length === 0) && (
        <EmptyState
          messageKey={failed ? 'admin.squad.loadError' : 'admin.squad.empty'}
          actionKey="common.retry"
          onAction={() => query.refetch()}
        />
      )}

      {!loading && !failed && list.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('admin.squad.colName')}</th>
                <th>{t('admin.squad.colPosition')}</th>
                <th>{t('admin.squad.colNumber')}</th>
                <th>{t('admin.squad.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((player) => (
                <tr key={player.id}>
                  <td>{player.name}</td>
                  <td>{player.position}</td>
                  <td>{player.number ?? '\u2014'}</td>
                  <td>
                    <div className={styles.actions}>
                      <Button
                        variant="secondary"
                        size="sm"
                        labelKey="common.edit"
                        onClick={() => {
                          setEditing(player);
                          setFormMode('edit');
                        }}
                      />
                      <Button
                        variant="danger"
                        size="sm"
                        labelKey="common.delete"
                        onClick={() => setDeleteTarget(player)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BatchImportPanel
        titleKey="admin.import.playersTitle"
        importFn={(items) => squad.importBatch(items as PlayerInput[])}
        onDone={() => query.refetch()}
      />

      {/* Add / edit form (Requirement 28.10). */}
      <Modal
        open={formMode !== null}
        onClose={closeForm}
        titleKey={formMode === 'edit' ? 'admin.squad.editTitle' : 'admin.squad.addTitle'}
      >
        {formMode !== null && (
          <PlayerForm
            mode={formMode}
            {...(editing !== null ? { initial: editing } : {})}
            busy={busy}
            onSubmit={(input) => void submitForm(input)}
            onCancel={closeForm}
          />
        )}
      </Modal>

      {/* Delete confirmation with the player's name (Requirement 28.3). */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        titleKey="admin.squad.deleteTitle"
      >
        <p className={styles.confirmText}>
          {t('admin.squad.deleteConfirm', { name: deleteTarget?.name ?? '' })}
        </p>
        <div className={styles.modalActions}>
          <Button variant="ghost" labelKey="common.cancel" onClick={() => setDeleteTarget(null)} />
          <Button
            variant="danger"
            labelKey="common.delete"
            loading={busy}
            onClick={() => void confirmDelete()}
          />
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fixtures tab (Requirements 28.6, 28.7, 28.8)
// ---------------------------------------------------------------------------

/** Props for {@link LineupEditor}. */
interface LineupEditorProps {
  /** Fixture whose lineup is being edited. */
  readonly fixture: Fixture;
  /** Full squad from which players are called up. */
  readonly players: Player[];
  /** Invoked after a successful save or on dismissal. */
  readonly onClose: () => void;
}

/**
 * Lineup editor: loads the fixture's current lineup, lets the admin toggle each
 * squad player, and persists the selection — replacing any previous lineup
 * (Requirement 28.7).
 *
 * @param props - See {@link LineupEditorProps}.
 * @returns The lineup editor body (rendered inside a {@link Modal}).
 */
function LineupEditor({ fixture, players, onClose }: LineupEditorProps): JSX.Element {
  const { t } = useI18n();
  const { fixtures } = useServices();
  const { showToast } = useToast();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void fixtures.getLineup(fixture.id).then((lineup) => {
      if (active) {
        setSelected(new Set(lineup.playerIds));
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [fixtures, fixture.id]);

  const toggle = (playerId: string): void => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  };

  const save = async (): Promise<void> => {
    setBusy(true);
    const result = await fixtures.saveLineup(fixture.id, [...selected]);
    setBusy(false);
    if (result.ok) {
      showToast('success', 'admin.lineup.saved');
      onClose();
    } else {
      showToast('error', 'admin.actionFailed');
    }
  };

  if (loading) {
    return <Skeleton shape="list" count={6} />;
  }
  if (players.length === 0) {
    return <EmptyState messageKey="admin.lineup.empty" />;
  }

  return (
    <div className={styles.form}>
      <span className={styles.lineupCount}>
        {t('admin.lineup.selected', { count: selected.size })}
      </span>
      <div className={styles.lineupList}>
        {players.map((player) => (
          <label key={player.id} className={styles.lineupRow}>
            <input
              type="checkbox"
              checked={selected.has(player.id)}
              onChange={() => toggle(player.id)}
            />
            <span>
              {player.number != null ? `${player.number}. ` : ''}
              {player.name}
            </span>
          </label>
        ))}
      </div>
      <div className={styles.modalActions}>
        <Button variant="ghost" labelKey="common.cancel" onClick={onClose} />
        <Button variant="primary" labelKey="common.save" loading={busy} onClick={() => void save()} />
      </div>
    </div>
  );
}

/**
 * Fixtures management: a validated JSON batch import (Requirement 28.6), a
 * per-fixture `liberado` toggle that releases a match for community rating
 * (Requirement 28.8), and access to the lineup editor (Requirement 28.7).
 *
 * @returns The fixtures management panel.
 */
function FixturesTab(): JSX.Element {
  const { t } = useI18n();
  const { fixtures, squad } = useServices();
  const { showToast } = useToast();

  const query = useQuery<Fixture[]>(() => fixtures.getFixtures(), []);
  const squadQuery = useQuery<Player[]>(() => squad.getSquad(), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [lineupFixture, setLineupFixture] = useState<Fixture | null>(null);

  const loading = query.loading && query.data === undefined;
  const failed = query.error !== null && query.data === undefined;
  const list = query.data ?? [];
  const players = useMemo(() => squadQuery.data ?? [], [squadQuery.data]);

  const toggleLiberado = async (fixture: Fixture): Promise<void> => {
    setBusy(fixture.id);
    const next = !fixture.liberado;
    const result = await fixtures.setLiberado(fixture.id, next);
    setBusy(null);
    if (result.ok) {
      showToast('success', next ? 'admin.fixtures.liberadoOn' : 'admin.fixtures.liberadoOff');
      query.refetch();
    } else {
      showToast('error', 'admin.actionFailed');
    }
  };

  return (
    <div className={styles.panel} role="tabpanel">
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>{t('admin.fixtures.title')}</h2>
      </div>

      {loading && <Skeleton shape="list" count={6} />}

      {!loading && (failed || list.length === 0) && (
        <EmptyState
          messageKey={failed ? 'admin.fixtures.loadError' : 'admin.fixtures.empty'}
          actionKey="common.retry"
          onAction={() => query.refetch()}
        />
      )}

      {!loading && !failed && list.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('admin.fixtures.title')}</th>
                <th>{t('admin.users.colStatus')}</th>
                <th>{t('admin.users.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((fixture) => {
                const rowBusy = busy === fixture.id;
                return (
                  <tr key={fixture.id}>
                    <td>
                      {fixture.homeTeam} × {fixture.awayTeam}
                      {' — '}
                      {formatDate(fixture.fixtureDate)}
                    </td>
                    <td>
                      <span
                        className={`${styles.badge} ${
                          fixture.liberado ? styles.badgeReleased : styles.badgeNotReleased
                        }`}
                      >
                        {t(fixture.liberado ? 'admin.fixtures.released' : 'admin.fixtures.notReleased')}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <Button
                          variant={fixture.liberado ? 'ghost' : 'secondary'}
                          size="sm"
                          labelKey="admin.fixtures.toggleReleased"
                          loading={rowBusy}
                          onClick={() => void toggleLiberado(fixture)}
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          labelKey="admin.fixtures.manageLineup"
                          onClick={() => setLineupFixture(fixture)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <BatchImportPanel
        titleKey="admin.import.fixturesTitle"
        importFn={(items) => fixtures.importBatch(items as Parameters<typeof fixtures.importBatch>[0])}
        onDone={() => query.refetch()}
      />

      {/* Lineup editor (Requirement 28.7). */}
      <Modal
        open={lineupFixture !== null}
        onClose={() => setLineupFixture(null)}
        titleKey="admin.lineup.editTitle"
      >
        {lineupFixture !== null && (
          <LineupEditor
            fixture={lineupFixture}
            players={players}
            onClose={() => setLineupFixture(null)}
          />
        )}
      </Modal>
    </div>
  );
}
