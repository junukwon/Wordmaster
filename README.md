# WordMaster

WordMaster는 중학생이 DAY 01~20의 단어를 원하는 범위로 나누어 영어→뜻, 뜻→영어, Apple Pencil 철자 필기로 집중 학습하고 D+1·3·7·14 복습과 수시 테스트를 이어갈 수 있는 로컬 우선 PWA입니다. 로그인, 서버, 손글씨 자동 인식, 음성 인식, 발음 평가는 포함하지 않습니다.

## 로컬 실행

Node.js 22 이상과 npm이 필요합니다.

```powershell
Set-Location C:\dev\wordmaster
npm install
npm run content:build
npm run dev -- --host 0.0.0.0
```

PC에서는 `http://localhost:5173/`에 접속합니다. 같은 Wi-Fi의 iPad에서는 Windows에서 `ipconfig`로 PC의 IPv4 주소를 확인한 뒤 `http://<PC의-IPv4-주소>:5173/`에 접속합니다. Windows 방화벽이 묻는 경우 현재 개인 네트워크에서 Node.js의 접근을 허용해야 합니다.

production build를 로컬에서 확인하려면 다음을 실행합니다.

```powershell
npm run build
npm run preview -- --host 0.0.0.0
```

preview 기본 주소는 `http://localhost:4173/`입니다.

## 개발 및 검증 명령

```powershell
npm run content:build
npm test
npm run build
npm run test:e2e
```

Playwright 브라우저가 아직 없다면 최초 한 번 `npx playwright install chromium webkit`을 실행합니다.

## 학습 범위 선택

홈에서 **학습 범위 선택하기**를 누르면 다음 세 가지 방식으로 시작할 수 있습니다.

- **묶음으로 선택**: DAY 01~05, DAY 06~10처럼 5일 단위 묶음을 선택합니다. 마지막 묶음은 남은 DAY만 포함합니다.
- **범위로 선택**: 시작 DAY와 종료 DAY를 직접 골라 연속 범위를 학습합니다.
- **랜덤으로 선택**: 전체 단어장에서 랜덤 DAY 묶음 또는 랜덤 단어 세트를 선택합니다. 랜덤 단어 수는 10·25·50·125개이며 기본값은 25개입니다.

선택 결과와 단어 수는 시작 화면에서 확인할 수 있고, 학습을 시작하면 해당 세션에 고정됩니다. `다시 뽑기`를 누를 때만 랜덤 결과가 바뀝니다. 기존의 오늘 복습(D+1·3·7·14)은 학습 범위 선택과 별도로 홈에서 계속 확인합니다.

## 단어 DAY 추가

1. `content/source/영어_단어_DAY01-10.md` 또는 `content/source/영어_단어_DAY11-20.md`의 형식과 연속 번호를 유지해 새 `## DAY NN — 주제`와 25개 행을 추가합니다. 현재 DAY 01~20, 총 500개 단어가 포함돼 있습니다.
2. 각 행의 번호, 단어, 품사, 뜻이 비어 있지 않은지 확인합니다.
3. `npm run content:build`를 실행합니다.
4. 생성된 `src/content/vocabulary.json`과 `public/data/vocabulary.json`을 함께 커밋합니다.
5. `npm test -- tests/content/build-vocabulary.test.ts`로 연속 ID, 중복, DAY별 25개와 오프라인 공개 사본을 검증합니다.

새 DAY가 추가돼도 학습 기록은 단어 ID별로 `localStorage`에 따로 보존됩니다.

## 학습 기록 저장과 초기화

- 학습 상태, 진행 중 세션, 테스트 이력은 현재 브라우저의 `localStorage` 키 `wordmaster:v1`에 저장됩니다.
- 손글씨 획과 이미지는 저장하지 않습니다.
- 기기 또는 브라우저 사이에 기록을 동기화하지 않습니다.
- 의도적으로 초기화하려면 브라우저 개발자 도구에서 `localStorage.removeItem('wordmaster:v1')`을 실행하거나 Safari의 해당 사이트 데이터를 삭제합니다. 사이트 데이터를 삭제하면 진도와 PWA 캐시가 모두 사라질 수 있습니다.

## GitHub Pages 최초 배포

GitHub 계정과 저장소는 이 프로젝트가 임의로 만들지 않습니다. 아래 단계에서 `<계정>`과 `<저장소>`를 실제 값으로 바꿉니다.

1. GitHub에서 빈 저장소를 직접 만듭니다.
2. 저장소의 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 선택합니다.
3. 로컬 저장소에 원격을 연결하고 `main`을 push합니다.

