# API와 데이터 모델

모든 브라우저 요청은 같은 사이트의 /api 경로를 사용합니다. 오류는 HTTP 상태와 error.code·error.message로 반환하며, 관리자·상담·설정 응답은 캐시하지 않습니다.

| 공개 API | 기능 |
|---|---|
| GET /api/site | 회사·상담·애니메이션 설정과 노출 배너 |
| GET /api/products, /api/products/:id | 공개 모델·카테고리·색상·용량·가격 조건 |
| POST /api/quote | 현재 가격 조건 기준으로 서버에서 재계산 |
| POST /api/consultations | 필수값, 동의, 견적 버전 검증 후 접수 |
| POST /api/consultations/lookup | 신청번호와 전화번호가 일치할 때 상태만 제공 |
| GET /api/content/:kind | 공개된 공지, FAQ, 후기, 질문답변, 렌탈, 페이지 안내 |
| POST /api/content/qna 또는 review | 관리자 검토 대기 글 |
| GET 또는 HEAD /api/media/:key | 공개 상품·배너·게시물·화면 설정에 사용 중인 사진과 영상, 영상 범위 요청 |

관리자 API는 /api/admin으로 시작합니다. login과 logout, session, dashboard, settings, sync, leads, media 및 각 관리 테이블의 CRUD를 제공합니다. GET /api/admin/excel/:table은 XLSX를 내려받고 POST는 업로드된 표를 검사합니다. 먼저 검토한 표와 같은 지문으로 요청해야 반영됩니다. 쓰기 요청은 설정된 Origin과 일치해야 하며 로그인·상담·조회·게시물 작성에는 요청 횟수 제한이 있습니다.

products에서 manufacturers를 참조하고 product_categories가 여러 분류를 연결합니다. capacities는 제품·용량당 출고가 하나, colors는 제품·색상당 이미지 하나를 가집니다. plans는 carriers에 속합니다. offers는 용량·요금제·가입 유형을 연결하고 추가 지원금을 갖습니다. supports는 조건별 수동·자동 자료를 나눕니다. 등록 조건과 지원금 서명이 다르거나 만료된 자료는 표시하지 않습니다.

leads에는 접수 당시 연락처, 동의 문구·시각, 계산 결과와 상담 요약을 저장합니다. 현재 상품을 수정해도 기존 견적 스냅샷은 바뀌지 않습니다. accounts의 비밀번호 해시와 sessions의 토큰 해시는 운영 DB에 저장됩니다. 업로드는 media_files·media_chunks에 저장하며, 기존 외부 저장소는 이전 파일 조회에만 사용합니다. 비공개 항목에서만 사용하거나 아직 화면에 연결하지 않은 업로드는 관리자 로그인으로 보호합니다. 공개 설정 응답에는 내부 보관 기간이나 지원금 조회 연결 설정을 포함하지 않습니다.

[SKT 지원금 공개 조회](https://shop.tworld.co.kr/notice)에서 공통지원금만 읽고 별도 판매처 지원금은 반영하지 않습니다. 스마트초이스는 출고가에서 공개 지원금을 뺀 금액이 응답 구매가와 일치하는지 검사합니다. 주소는 관리 화면에서 같은 공식 출처 안의 경로만 바꿀 수 있습니다. 외부 자료는 실제 등록된 단말·용량·통신사·요금제·가입 유형과 맞을 때만 사용합니다.
