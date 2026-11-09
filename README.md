# 혜택소 Hyetaekso

WordPress에 있던 휴대폰 견적·상담과 운영 관리 기능을 React로 옮기는 프로젝트입니다. 기존 WordPress 운영 파일과 별도로 개발합니다.

## 로컬 실행

Node.js 24 이상이 필요합니다.

```sh
npm install
npm run dev
```

브라우저에서 http://127.0.0.1:5173 을 엽니다. 개발 기본값은 이 프로젝트의 .local 폴더에 격리된 SQLite와 샘플 카탈로그입니다. 운영 MySQL 또는 WordPress를 읽거나 변경하지 않습니다. 샘플 상품은 견적을 체험할 수 있지만 접수할 수 없습니다. 로컬 상담 접수는 관리자에서 개인정보 안내를 등록하고 접수를 켜고, 실제 접수가 가능한 테스트 상품을 별도로 만든 뒤 확인합니다.

MySQL로 테스트하려면 테스트용 DB를 만들고 환경변수 DATABASE_URL을 설정한 후 npm run db:migrate를 실행합니다. npm run admin:set 명령은 ADMIN_USERNAME·ADMIN_PASSWORD를 환경변수에서 읽습니다. 값은 로컬 셸 또는 비밀 관리 도구에서만 주입하세요. 동일한 이름으로 다시 실행하면 비밀번호를 재설정하고 기존 세션을 취소합니다. 관리자 화면은 /admin 입니다.

```sh
npm test
npm run build
# 선택: 브라우저 검사 (Windows의 Edge 또는 설치한 Chromium)
npx playwright install chromium
npm run test:browser
```

LEGACY_PHP 환경변수에 PHP 실행 파일을 지정하면 PHP 기준식과 JavaScript 결과를 비교합니다. MYSQL_TEST_URL은 자동 검증 전용 빈 DB에만 지정하세요. 자동 검증은 이 URL로 연결한 테스트 데이터를 변경합니다.

- [이전 설계와 기존 기능 목록](docs/migration.md)
- [배포와 테스트 환경 분리](docs/deploy.md)
- [API 및 DB 구조](docs/api.md)
- [WordPress 데이터 이전](docs/data-import.md)
- [디자인 자산](docs/assets.md)
- [구현 및 검증 상태](docs/status.md)
