import { offerTitle } from '../../../shared/offer-editor.js';

export const entities={
  products:{title:'휴대폰 상품',fields:[['manufacturer_id','제조사','manufacturers'],['name','모델명'],['description','상품 설명','area'],['image','대표 이미지','picture'],['status','공개 상태',['draft','published']],['sort_order','표시 순서','number'],['sample','전시 예시','check'],['closed','상담 마감','check'],['categories','카테고리','multiple']]},
  manufacturers:{title:'제조사',fields:[['name','제조사 이름']]},
  categories:{title:'상품 카테고리',fields:[['name','카테고리 이름']]},
  capacities:{title:'용량·출고가',fields:[['product_id','휴대폰 모델','products'],['name','용량'],['price','출고가','number']]},
  colors:{title:'색상·사진',fields:[['product_id','휴대폰 모델','products'],['name','색상'],['image','색상 이미지','picture']]},
  carriers:{title:'통신사',fields:[['name','통신사 이름']]},
  plans:{title:'요금제',fields:[['carrier_id','통신사','carriers'],['name','요금제'],['fee','월정액','number'],['enabled','사용','check'],['source_key','외부 요금제 코드']]},
  offers:{title:'가격 조건',fields:[['capacity_id','용량','capacities'],['plan_id','요금제','plans'],['join_type','가입 유형',['기기변경','신규가입','번호이동']],['extra','추가 지원금','number'],['source_key','공개 조회 매핑 또는 피드 키']]},
  supports:{title:'공통지원금',fields:[['offer_id','상품 조건','offers'],['amount','공통지원금','number'],['source','입력 근거'],['expires_at','만료 일시','date']]},
  banners:{title:'홈 배너 슬라이드',fields:[['title','배너 관리 이름'],['kind','파일 종류',['image','video']],['image','배너 이미지','picture'],['alt','이미지 대체 문구'],['link','이동 주소'],['fit','화면에 맞추기',['cover','contain','fill']],['intro','배너 문구 표시','check'],['enabled','배너 사용','check'],['sort_order','표시 순서','number']]},
  content:{title:'공지·콘텐츠',fields:[['kind','콘텐츠 종류',['notice','faq','review','qna','rental','page']],['category','분류'],['title','제목'],['body','본문','area'],['image','이미지','picture'],['status','공개 상태',['draft','published']]]}
};
export const settingsFields=[
  ['company','회사명'],['phone','고객센터 전화'],['email','이메일'],['hours','상담 시간'],['address','주소'],
  ['registration','사업자등록번호'],['representative','대표자'],['kakao','카카오 상담 주소'],
  ['privacy','개인정보처리방침','area'],['terms','이용약관','area'],['consent','상담 수집·이용 동의 문구','area'],
  ['skt_notice','SKT 공개 조회 주소'],['sc_price','스마트초이스 공개 조회 주소'],
  ['intake','온라인 접수 사용','check'],['retention_days','상담 보관 일수','number'],
  ['banner_autoplay','홈 배너 자동 전환','check'],['banner_interval','배너 전환 간격 (초)','number'],['motion','화면 움직임',['off','subtle','standard']],
  ['join_change','기기변경 설명','area'],['join_new','신규가입 설명','area'],['join_port','번호이동 설명','area'],
  ['help_enabled','조건 미정 상담 사용','check'],['help_text','조건 미정 상담 안내','area'],['success_text','신청 완료 안내','area']
];
export const leadStates=['접수완료','상담중','상담완료','취소'];
export const optionLabels={draft:'비공개',published:'공개',image:'이미지',video:'동영상',cover:'잘라 채우기',contain:'전체 보기',fill:'늘려 맞추기',off:'끄기',subtle:'은은하게',standard:'기본',notice:'공지사항',faq:'FAQ',review:'이용후기',qna:'질문답변',rental:'렌탈',page:'일반 안내'};
export const phoneModel=row=>row.product_name||'모델명 확인 필요';
export const won=value=>Number(value).toLocaleString('ko-KR')+'원';
export function recordTitle(entity,row) {
  if(entity==='capacities'||entity==='colors')return [phoneModel(row),row.name].join(' · ');
  if(entity==='plans')return [row.carrier,row.name].filter(Boolean).join(' · ');
  if(entity==='offers'||entity==='supports')return offerTitle(row);
  return row.name||row.title||'이름 미등록';
}
