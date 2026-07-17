import { useEffect, useState } from 'react';
import type { SpeechPlayer } from './SpeechPlayer';

export type PronunciationSpeechPlayer = Pick<
  SpeechPlayer,
  'getVoices' | 'getPreference' | 'setPreference' | 'preview' | 'getNotice' | 'subscribe'
>;

type PronunciationSettingsProps = {
  speechPlayer: PronunciationSpeechPlayer;
};

export function PronunciationSettings({ speechPlayer }: PronunciationSettingsProps) {
  const [, setRevision] = useState(0);
  const preference = speechPlayer.getPreference();
  const voices = speechPlayer.getVoices();
  const notice = speechPlayer.getNotice();

  useEffect(
    () => speechPlayer.subscribe(() => setRevision((value) => value + 1)),
    [speechPlayer],
  );

  const selectVoice = (voiceURI: string) => {
    if (voiceURI === 'auto') {
      speechPlayer.setPreference({ mode: 'auto' });
    } else {
      const voice = voices.find((candidate) => candidate.voiceURI === voiceURI);
      if (voice) {
        speechPlayer.setPreference({ mode: 'manual', voiceURI: voice.voiceURI, name: voice.name, lang: voice.lang });
      }
    }
    setRevision((value) => value + 1);
  };

  return (
    <details className="pronunciation-settings">
      <summary>발음 설정</summary>
      <div className="pronunciation-settings__controls">
        <label htmlFor="pronunciation-voice">영어 음성 선택</label>
        <select
          id="pronunciation-voice"
          value={preference.mode === 'manual' ? preference.voiceURI : 'auto'}
          onChange={(event) => selectVoice(event.currentTarget.value)}
        >
          <option value="auto">자동 선택</option>
          {voices.map((voice) => (
            <option key={voice.voiceURI} value={voice.voiceURI}>
              {voice.name} ({voice.lang}){voice.localService ? ' · 기기 내장' : ''}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => speechPlayer.preview()}>미리 듣기</button>
      </div>
      {notice && <p className="pronunciation-settings__notice" role="status">{notice}</p>}
    </details>
  );
}
