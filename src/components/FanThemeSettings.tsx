import { useState, type ChangeEvent } from 'react';
import { useFanTheme } from '../fanTheme/useFanTheme';

const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp';

export function FanThemeSettings() {
  const { status, importFiles, setEnabled, deletePack } = useFanTheme();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const unavailable = !status.ready || status.importing;

  const importSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    if (files.length > 0) void importFiles(files);
  };

  return (
    <section className="fan-theme-settings" aria-label="팬테마 설정">
      <p className="fan-theme-settings__guidance">새 팩 가져오기가 완료될 때까지 기존 팩은 그대로 유지됩니다.</p>
      <label className="fan-theme-settings__import">
        <span>팬테마 이미지 가져오기</span>
        <input type="file" multiple accept={ACCEPTED_IMAGE_TYPES} disabled={unavailable} onChange={importSelected} />
      </label>
      <label className="fan-theme-settings__toggle">
        <input type="checkbox" checked={status.enabled} disabled={unavailable || status.imageCount === 0}
          onChange={(event) => void setEnabled(event.currentTarget.checked)} />
        팬테마 사용
      </label>
      <button type="button" className="button button--secondary" disabled={unavailable || status.imageCount === 0}
        onClick={() => setConfirmingDelete(true)}>이미지팩 삭제</button>
      {(status.importing || status.notice) && (
        <p role="status" aria-live="polite">
          {status.importing && <>가져오는 중: {status.processed} / {status.total}. </>}
          {status.notice} {status.notice && `· ${(status.totalBytes / 1_000_000).toFixed(1)} MB`}
        </p>
      )}
      <p className="fan-theme-settings__notice">이미지는 이 기기의 사이트 데이터에 저장됩니다. 저작권이 있는 이미지는 개인적인 용도로만 사용하세요.</p>
      {confirmingDelete && (
        <div className="dialog-backdrop">
          <div className="session-dialog" role="dialog" aria-modal="true" aria-labelledby="fan-delete-title">
            <h2 id="fan-delete-title">이미지팩을 삭제할까요?</h2>
            <p>저장된 팬테마 이미지를 이 기기에서 삭제합니다.</p>
            <div className="session-dialog__actions">
              <button type="button" onClick={() => setConfirmingDelete(false)}>취소</button>
              <button type="button" onClick={() => { setConfirmingDelete(false); void deletePack(); }}>삭제 확인</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
