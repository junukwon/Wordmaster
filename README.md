# WordMaster

WordMaster는 DAY 01~10 중 원하는 DAY를 골라 25~250개 단어를 영어 뜻, 한글 뜻, 철자 쓰기로 학습하고 D+1·3·7·14 복습과 수시 테스트를 이어 가는 로컬 우선 PWA입니다. 로그인, 서버, 광고, 자동 채점, 음성 인식은 사용하지 않습니다.

## 로컬 실행과 검증

Node.js 22 이상과 npm이 필요합니다.

```powershell
Set-Location C:\dev\wordmaster
npm install
npm run content:build
npm run dev -- --host 0.0.0.0
```

PC에서는 `http://localhost:5173/`에 접속합니다. 같은 Wi-Fi의 iPad에서는 `ipconfig`로 PC IPv4 주소를 확인한 뒤 `http://<PC의-IPv4-주소>:5173/`을 엽니다. production 확인은 `npm run build` 후 `npm run preview -- --host 0.0.0.0`으로 합니다.

전체 검증 명령은 다음과 같습니다.

```powershell
npm run content:build
npm test
npm run build
npm run test:e2e
```

Playwright 브라우저가 없으면 한 번 `npx playwright install chromium webkit`을 실행합니다.

## 팬테마 이미지팩

팬테마는 직접 고른 정적 이미지로 홈, 학습 보조 영역, 학습/테스트 결과 화면만 꾸밉니다. 문제 본문, Apple Pencil 캔버스, 테스트 진행 화면에는 표시되지 않으며 갤러리, 보상, 잠금 해제, 확대, 이미지 목록 기능도 없습니다.

- 지원 형식: 정적 JPEG, PNG, WebP. GIF, 동영상, APNG, 애니메이션 WebP는 거부됩니다.
- 한 번에 최대 150개, 변환 후 전체 30MB까지 저장합니다. 긴 변은 720px로 축소하며 가져오기는 완료된 새 팩으로 기존 팩 전체를 교체합니다. 추가·중복 누적하지 않습니다.
- 이미지는 기기와 브라우저 프로필의 IndexedDB에만 저장됩니다. 서버로 업로드하거나 Git/GitHub에 포함하지 않고 PWA 서비스 워커 캐시에도 넣지 않습니다.
- `팬테마 사용`을 끄면 기본 WordMaster 화면으로 돌아갑니다. `이미지팩 삭제` 후 확인하면 기기에서 팩을 완전히 지웁니다.
- 이미지 선택은 정답, 오답, 숙련도, 보상과 무관한 고정 화면 키를 사용합니다.
- 저작권과 초상권을 확인하고 개인적으로 사용할 수 있는 이미지만 가져올 책임은 사용자에게 있습니다.

### iPad의 파일 앱에서 가져오기

1. 사용할 정적 이미지를 iPad **파일** 앱의 한 폴더에 저장합니다.
2. Safari 또는 홈 화면의 WordMaster를 열고 홈에서 **팬테마 설정**을 펼칩니다.
3. **팬테마 이미지 가져오기**를 누르고 **파일 선택** 또는 **찾아보기**를 선택합니다.
4. 파일 앱에서 이미지를 여러 개 선택한 뒤 **열기**를 누릅니다.
5. 처리 완료 안내와 홈 이미지를 확인합니다. 다시 가져오면 기존 팩을 전부 교체합니다.
6. 비행기 모드에서 앱을 다시 열어 홈과 학습 화면에 이미지가 남는지 확인합니다.

Safari가 저장 공간을 정리하거나 사용자가 설정에서 해당 사이트 데이터를 삭제하면 팬테마 IndexedDB와 학습 `localStorage`, PWA 캐시가 사라질 수 있습니다. 개인 정보 보호 모드에서는 보존을 기대하지 마세요.

## 학습 기록, 오프라인, 업데이트

학습 상태, 진행 세션, 테스트 기록은 현재 브라우저의 `localStorage` 키 `wordmaster:v1`에 저장됩니다. 다른 기기나 브라우저와 동기화하지 않습니다. DAY를 추가해도 기존 단어 ID별 기록은 유지됩니다.

최초 온라인 방문을 마치면 화면, 코드, 아이콘, DAY 데이터가 PWA 캐시에 저장되어 오프라인에서도 DAY 선택, 학습, Apple Pencil 쓰기, 진행 저장, 수시 테스트가 동작합니다. 로컬 팬테마는 서비스 워커 캐시가 아니라 IndexedDB에서 오프라인으로 읽습니다. 새 버전을 배포하면 서비스 워커 캐시는 갱신되지만 학습 `localStorage`와 팬테마 IndexedDB는 삭제하지 않습니다.

발음은 기기에 설치된 영어 시스템 음성을 우선합니다. 사용할 수 없으면 발음만 제한되고 나머지 학습은 계속됩니다.

## 홈 화면 설치

1. iPad Safari에서 배포 주소를 온라인으로 한 번 엽니다.
2. **공유**를 누르고 **홈 화면에 추가**를 선택합니다.
3. 이름이 `WordMaster`인지 확인하고 **추가**를 누릅니다.
4. 홈 화면 아이콘으로 한 번 실행해 최신 캐시 설치를 마칩니다.

## GitHub Pages 배포

저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 선택하고 `main`에 push합니다. workflow가 production bundle을 만들고 배포합니다. project Pages는 `GITHUB_REPOSITORY`에서 저장소 이름을 읽어 `/<저장소>/` base를 사용하고 `<계정>.github.io` 루트 저장소는 `/`를 사용합니다.

```powershell
git remote add origin https://github.com/<계정>/<저장소>.git
git push -u origin main
```

## 단어 DAY 추가

`content/source/영어_단어_DAY01-10.md` 형식에 맞춰 연속 번호와 `## DAY NN — 주제` 아래 25개 행을 추가하고 `npm run content:build`를 실행합니다. 생성된 `src/content/vocabulary.json`과 `public/data/vocabulary.json`을 함께 커밋합니다. `npm test -- tests/content/build-vocabulary.test.ts`로 연속 ID, 중복, DAY별 25개, 오프라인 공개 사본을 검증합니다.

## iPad mini + Apple Pencil 확인

- Safari 세로/가로에서 가로 스크롤이나 잘린 버튼이 없는지, 주요 컨트롤 높이가 44px 이상인지 확인합니다.
- Pencil 선, 압력 변화, 되돌리기, 전체 지우기와 캔버스 밖 페이지 스크롤을 확인합니다.
- 정답 보기 전 답이 DOM과 화면에 없는지 확인합니다.
- 오프라인 재실행, 진도 유지, 팬테마 유지, 새 배포 뒤 학습 기록 유지를 확인합니다.

Windows Playwright WebKit은 서비스 워커 준비가 비결정적이고 브라우저에서 생성한 이미지 Blob의 IndexedDB 저장을 지원하지 않아 WebKit 프로젝트에서는 해당 오프라인 재로딩과 팬팩 Blob 가져오기만 명시적으로 건너뜁니다. 자동화는 Desktop Chrome에서 실제 파일 가져오기·IndexedDB·오프라인 여정을 실행하고, Chromium을 iPad mini 세로/가로 크기로 바꿔 앱이 실제로 렌더링한 홈·학습·완료·테스트 결과 프레임과 44px 컨트롤을 검사합니다. 실제 iPad Safari의 가져오기와 오프라인 재실행은 위 체크리스트로 별도 확인합니다.
