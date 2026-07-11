import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import words from '../../src/content/vocabulary.json';
import { createStudySession } from '../../src/domain/sessionEngine';
import { LocalStorageProgressRepository } from '../../src/storage/LocalStorageProgressRepository';
import { StudyPage } from '../../src/pages/StudyPage';

vi.mock('../../src/components/FanThemeImage', () => ({
  FanThemeImage: ({ contextKey, className }: { contextKey: string; className?: string }) => (
    <div data-testid="fan-theme-frame" data-context-key={contextKey} className={className} />
  ),
}));

const fixedNow = new Date('2026-07-10T09:00:00.000Z');
const identity = <T,>(items: T[]) => items;

function spellingSession() {
  const session = createStudySession(words, [1, 2, 3, 4, 5], [], fixedNow, identity);
  session.currentIndex = 10;
  session.phase = 'spelling';
  return session;
}

function services() {
  const repository = new LocalStorageProgressRepository(localStorage);
  const speechPlayer = { speak: vi.fn(() => true), isAvailable: () => true, getNotice: () => null };
  return { repository, speechPlayer };
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, top: 0, left: 0, right: 400, bottom: 240, width: 400, height: 240,
    toJSON: () => ({}),
  });
});

afterEach(() => vi.restoreAllMocks());

test('shows meaning and part of speech while keeping spelling out of the DOM', async () => {
  const { repository, speechPlayer } = services();
  render(<MemoryRouter><StudyPage words={words} repository={repository} speechPlayer={speechPlayer} initialSession={spellingSession()} now={() => fixedNow} /></MemoryRouter>);
  expect(screen.getByText('무릎')).toBeInTheDocument();
  expect(screen.getByText('명')).toBeInTheDocument();
  expect(screen.queryByText('knee')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '기억남' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '발음 듣기' }));
  expect(speechPlayer.speak).toHaveBeenCalledWith('knee');
});

test('answer reveal shows the term and rating buttons', async () => {
  const { repository, speechPlayer } = services();
  render(<MemoryRouter><StudyPage words={words} repository={repository} speechPlayer={speechPlayer} initialSession={spellingSession()} now={() => fixedNow} /></MemoryRouter>);
  await userEvent.click(screen.getByRole('button', { name: '정답 보기' }));
  expect(screen.getByText('knee')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '모름' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '헷갈림' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '기억남' })).toBeInTheDocument();
});

test('rating persists progress, clears the canvas and advances', async () => {
  const { repository, speechPlayer } = services();
  render(<MemoryRouter><StudyPage words={words} repository={repository} speechPlayer={speechPlayer} initialSession={spellingSession()} now={() => fixedNow} /></MemoryRouter>);
  const canvas = screen.getByRole('img', { name: /Apple Pencil 필기장/ });
  fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 10, clientY: 10, pressure: .5 });
  fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 20, clientY: 20, pressure: .5 });
  expect(canvas).toHaveAttribute('data-stroke-count', '1');
  await userEvent.click(screen.getByRole('button', { name: '정답 보기' }));
  await userEvent.click(screen.getByRole('button', { name: '기억남' }));
  expect(repository.getWordProgress('0001')).toMatchObject({ confidence: 'strong', correctCount: 1 });
  expect(repository.loadActiveSession()?.currentIndex).toBe(11);
  expect(screen.getByRole('img', { name: /Apple Pencil 필기장/ })).toHaveAttribute('data-stroke-count', '0');
});

test('I do not know records weak directly without exposing strong rating', async () => {
  const { repository, speechPlayer } = services();
  render(<MemoryRouter><StudyPage words={words} repository={repository} speechPlayer={speechPlayer} initialSession={spellingSession()} now={() => fixedNow} /></MemoryRouter>);
  expect(screen.queryByRole('button', { name: '기억남' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '모르겠어요' }));
  expect(repository.getWordProgress('0001')).toMatchObject({ confidence: 'weak', incorrectCount: 1 });
});

test('a fresh mount resumes the saved session position', async () => {
  const { repository, speechPlayer } = services();
  repository.saveActiveSession(spellingSession());
  const first = render(<MemoryRouter><StudyPage words={words} repository={repository} speechPlayer={speechPlayer} now={() => fixedNow} /></MemoryRouter>);
  await userEvent.click(screen.getByRole('button', { name: '모르겠어요' }));
  first.unmount();
  render(<MemoryRouter><StudyPage words={words} repository={repository} speechPlayer={speechPlayer} now={() => fixedNow} /></MemoryRouter>);
  expect(screen.getByText(/문제 12/)).toBeInTheDocument();
});

