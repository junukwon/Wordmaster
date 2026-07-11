import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PronunciationSettings } from './PronunciationSettings';

const alex = { voiceURI: 'alex', name: 'Alex', lang: 'en-US', localService: false } as SpeechSynthesisVoice;
const samantha = { voiceURI: 'sam', name: 'Samantha', lang: 'en-US', localService: true } as SpeechSynthesisVoice;

function createPlayer(initialVoices: SpeechSynthesisVoice[] = [alex, samantha]) {
  let voices = initialVoices;
  let listener: (() => void) | undefined;
  return {
    getVoices: vi.fn(() => voices),
    getPreference: vi.fn(() => ({ mode: 'auto' as const })),
    setPreference: vi.fn(),
    preview: vi.fn(() => true),
    getNotice: vi.fn<() => string | null>(() => null),
    subscribe: vi.fn((next: () => void) => { listener = next; return () => { listener = undefined; }; }),
    updateVoices(next: SpeechSynthesisVoice[]) { voices = next; listener?.(); },
  };
}

test('is collapsed initially and lists automatic plus every installed English voice', async () => {
  const player = createPlayer();
  render(<PronunciationSettings speechPlayer={player} />);
  const details = screen.getByText('諛쒖쓬 ?ㅼ젙').closest('details');
  expect(details).not.toHaveAttribute('open');

  await userEvent.click(screen.getByText('諛쒖쓬 ?ㅼ젙'));
  const select = screen.getByLabelText('?곸뼱 ?뚯꽦 ?좏깮');
  expect(select).toHaveValue('auto');
  expect(screen.getByRole('option', { name: /Alex/ })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Samantha (en-US) · 湲곌린 ?댁옣' })).toBeInTheDocument();
});

test('persists manual selection and previews it', async () => {
  const user = userEvent.setup();
  const player = createPlayer();
  render(<PronunciationSettings speechPlayer={player} />);
  await user.click(screen.getByText('諛쒖쓬 ?ㅼ젙'));
  await user.selectOptions(screen.getByLabelText('?곸뼱 ?뚯꽦 ?좏깮'), samantha.voiceURI);
  expect(player.setPreference).toHaveBeenCalledWith({ mode: 'manual', voiceURI: 'sam', name: 'Samantha', lang: 'en-US' });
  await user.click(screen.getByRole('button', { name: '誘몃━ ?ｊ린' }));
  expect(player.preview).toHaveBeenCalledOnce();
});

test('refreshes voice options after voiceschanged without remounting', async () => {
  const player = createPlayer([]);
  render(<PronunciationSettings speechPlayer={player} />);
  await userEvent.click(screen.getByText('諛쒖쓬 ?ㅼ젙'));
  expect(screen.queryByRole('option', { name: /Samantha/ })).not.toBeInTheDocument();
  player.updateVoices([samantha]);
  expect(await screen.findByRole('option', { name: /Samantha/ })).toBeInTheDocument();
});

test('shows the current speech notice as status', async () => {
  const player = createPlayer([]);
  player.getNotice.mockReturnValue('?뚯꽦???놁뒿?덈떎.');
  render(<PronunciationSettings speechPlayer={player} />);
  await userEvent.click(screen.getByText('諛쒖쓬 ?ㅼ젙'));
  expect(screen.getByRole('status')).toHaveTextContent('?뚯꽦???놁뒿?덈떎.');
});
