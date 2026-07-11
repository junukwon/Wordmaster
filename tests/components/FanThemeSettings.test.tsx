import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FanThemeSettings } from '../../src/components/FanThemeSettings';
import { FanThemeContext, type FanThemeContextValue } from '../../src/fanTheme/useFanTheme';

const base: FanThemeContextValue = {
  status: { ready: true, enabled: true, imageCount: 2, totalBytes: 1_500_000, importing: false, processed: 0, total: 0, notice: null },
  importFiles: vi.fn(async () => undefined), setEnabled: vi.fn(async () => undefined),
  deletePack: vi.fn(async () => undefined), loadImageBlob: vi.fn(async () => null),
};

function show(value: FanThemeContextValue = base) {
  return render(<FanThemeContext.Provider value={value}><FanThemeSettings /></FanThemeContext.Provider>);
}

test('imports every selected supported image in one call without showing a gallery', async () => {
  const user = userEvent.setup();
  show();
  const input = screen.getByLabelText('팬테마 이미지 가져오기');
  expect(input).toHaveAttribute('multiple');
  expect(input).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
  const files = [new File(['a'], 'a.jpg', { type: 'image/jpeg' }), new File(['b'], 'b.png', { type: 'image/png' })];
  await user.upload(input, files);
  expect(base.importFiles).toHaveBeenCalledWith(files);
  expect(screen.queryByRole('link', { name: /팬팩|이미지 보기/ })).not.toBeInTheDocument();
});

test('shows import progress, result notice, replacement guidance, and data notice', () => {
  show({ ...base, status: { ...base.status, importing: true, processed: 3, total: 5, notice: '3개 가져옴 · 2개 건너뜀 · 1.4 MB' } });
  expect(screen.getByRole('status')).toHaveTextContent('3 / 5');
  expect(screen.getByRole('status')).toHaveTextContent('3개 가져옴');
  expect(screen.getByText(/완료될 때까지 기존 팩/)).toBeInTheDocument();
  expect(screen.getByText(/사이트 데이터.*저작권/)).toBeInTheDocument();
});

test('toggle does not delete and deletion requires confirmation', async () => {
  const user = userEvent.setup();
  show();
  await user.click(screen.getByRole('checkbox', { name: '팬테마 사용' }));
  expect(base.setEnabled).toHaveBeenCalledWith(false);
  expect(base.deletePack).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: '이미지팩 삭제' }));
  expect(base.deletePack).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '삭제 확인' }));
  expect(base.deletePack).toHaveBeenCalledOnce();
});

test('delete dialog manages focus, traps keyboard navigation, closes with Escape, and restores its trigger', async () => {
  const user = userEvent.setup();
  show();
  const trigger = screen.getByRole('button', { name: '이미지팩 삭제' });
  await user.click(trigger);
  const dialog = screen.getByRole('dialog');
  const cancel = screen.getByRole('button', { name: '취소' });
  const confirm = screen.getByRole('button', { name: '삭제 확인' });
  expect(cancel).toHaveFocus();

  await user.tab({ shift: true });
  expect(confirm).toHaveFocus();
  await user.tab();
  expect(cancel).toHaveFocus();
  expect(dialog).toBeInTheDocument();

  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

test('keeps deletion dialog sane when the provider handles a failed delete', async () => {
  const user = userEvent.setup();
  show({ ...base, status: { ...base.status, notice: '이미지팩을 삭제하지 못했습니다.', noticeType: 'error' } });
  await user.click(screen.getByRole('button', { name: '이미지팩 삭제' }));
  await user.click(screen.getByRole('button', { name: '삭제 확인' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('삭제하지 못했습니다');
});
