# 배포 및 검증

## 데이터베이스와 API

1. 격리된 스테이징 MySQL DB 및 접속 계정을 생성합니다. DB 이름, 계정, 데이터 및 백업을 운영과 분리합니다.
2. DATABASE_URL을 관리 환경에만 넣고 npm run db:migrate를 실행합니다. 초기 관리자 설정은 npm run admin:set으로 진행합니다. 예제 환경변수의 빈 값을 실제 저장소 파일에 채우지 않습니다.
3. Cloudflare Hyperdrive로 스테이징 MySQL을 연결합니다. backend/wrangler.jsonc의 예제 설정을 바탕으로 Hyperdrive 바인딩 HYPERDRIVE 및 R2 바인딩 MEDIA를 추가하고 스테이징 Worker를 별도 이름으로 배포합니다. 미리보기와 운영 R2 버킷도 분리합니다. Worker를 공개 인터넷에서 직접 열 수 없도록 workers.dev와 previews 사용 여부를 확인하고 Pages Service Binding으로만 연결합니다.
4. APP_ORIGIN에 지정된 미리보기 HTTPS 도메인을 설정합니다. 상담 접수, 관리 로그인, 엑셀 적용은 출처 검증을 거칩니다. 지원금 외부 공급처를 사용하는 경우 Worker 설정에서 필요한 주소와 키를 분리하고 실패/만료 로그를 확인합니다. 오전 9시 KST 실행은 Worker cron에서 UTC 00:00으로 구성합니다.

[Cloudflare Hyperdrive MySQL 예제](https://developers.cloudflare.com/hyperdrive/examples/connect-to-mysql/) · [Pages 미리보기 접근 제한](https://developers.cloudflare.com/pages/configuration/preview-deployments/)

### 현재 PC의 MySQL을 쓰는 미리보기

미리보기 Worker의 `HYETAEKSO_LOCAL_API`는 기존 Cloudflare Tunnel을 통해 이 PC의 `127.0.0.1:8789`에 있는 HTTP VPC 서비스만 호출합니다. 미리보기 Pages에 걸린 Cloudflare Access와 혜택소 관리자 로그인은 계속 적용됩니다. Worker에 MySQL 암호를 저장할 필요가 없습니다.

PC 재시작 후에는 혜택소 프로젝트 폴더에서 `node --env-file=.env scripts/private-preview-api.mjs`를 실행하고 Cloudflare Tunnel 및 MySQL이 실행 중인지 확인합니다. `.env`에는 기존 로컬 MySQL 연결을 사용합니다. 이 방식은 미리보기용이며 PC가 잠자기 상태이거나 세 프로세스 중 하나가 멈추면 API에 접속할 수 없습니다. 새 업로드는 `.local/private-preview-media`에 저장됩니다. 이 모드에서는 DB 보존 기간 정리와 자동 지원금 갱신을 하는 Worker 예약 작업이 실행되지 않습니다. 기존 운영 DB와 데이터 보존 정책을 분리한 배포에는 위 Hyperdrive 방식을 사용합니다.

## Cloudflare Pages

1. Cloudflare Access에서 테스트 담당자만 접속 가능한 인증 정책을 **먼저** 만듭니다. 스테이징 프로젝트의 기본 pages.dev 주소, 배포별 주소, 브랜치 별칭과 커스텀 도메인 모두를 별도 세션에서 점검합니다. 익명 접속이 가능한 별칭이 있으면 데이터나 인증 정보가 들어가는 스테이징을 열지 마세요.
2. 스테이징 Pages 프로젝트에 GitHub hyetaekso를 연결합니다. 루트에서 npm run build를 실행하고 결과 디렉터리를 frontend/dist로 지정합니다. Node 버전은 24로 지정합니다. 프로젝트 루트의 functions가 Pages Functions로 배포됩니다. CLI로 설정할 경우 scripts/stage-pages.mjs가 이 구조를 만듭니다.
3. Pages 프로젝트에 Service Binding HYETAEKSO_API를 추가해 스테이징 Worker에 연결합니다. 브라우저 요청은 동일한 도메인의 /api/*로 보내고, Worker 주소를 프론트엔드에 넣지 않습니다.
4. 운영 브랜치나 운영 도메인은 연결하지 않습니다. 개발 브랜치에 커밋할 때만 검증 URL을 갱신하고 PR에 결과를 기록합니다.

## 기기 확인

- iPad Safari에서 인증 전 접속 차단과 인증 후 접속을 확인합니다.
- 가로·세로 화면에서 메뉴, 캐러셀, 견적의 요금제 목록, 상담 폼과 관리자 사이드바를 확인합니다.
- 휴대폰 조건을 하나씩 변경하고 이전 선택 유지, 월 납부액 변화, 첨부 색상 이미지의 변경을 확인합니다.
- 테스트 전용 상담을 보내 신청번호, 관리자 상세, 상태 변경 및 조회를 확인합니다. 테스트 환경에서 실제 고객 데이터를 사용하지 않습니다.
- 첨부 파일이나 영상이 포함된 배너는 재생 및 넘김 토글을 기기에서 확인합니다.
