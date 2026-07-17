import {
  loadStudySetupDraft,
  saveStudySetupDraft,
  STUDY_SETUP_DRAFT_KEY,
  type StudySetupDraft,
} from '../../src/storage/StudySetupDraftRepository';

const defaults = {
  mode: 'bundle',
  bundleStartDay: 1,
  startDay: 1,
  endDay: 1,
  randomMode: 'random-days',
  dayCount: 1,
  wordCount: 25,
  seed: 'initial',
  searchQuery: '',
} satisfies StudySetupDraft;

beforeEach(() => sessionStorage.clear());

test('saves and restores a valid study setup draft', () => {
  const draft = {
    ...defaults,
    mode: 'range' as const,
    startDay: 4,
    endDay: 7,
    searchQuery: '학교',
  };

  saveStudySetupDraft(sessionStorage, draft);

  expect(loadStudySetupDraft(sessionStorage, defaults)).toEqual(draft);
});

test('returns defaults for malformed or invalid stored drafts', () => {
  sessionStorage.setItem(STUDY_SETUP_DRAFT_KEY, '{broken');
  expect(loadStudySetupDraft(sessionStorage, defaults)).toEqual(defaults);

  sessionStorage.setItem(STUDY_SETUP_DRAFT_KEY, JSON.stringify({ ...defaults, dayCount: 0 }));
  expect(loadStudySetupDraft(sessionStorage, defaults)).toEqual(defaults);
});

test('isolates storage read and write failures', () => {
  const throwingStorage = {
    getItem: () => { throw new Error('read blocked'); },
    setItem: () => { throw new Error('write blocked'); },
  };

  expect(loadStudySetupDraft(throwingStorage, defaults)).toEqual(defaults);
  expect(() => saveStudySetupDraft(throwingStorage, defaults)).not.toThrow();
});
