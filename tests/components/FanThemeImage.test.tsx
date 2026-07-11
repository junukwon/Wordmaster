import { render, screen, waitFor } from '@testing-library/react';
import { useState, type PropsWithChildren } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { FanThemeContext, type FanThemeContextValue } from '../../src/fanTheme/useFanTheme';
import { FanThemeImage } from '../../src/components/FanThemeImage';

function Provider({ blob, enabled = true, children }: PropsWithChildren<{ blob: Blob | null | Promise<Blob | null>; enabled?: boolean }>) {
  const value: FanThemeContextValue = {
    status: { ready: true, enabled, imageCount: blob ? 1 : 0, totalBytes: 1, importing: false, processed: 0, total: 0, notice: null },
    importFiles: vi.fn(), setEnabled: vi.fn(), deletePack: vi.fn(), loadImageBlob: vi.fn(async () => blob),
  };
  return <FanThemeContext.Provider value={value}>{children}</FanThemeContext.Provider>;
}

afterEach(() => vi.restoreAllMocks());

describe('FanThemeImage', () => {
  test('renders one object URL as contained foreground and hidden blurred backdrop', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fan');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const view = render(<Provider blob={new Blob(['x'])}><FanThemeImage contextKey="home:2026-07-11" /></Provider>);
    expect(await screen.findByTestId('fan-theme-foreground')).toHaveAttribute('src', 'blob:fan');
    expect(screen.getByTestId('fan-theme-backdrop')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('fan-theme-foreground')).toHaveAttribute('alt', '');
    expect(screen.getByTestId('fan-theme-foreground')).toHaveStyle({ objectFit: 'contain' });
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    view.unmount();
    expect(revoke).toHaveBeenCalledWith('blob:fan');
  });

  test.each([{ blob: null, enabled: true }, { blob: new Blob(['x']), enabled: false }])('renders nothing when unavailable or disabled', async ({ blob, enabled }) => {
    const view = render(<Provider blob={blob} enabled={enabled}><FanThemeImage contextKey="x" /></Provider>);
    await waitFor(() => expect(view.container).toBeEmptyDOMElement());
  });

  test('renders nothing when blob loading rejects', async () => {
    const view = render(<Provider blob={Promise.reject(new Error('failed'))}><FanThemeImage contextKey="x" /></Provider>);
    await waitFor(() => expect(view.container).toBeEmptyDOMElement());
  });

  test('revokes the prior URL when the context key changes', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:one').mockReturnValueOnce('blob:two');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    function Harness() {
      const [key, setKey] = useState('one');
      return <Provider blob={new Blob(['x'])}><button onClick={() => setKey('two')}>next</button><FanThemeImage contextKey={key} /></Provider>;
    }
    const view = render(<Harness />);
    expect(await screen.findByTestId('fan-theme-foreground')).toHaveAttribute('src', 'blob:one');
    screen.getByRole('button').click();
    expect(await screen.findByTestId('fan-theme-foreground')).toHaveAttribute('src', 'blob:two');
    expect(revoke).toHaveBeenCalledWith('blob:one');
    view.unmount();
  });
});