test('new-word progress counts rated target words instead of queue questions', () => {
  const { repository, speechPlayer } = services();
  repository.saveWordProgress({
    wordId: '0001', stage: 'recognized', confidence: 'strong', correctCount: 1, incorrectCount: 0,
    reviewStep: 0, nextReviewAt: null, lastReviewedAt: fixedNow.toISOString(), updatedAt: fixedNow.toISOString(),
  });
  const session = createStudySession(words, [1, 2, 3, 4, 5], repository.getAllWordProgress(), fixedNow, identity);
  session.currentIndex = 125;
  render(<MemoryRouter><StudyPage words={words} repository={repository} speechPlayer={speechPlayer} initialSession={session} now={() => fixedNow} /></MemoryRouter>);
  expect(screen.getByRole('progressbar', { name: '125개 신규 단어 진행률' })).toHaveAttribute('aria-valuenow', '1');
});

test('shows every selected DAY exactly and labels the selected word total', () => {
  const { repository, speechPlayer } = services();
  const session = createStudySession(words, [2, 7], [], fixedNow, identity);
  render(<MemoryRouter><StudyPage words={words} repository={repository} speechPlayer={speechPlayer} initialSession={session} now={() => fixedNow} /></MemoryRouter>);
  expect(screen.getByText('DAY 02 · DAY 07')).toBeInTheDocument();
  expect(screen.getByRole('progressbar', { name: '50개 신규 단어 진행률' })).toBeInTheDocument();
  expect(screen.queryByText(/DAY 02.*DAY 03/)).not.toBeInTheDocument();
});

test('keeps one ambient image outside prompt, writing, and Pencil content for an exact five-word block', async () => {
  const { repository, speechPlayer } = services();
  const session = spellingSession();
  session.currentIndex = 13;
  const { container } = render(<MemoryRouter><StudyPage words={words} repository={repository} speechPlayer={speechPlayer} initialSession={session} now={() => fixedNow} /></MemoryRouter>);
  const frame = screen.getByTestId('fan-theme-frame');
  const initialKey = `study:${session.id}:day-1-block-0`;
  expect(frame).toHaveAttribute('data-context-key', initialKey);
  expect(frame.closest('.prompt-card')).toBeNull();
  expect(frame.closest('.writing-card')).toBeNull();
  expect(container.querySelector('canvas')?.contains(frame)).toBe(false);
  await userEvent.click(screen.getByRole('button', { name: '정답 보기' }));
  await userEvent.click(screen.getByRole('button', { name: '기억남' }));
  expect(screen.getByTestId('fan-theme-frame')).toHaveAttribute('data-context-key', initialKey);
  await userEvent.click(screen.getByRole('button', { name: '정답 보기' }));
  await userEvent.click(screen.getByRole('button', { name: '기억남' }));
  expect(screen.getByTestId('fan-theme-frame')).toHaveAttribute('data-context-key', `study:${session.id}:day-1-block-1`);
});

test('does not couple the study image key to strong or weak outcomes', async () => {
  const strong = services();
  const session = spellingSession();
  const first = render(<MemoryRouter><StudyPage words={words} repository={strong.repository} speechPlayer={strong.speechPlayer} initialSession={session} now={() => fixedNow} /></MemoryRouter>);
  const key = screen.getByTestId('fan-theme-frame').getAttribute('data-context-key');
  await userEvent.click(screen.getByRole('button', { name: '정답 보기' }));
  await userEvent.click(screen.getByRole('button', { name: '기억남' }));
  expect(screen.getByTestId('fan-theme-frame')).toHaveAttribute('data-context-key', key);
  first.unmount();
  const weak = services();
  render(<MemoryRouter><StudyPage words={words} repository={weak.repository} speechPlayer={weak.speechPlayer} initialSession={session} now={() => fixedNow} /></MemoryRouter>);
  await userEvent.click(screen.getByRole('button', { name: '모르겠어요' }));
  expect(screen.getByTestId('fan-theme-frame')).toHaveAttribute('data-context-key', key);
});

test('uses only the session id for the larger completion image', () => {
  const { repository, speechPlayer } = services();
  const session = spellingSession();
  session.currentIndex = session.queue.length;
  session.completedAt = fixedNow.toISOString();
  render(<MemoryRouter><StudyPage words={words} repository={repository} speechPlayer={speechPlayer} initialSession={session} now={() => fixedNow} /></MemoryRouter>);
  expect(screen.getByTestId('fan-theme-frame')).toHaveAttribute('data-context-key', `study-result:${session.id}`);
});