```powershell
Set-Location C:\dev\wordmaster
git remote add origin https://github.com/<계정>/<저장소>.git
git push -u origin main
```

4. GitHub의 **Actions** 탭에서 `Deploy WordMaster to GitHub Pages`가 성공했는지 확인합니다.
5. 배포 주소 `https://<계정>.github.io/<저장소>/`에 Safari로 접속합니다.

Actions 빌드는 `GITHUB_REPOSITORY`에서 저장소명을 읽어 project Pages의 Vite base 경로를 자동으로 `/<저장소>/`로 설정합니다. `<계정>.github.io` 루트 Pages 저장소는 `/`를 사용합니다. 계정이나 저장소명을 코드에 하드코딩할 필요가 없습니다.

## 새 버전 업데이트

변경 후 네 검증 명령을 실행하고 `main`에 push하면 같은 Actions workflow가 새 bundle을 만들고 자동 재배포합니다.

```powershell
git add <변경한-파일>
git commit -m "설명"
git push origin main
```

서비스 워커는 새 HTML·JavaScript·CSS·아이콘·단어 JSON을 받아 오래된 precache를 정리합니다. 앱 캐시 갱신은 `localStorage`의 `wordmaster:v1`을 삭제하지 않으므로 기존 학습 기록은 유지됩니다.

## iPad 홈 화면에 추가

1. iPad Safari에서 배포 주소를 온라인으로 한 번 완전히 엽니다.
2. Safari의 **공유** 버튼을 누릅니다.
3. **홈 화면에 추가**를 선택합니다.
4. 이름이 `WordMaster`인지 확인하고 **추가**를 누릅니다.
5. 홈 화면 아이콘으로 한 번 실행해 최신 캐시 설치를 마칩니다.

## 오프라인 사용 조건

- 최초 한 번은 온라인으로 앱 전체를 열어 서비스 워커와 학습 자산을 설치해야 합니다.
- 이후 앱 화면, JavaScript, CSS, 아이콘, DAY 01~20 JSON은 캐시되어 앱 시작, 단어 학습, Apple Pencil 필기, 진도 저장, 수시 테스트가 오프라인에서 동작합니다.
- 진도 저장은 기기 내부 `localStorage`이므로 오프라인에서도 작동합니다.
- 발음은 영어 음성 중 `localService === true`인 시스템 음성을 우선합니다. 로컬 영어 음성이 없으면 발음 재생에 인터넷 연결이 필요하거나 iPad 설정에서 영어 음성을 설치해야 할 수 있습니다. 발음이 없어도 다른 학습은 계속됩니다.
- Safari의 사이트 데이터 삭제, 개인 정보 보호 모드, 저장 공간 정리는 캐시나 진도를 지울 수 있습니다.

## iPad mini + Apple Pencil 직접 확인 체크리스트

- Safari 가로와 세로에서 가로 스크롤이나 잘린 버튼이 없는지 확인
- 모든 주요 버튼이 손가락으로 누르기 충분한지 확인
- Pencil로 선을 쓰고 압력 변화, 되돌리기, 전체 지우기가 작동하는지 확인
- Canvas 안에서 필기할 때만 페이지 스크롤이 멈추고 바깥에서는 정상 스크롤하는지 확인
- 정답 보기 전 뜻→영어·철자 문제의 영어 철자가 DOM과 화면에 없는지 확인
- 로컬 영어 음성의 발음 버튼과 로컬 음성이 없을 때 안내를 확인
- Safari 종료 후 같은 문제 위치에서 이어지는지 확인
- 홈 화면 설치 후 standalone 화면과 아이콘을 확인
- 온라인 최초 실행 후 비행기 모드에서 앱 시작, 필기, 평가, 새로고침, 수시 테스트를 확인
- 새 버전 배포 후 기존 진도는 남고 화면과 단어 데이터만 갱신되는지 확인

## 알려진 제한 사항

- 기록은 현재 iPad/브라우저에만 있으며 기기 간 동기화되지 않습니다.
- 손글씨는 자동 인식하거나 자동 채점하지 않습니다.
- 음성 녹음, 음성 인식, 발음 평가는 제공하지 않습니다.
- Playwright는 GitHub Pages와 같은 `/wordmaster/` base의 production build를 대상으로 세 화면 크기의 온라인 전체 여정과 Desktop Chrome의 실제 오프라인 reload 여정을 검증합니다. Windows WebKit의 service-worker ready가 비결정적이므로 실제 iPad Safari 오프라인 reload, Apple Pencil 압력, 홈 화면 설치는 위 체크리스트로 별도 확인해야 합니다.
- 실제 GitHub Pages URL은 GitHub 계정과 저장소가 정해진 뒤 확정됩니다.
