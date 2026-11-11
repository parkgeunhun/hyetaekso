export const serviceTypes=['휴대폰','통신','인터넷','TV','렌탈','이사·홈','공간','모빌리티','보험','사업자 서비스','가맹안내','고객문의','제휴·입점','고객의 소리'];

export const serviceByPage={
  about:'고객문의',telecom:'통신',phones:'휴대폰',catalog:'휴대폰',rental:'렌탈',moving:'이사·홈',
  space:'공간',mobility:'모빌리티',insurance:'보험',business:'사업자 서비스',franchise:'가맹안내',support:'고객문의'
};

export const discountOptions=[['support','공통지원금'],['contract','선택약정 25%']];
export const consultationEmailNotice='이메일 회신을 원하는 경우 입력해 주세요.';

export function phoneInquiry({model,color,carrier,join,storage,plan,mode,months}) {
  const discount=discountOptions.find(([value])=>value===mode)?.[1];
  return [
    model,[carrier,join].filter(Boolean).join(' '),discount,
    storage,color,plan,months?months+'개월 할부':''
  ].filter(Boolean).join(', ');
}
