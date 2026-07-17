export const STUDY_SETUP_DRAFT_KEY = 'wordmaster:study-setup-draft:v1';

export type StudySetupDraft = {
  mode: 'bundle' | 'range' | 'random';
  bundleStartDay: number | null;
  startDay: number | null;
  endDay: number | null;
  randomMode: 'random-days' | 'random-words';
  dayCount: number;
  wordCount: number;
  seed: string;
  searchQuery: string;
};

type DraftStorage = Pick<Storage, 'getItem' | 'setItem'>;

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function isDayNumber(value: unknown): value is number | null {
  return value === null || isPositiveInteger(value);
}

function isStudySetupDraft(value: unknown): value is StudySetupDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Record<string, unknown>;
  return (draft.mode === 'bundle' || draft.mode === 'range' || draft.mode === 'random')
    && isDayNumber(draft.bundleStartDay)
    && isDayNumber(draft.startDay)
    && isDayNumber(draft.endDay)
    && (draft.randomMode === 'random-days' || draft.randomMode === 'random-words')
    && isPositiveInteger(draft.dayCount)
    && isPositiveInteger(draft.wordCount)
    && typeof draft.seed === 'string'
    && typeof draft.searchQuery === 'string';
}

export function loadStudySetupDraft(
  storage: Pick<DraftStorage, 'getItem'> | null | undefined,
  defaults: StudySetupDraft,
): StudySetupDraft {
  if (!storage) return { ...defaults };
  try {
    const serialized = storage.getItem(STUDY_SETUP_DRAFT_KEY);
    if (!serialized) return { ...defaults };
    const parsed: unknown = JSON.parse(serialized);
    return isStudySetupDraft(parsed) ? parsed : { ...defaults };
  } catch {
    return { ...defaults };
  }
}

export function saveStudySetupDraft(
  storage: Pick<DraftStorage, 'setItem'> | null | undefined,
  draft: StudySetupDraft,
): void {
  if (!storage) return;
  try {
    storage.setItem(STUDY_SETUP_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Temporary setup preferences must never block study.
  }
}
