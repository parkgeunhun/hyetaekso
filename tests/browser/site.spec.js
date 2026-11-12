import {test,expect} from '@playwright/test';

test('service pages and mobile menu work without horizontal overflow',async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  for(const width of [1280,820,390]) {
    await page.setViewportSize({width,height:950});
    for(const route of width===1280?['','about','telecom','rental','moving','space','mobility','business','franchise','support','insurance']:['','telecom','insurance','support']) {
      await page.goto('/'+route,{waitUntil:'domcontentloaded'});
      await expect(page.getByRole('main').getByRole('heading',{level:1})).toBeVisible();
      await expect(page.locator('.hero').getByRole('link')).toHaveCount(0);
      await expect(page.getByRole('main').getByRole('heading',{name:/진행 절차|특별한 이유/})).toHaveCount(0);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
    if(width===1280){await page.goto('/');await page.screenshot({path:'.local/home-desktop.png',fullPage:true,animations:'disabled'});}
  }
  await page.goto('/');
  await page.screenshot({path:'.local/home-mobile.png',fullPage:true,animations:'disabled'});
  const navigation=page.getByRole('button',{name:/메뉴/}).first();
  await navigation.click();
  await expect(page.getByRole('link',{name:'보험',exact:true}).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('moving and home care consultation buttons line up on mobile',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/moving');
  const [moving,homeCare]=['이사 서비스','홈케어 서비스'].map(name=>page.getByRole('article')
    .filter({has:page.getByRole('heading',{name,exact:true})}).getByRole('link',{name:'상담 신청 ›',exact:true}));
  for(const width of [320,360,390,430,600]){
    await page.setViewportSize({width,height:844});
    await expect(moving).toBeVisible();
    await expect(homeCare).toBeVisible();
    const [left,right]=await Promise.all([moving.boundingBox(),homeCare.boundingBox()]);
    expect(Math.abs(left.y-right.y),'button alignment at '+width+'px').toBeLessThan(1);
  }
});

test('insurance shares the public header and the dark mode choice survives a reload',async({page})=>{
  await page.goto('/insurance');
  const header=page.getByRole('banner');
  const toggle=header.getByRole('button',{name:'다크 모드',exact:true});
  const consult=header.getByRole('link',{name:'상담 신청',exact:true});
  await expect(header).toHaveCSS('background-color','rgb(255, 255, 255)');
  await expect(page.locator('.hero')).toHaveCSS('background-color','rgb(245, 241, 236)');
  for(const width of [1280,980,901,820,390,320]){
    await page.setViewportSize({width,height:900});
    const [button,action]=await Promise.all([toggle.boundingBox(),consult.boundingBox()]);
    expect(button.x+button.width).toBeLessThan(action.x);
    expect((await toggle.locator('svg').boundingBox()).width).toBe(18);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed','true');
  await expect(header).toHaveCSS('background-color','rgb(24, 35, 50)');
  await expect(page.getByRole('contentinfo')).toHaveCSS('background-color','rgb(24, 35, 50)');
  await consult.click();
  await expect(page.getByRole('textbox',{name:'이름',exact:true})).toHaveCSS('background-color','rgb(32, 45, 63)');
  await expect(page.getByRole('dialog',{name:'상담 신청',exact:true}).getByRole('combobox',{name:'상담 유형',exact:true})).toHaveValue('보험');
  await page.keyboard.press('Escape');
  await expect(consult).toBeFocused();
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-pressed','true');
  await expect(header).toHaveCSS('background-color','rgb(24, 35, 50)');
  await toggle.click();
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-pressed','false');
  await expect(header).toHaveCSS('background-color','rgb(255, 255, 255)');
});

test('consultations can be looked up, filtered, manually registered and selectively deleted',async({page})=>{
  await page.goto('/consult?service=렌탈');
  await page.getByLabel('이름',{exact:true}).fill('검증 고객');
  await page.getByLabel('연락처',{exact:true}).fill('01000000000');
  await page.getByLabel('문의 내용',{exact:true}).fill('격리된 브라우저 검증');
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'상담 신청',exact:true}).click();
  const receipt=await page.locator('.success strong').textContent();
  expect(receipt).toMatch(/^HT-B\d{14}-[0-9A-F]{16}$/);
  await page.getByRole('link',{name:'신청 내역 조회',exact:true}).click();
  await page.getByLabel('신청번호',{exact:true}).fill(receipt);
  await page.getByLabel('신청 당시 휴대폰 번호',{exact:true}).fill('01000000000');
  await page.getByRole('button',{name:'조회',exact:true}).click();
  await expect(page.getByText('렌탈 · 접수완료')).toBeVisible();
  const internet=await page.request.post('/api/consultations',{
    headers:{Origin:new URL(page.url()).origin},
    data:{requestKey:crypto.randomUUID(),service:'인터넷',name:'검증 고객',phone:'01000000000',consent:true}
  });
  expect(internet.status()).toBe(201);
  const otherReceipt=(await internet.json()).receipt;
  await page.goto('/admin');
  await page.getByLabel('아이디').fill('browser-admin');
  await page.getByLabel('비밀번호').fill(process.env.BROWSER_TEST_PASSWORD);
  await page.getByRole('button',{name:'로그인',exact:true}).click();
  const nav=page.getByRole('navigation',{name:'관리 메뉴'});
  const consultations=nav.getByRole('link',{name:'상담',exact:true});
  await expect(consultations).toBeVisible();
  expect(await consultations.evaluate(node=>node.nextElementSibling.querySelector('summary').textContent)).toBe('홈');
  await expect(nav.locator('a[href^="/admin/leads"]')).toHaveCount(1);
  await consultations.click();
  await expect(consultations).toHaveAttribute('aria-current','page');
  const type=page.getByRole('combobox',{name:'상담 유형',exact:true});
  await expect(type).toHaveValue('');
  await expect(page.getByText(receipt,{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:receipt+' 관리 코드 복사',exact:true})).toBeVisible();
  await expect(page.getByText(otherReceipt,{exact:true})).toBeVisible();
  await type.selectOption('렌탈');
  await expect(page.getByText(receipt,{exact:true})).toBeVisible();
  await expect(page.getByText(otherReceipt,{exact:true})).toHaveCount(0);
  await expect(consultations).toHaveAttribute('aria-current','page');
  await page.getByRole('button',{name:'초기화',exact:true}).click();
  await expect(page.getByText(otherReceipt,{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'상담 수동 등록',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByRole('combobox',{name:'상담 유형',exact:true}).selectOption('휴대폰');
  await dialog.getByLabel('이름',{exact:true}).fill('수동 검증 고객');
  await dialog.getByLabel('휴대폰 번호',{exact:true}).fill('01000000000');
  await dialog.getByLabel('상담 내용',{exact:true}).fill('방문 접수');
  await dialog.getByRole('button',{name:'등록',exact:true}).click();
  const manualRow=page.getByRole('row',{name:/수동 검증 고객/});
  await expect(manualRow).toBeVisible();
  await manualRow.getByRole('button',{name:'보기',exact:true}).click();
  await expect(dialog.getByText('수동 등록 · browser-admin',{exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:'닫기',exact:true}).click();

  const all=page.getByRole('checkbox',{name:'이 페이지 상담 전체 선택',exact:true});
  const online=page.getByRole('checkbox',{name:receipt+' 선택',exact:true});
  await all.check();
  await expect(online).toBeChecked();
  await all.uncheck();
  await manualRow.getByRole('checkbox').check();
  await online.check();
  const remove=page.getByRole('button',{name:'선택 삭제 (2)',exact:true});
  await remove.click();
  await dialog.getByRole('button',{name:'취소',exact:true}).click();
  await expect(manualRow).toBeVisible();
  await remove.click();
  await dialog.getByRole('button',{name:'삭제 확인',exact:true}).click();
  await expect(page.getByText('2건의 상담을 삭제했습니다.',{exact:true})).toBeVisible();
  await expect(manualRow).toHaveCount(0);
  await expect(page.getByText(receipt,{exact:true})).toHaveCount(0);
  await expect(page.getByText(otherReceipt,{exact:true})).toBeVisible();

  await page.getByRole('link',{name:'상담 접수 설정',exact:true}).click();
  await expect(page.getByRole('spinbutton',{name:'상담 보관 일수',exact:true})).toHaveAccessibleDescription(/개인정보 보호법/);
  await expect(page.getByRole('link',{name:'개인정보 보호법 제21조',exact:true})).toHaveAttribute('href',/^https:\/\/www\.law\.go\.kr\//);
});

test('direct links render catalog and gated administrator sign-in',async({page})=>{
  await page.goto('/phones');
  const model=page.getByRole('link',{name:/갤럭시 S26.*조건 선택하기/}).first();
  const detailPath=await model.getAttribute('href');
  await model.click();
  await expect(page).toHaveURL(new URL(detailPath,page.url()).href);
  const purchase=page.getByRole('region',{name:'구매 조건 선택'});
  await expect(purchase.getByRole('combobox')).toHaveCount(1);
  const carriers=purchase.getByRole('group',{name:'구매할 통신사'}).getByRole('button');
  await expect(carriers).toHaveText(['SKT','KT','LGU+']);
  for(const width of [1280,820,390,320]) {
    await page.setViewportSize({width,height:950});
    const buttons=await carriers.evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().toJSON()));
    expect(buttons.every(button=>Math.abs(button.width-buttons[0].width)<1&&button.y===buttons[0].y&&button.height===buttons[0].height)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({width:1280,height:950});
  await expect(page.getByRole('heading',{name:'갤럭시 S26',exact:true})).toBeVisible();
  const skt=purchase.getByRole('button',{name:'SKT',exact:true});
  await skt.click();
  await expect(skt).toHaveCSS('background-color','rgb(255, 171, 0)');
  await page.getByRole('button',{name:'기기변경',exact:true}).click();
  await page.getByRole('button',{name:'256GB',exact:true}).click();
  await page.getByLabel('요금제',{exact:true}).selectOption({index:1});
  await expect(page.locator('.quote-total strong')).toHaveText('112,750원');
  const contract=purchase.getByRole('button',{name:'선택약정 25%',exact:true});
  await contract.click();
  await expect(page.locator('.quote-total strong')).toHaveText('95,500원');
  const installment=purchase.getByRole('button',{name:'36개월',exact:true});
  await installment.click();
  await expect(page.locator('.quote-total strong')).toHaveText('80,917원');
  await expect(page.getByRole('button',{name:'SKT',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'KT',exact:true}).click();
  await expect(page.getByRole('button',{name:'기기변경',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('button',{name:'256GB',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(contract).toHaveAttribute('aria-pressed','true');
  await expect(installment).toHaveAttribute('aria-pressed','true');
  const plans=page.getByLabel('요금제',{exact:true});
  await expect(plans).toHaveValue('');
  await plans.selectOption('kt-5g');
  await expect(page.locator('.quote-total strong')).toHaveText('80,917원');
  await page.goto('/admin/leads');
  await expect(page.getByRole('heading',{name:'관리자 로그인'})).toBeVisible();
});

test('administrator reads and saves multiple price conditions directly in the list',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'clipboard',{value:{writeText:async code=>{window.copiedCode=code;}}});
  });
  await page.setViewportSize({width:390,height:844});
  await page.goto('/admin/offers');
  await page.getByLabel('아이디').fill('browser-admin');
  await page.getByLabel('비밀번호').fill(process.env.BROWSER_TEST_PASSWORD);
  await page.getByRole('button',{name:'로그인',exact:true}).click();
  const search=page.getByRole('searchbox',{name:'가격 조건 검색'});
  await search.fill('갤럭시 S26 SKT 기기변경');
  const skt=page.getByRole('article',{name:'갤럭시 S26 · 256GB · SKT · 5G 예시 요금제 · 기기변경',exact:true});
  await expect(skt.getByText('demo-0-skt-0',{exact:true})).toHaveCount(0);
  await skt.getByRole('button',{name:/관리 코드 복사$/}).click();
  await expect(skt.getByRole('status')).toHaveText('복사됨');
  expect(await page.evaluate(()=>window.copiedCode)).toBe('demo-0-skt-0');
  await skt.getByLabel('추가 지원금(원)',{exact:true}).fill('175000');
  await search.fill('갤럭시 S26 KT 기기변경');
  const kt=page.getByRole('article',{name:'갤럭시 S26 · 256GB · KT · 5G 예시 요금제 · 기기변경',exact:true});
  await kt.getByLabel('공개 조회 매핑',{exact:true}).fill('verified-test-model');
  await expect(page.getByText(/미저장 2개/)).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button',{name:'변경사항 저장',exact:true}).click();
  await expect(page.getByText('2개 가격 조건을 저장했습니다.',{exact:true})).toBeVisible();
  await page.reload();
  await search.fill('갤럭시 S26 SKT 기기변경');
  await expect(skt.getByLabel('추가 지원금(원)',{exact:true})).toHaveValue('175000');
  await search.fill('갤럭시 S26 KT 기기변경');
  await expect(kt.getByLabel('공개 조회 매핑',{exact:true})).toHaveValue('verified-test-model');
});

test('admin lists and selectors show meaningful names for phones, support and mobility',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'clipboard',{value:{writeText:async code=>{window.copiedCode=code;}}});
  });
  await page.goto('/admin/products');
  await page.getByLabel('아이디').fill('browser-admin');
  await page.getByLabel('비밀번호').fill(process.env.BROWSER_TEST_PASSWORD);
  await page.getByRole('button',{name:'로그인',exact:true}).click();
  const table=page.getByRole('table');
  await expect(table.getByRole('columnheader')).toHaveText(['모델명','제조사','관리','']);
  await expect(table.getByRole('columnheader').last()).toHaveAccessibleName('관리 코드 복사');
  await expect(table.getByRole('cell',{name:'갤럭시 S26',exact:true})).toBeVisible();
  const productRow=table.getByRole('row').filter({has:page.getByRole('cell',{name:'갤럭시 S26',exact:true})});
  await productRow.getByRole('cell').last().getByRole('button',{name:'갤럭시 S26 관리 코드 복사',exact:true}).click();
  expect(await page.evaluate(()=>window.copiedCode)).toBe('demo-0');
  await expect(productRow.getByText('demo-0',{exact:true})).toHaveCount(0);

  await page.goto('/admin/plans');
  await expect(table.getByRole('cell',{name:'SKT · 5G 예시 요금제',exact:true})).toBeVisible();
  const headers={Origin:new URL(page.url()).origin};
  const support=await page.request.post('/api/admin/supports',{headers,data:{
    offer_id:'demo-0-skt-0',amount:100000,source:'검증 자료',expires_at:Date.now()+86400000
  }});
  expect(support.status()).toBe(201);
  await page.goto('/admin/supports');
  const condition='갤럭시 S26 · 256GB · SKT · 5G 예시 요금제 · 기기변경';
  const row=table.getByRole('row').filter({has:page.getByRole('cell',{name:condition,exact:true})});
  await expect(row.getByRole('cell')).toHaveText([condition,'100,000원','검증 자료','수정 삭제','']);
  await row.getByRole('button',{name:'수정',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('combobox',{name:'상품 조건',exact:true}).locator('option:checked')).toHaveText(condition);

  await page.goto('/admin/service-mobility');
  await expect(table.getByRole('columnheader')).toHaveText(['차량명 또는 안내 제목','관리','']);
  await page.getByRole('button',{name:'+ 새 항목',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('차량명 또는 안내 제목',{exact:true}).fill('쏘렌토 하이브리드');
  await dialog.getByLabel('본문',{exact:true}).fill('장기렌트 안내');
  await dialog.getByRole('button',{name:'저장',exact:true}).click();
  await expect(table.getByRole('cell',{name:'쏘렌토 하이브리드',exact:true})).toBeVisible();
  await expect(table.getByRole('cell').last().getByRole('button',{name:'쏘렌토 하이브리드 관리 코드 복사',exact:true})).toBeVisible();

  expect((await page.request.put('/api/admin/appearance/mobility-card-1',{headers,data:{title:'쏘렌토 장기렌트'}})).status()).toBe(200);
  await page.goto('/admin/page-mobility');
  await expect(page.getByRole('combobox',{name:'편집할 위치'}).getByRole('option',{name:'쏘렌토 장기렌트',exact:true})).toBeAttached();
});

test('dashboard shows public page views and todays new consultations',async({page})=>{
  await page.goto('/admin');
  await page.getByLabel('아이디').fill('browser-admin');
  await page.getByLabel('비밀번호').fill(process.env.BROWSER_TEST_PASSWORD);
  await page.getByRole('button',{name:'로그인',exact:true}).click();
  await expect(page.getByRole('heading',{name:'최근 30일 조회수',exact:true})).toBeVisible();
  const before=await (await page.request.get('/api/admin/dashboard')).json();
  const track=()=>page.waitForResponse(response=>new URL(response.url()).pathname==='/api/page-views'&&response.request().method()==='POST');
  const homeView=track();
  await page.goto('/');
  expect((await homeView).status()).toBe(204);
  const serviceView=track();
  await page.getByRole('banner').getByRole('link',{name:'보험',exact:true}).click();
  expect((await serviceView).status()).toBe(204);
  const response=await page.request.post('/api/admin/leads',{
    headers:{Origin:new URL(page.url()).origin},
    data:{requestKey:crypto.randomUUID(),name:'오늘 접수 통계 검증',phone:'01000000000',service:'렌탈',status:'상담중'}
  });
  expect(response.status()).toBe(201);
  const lead=await response.json();
  try {
    await page.goto('/admin');
    const todayViews=page.getByRole('heading',{name:'오늘 조회수',exact:true}).locator('..');
    const todayLeads=page.getByRole('heading',{name:'오늘 새 상담',exact:true}).locator('..');
    const views=(before.pageViews.at(-1).views??0)+2;
    await expect(todayViews.locator('strong')).toHaveText(String(views));
    await expect(todayLeads.locator('strong')).toHaveText(String(Number(before.newLeadsToday)+1));
    await page.getByText('일별 조회수 보기',{exact:true}).click();
    const table=page.getByRole('table');
    await expect(table.locator('tbody tr')).toHaveCount(30);
    await expect(table.locator('tbody tr').first()).toContainText(views+'회');
    await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await todayLeads.getByRole('link',{name:/오늘 상담 보기/}).click();
    await expect(page).toHaveURL(/today=1$/);
    await expect(page.getByText(lead.receipt,{exact:true})).toBeVisible();
  } finally {
    expect((await page.request.delete('/api/admin/leads/'+lead.id,{headers:{Origin:new URL(page.url()).origin}})).status()).toBe(200);
  }
});

test('administrator can sign in, change the company, and sign out',async({page})=>{
  await page.goto('/admin/contact');
  await page.getByLabel('아이디').fill('browser-admin');
  await page.getByLabel('비밀번호').fill(process.env.BROWSER_TEST_PASSWORD);
  await page.getByRole('button',{name:'로그인',exact:true}).click();
  await page.getByLabel('회사명',{exact:true}).fill('혜택소 테스트');
  const about=page.getByRole('region',{name:'기업 소개 본문 편집기',exact:true});
  await about.getByRole('textbox',{name:'기업 소개 본문',exact:true}).fill('## 기업 소개 검증\n\n**상담 연결**');
  await about.getByRole('button',{name:'미리보기',exact:true}).click();
  await expect(about.getByRole('heading',{name:'기업 소개 검증',exact:true})).toBeVisible();
  const saved=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/admin/settings'&&response.request().method()==='PUT');
  await page.getByRole('button',{name:/저장/}).last().click();
  expect((await saved).ok()).toBe(true);
  await page.reload();
  await expect(page.getByLabel('회사명',{exact:true})).toHaveValue('혜택소 테스트');
  await page.goto('/about');
  await expect(page.getByRole('heading',{name:'기업 소개 검증',exact:true})).toBeVisible();
  await expect(page.getByRole('main').getByRole('link',{name:'hyetaekso@gmail.com',exact:true})).toHaveAttribute('href','mailto:hyetaekso@gmail.com');
  await page.goto('/admin/privacy');
  const privacy=page.getByRole('region',{name:'개인정보 수집 동의서 편집기',exact:true});
  await privacy.getByRole('textbox',{name:'개인정보 수집 동의서',exact:true}).fill('# 개인정보 동의 검증\n\n- 첫 항목\n- 두 번째 항목');
  await page.getByLabel('동의 체크박스 문구',{exact:true}).fill('동의서 내용을 확인했습니다.');
  await page.getByRole('button',{name:'설정 저장',exact:true}).click();
  await expect(page.getByText('설정을 저장했습니다.',{exact:true})).toBeVisible();
  await page.goto('/privacy');
  await expect(page.getByRole('heading',{name:'개인정보 동의 검증',level:1})).toBeVisible();
  await expect(page.locator('.legal-document li')).toHaveText(['첫 항목','두 번째 항목']);
  await page.goto('/consult');
  await expect(page.getByRole('checkbox',{name:'동의서 내용을 확인했습니다.'})).toBeVisible();
  await page.getByText('개인정보 수집 동의서 보기',{exact:true}).click();
  await expect(page.getByRole('heading',{name:'개인정보 동의 검증',level:3})).toBeVisible();
  await page.goto('/admin/terms');
  const terms=page.getByRole('region',{name:'이용약관 편집기',exact:true});
  await expect(terms.getByRole('textbox',{name:'이용약관',exact:true})).toHaveValue(/## 5\. 개인정보/);
  await terms.getByRole('textbox',{name:'이용약관',exact:true}).fill('# 이용약관 검증\n\n[약관 링크](/privacy)\n\n[지원 안 됨](ftp://example.com)');
  await page.getByRole('button',{name:'설정 저장',exact:true}).click();
  await expect(page.getByText('설정을 저장했습니다.',{exact:true})).toBeVisible();
  await page.goto('/terms');
  await expect(page.getByRole('heading',{name:'이용약관 검증',level:1})).toBeVisible();
  await expect(page.getByRole('link',{name:'약관 링크',exact:true})).toHaveAttribute('href','/privacy');
  await expect(page.getByRole('link',{name:'지원 안 됨',exact:true})).toHaveCount(0);
  await page.goto('/admin/settings');
  await expect(page.locator('label').filter({hasText:'화면 움직임'}).locator('select')).toBeVisible();
  await expect(page.getByLabel('회사명',{exact:true})).toHaveCount(0);
  await expect(page.getByLabel('홈 배너 자동 전환',{exact:true})).toHaveCount(0);
  await page.goto('/admin/banners');
  await expect(page.getByLabel('홈 배너 자동 전환',{exact:true})).toBeVisible();
  await page.goto('/admin');
  await expect(page.getByRole('heading',{name:'대시보드'})).toBeVisible();
  await page.screenshot({path:'.local/admin-desktop.png',fullPage:true,animations:'disabled'});
  await page.getByRole('button',{name:'로그아웃'}).click();
  await expect(page.getByRole('heading',{name:'관리자 로그인'})).toBeVisible();
});

test('administrator changes the public banner and registers a phone with pricing',async({page})=>{
  await page.goto('/admin/appearance');
  await page.getByLabel('아이디').fill('browser-admin');
  await page.getByLabel('비밀번호').fill(process.env.BROWSER_TEST_PASSWORD);
  await page.getByRole('button',{name:'로그인',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'편집할 위치'}).locator('option')).toHaveText(['헤더·푸터 로고','브라우저 탭 아이콘']);
  await expect(page.getByRole('button',{name:'이미지 보관함에서 선택',exact:true})).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await page.goto('/admin/images-banner');
  const uploaded=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/admin/media'&&response.request().method()==='POST');
  await page.getByLabel('파일 업로드',{exact:true}).setInputFiles({
    name:'banner.png',mimeType:'image/png',
    buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2ZsAAAAASUVORK5CYII=','base64')
  });
  const upload=await uploaded;
  expect(upload.status()).toBe(201);
  const {url}=await upload.json();
  await expect(page.getByText('banner.png',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'banner.png 관리 코드 복사',exact:true})).toBeVisible();
  await page.goto('/admin/page-home');
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(page.getByRole('button',{name:/보관함에서 선택/})).toHaveCount(1);
  await page.getByRole('button',{name:'배너 이미지 보관함에서 선택',exact:true}).click();
  await page.getByRole('button',{name:'banner.png 선택',exact:true}).click();
  await expect(page.getByRole('img',{name:'배너 이미지 미리보기'})).toHaveAttribute('src',url);
  const textEditor=page.getByRole('region',{name:'배너 편집기',exact:true});
  await textEditor.getByRole('button',{name:'휴대폰',exact:true}).click();
  await expect(textEditor.locator('.home-scene img')).toHaveAttribute('src',url);
  await textEditor.getByRole('button',{name:'넓게',exact:true}).click();
  const layerSelect=textEditor.getByRole('combobox',{name:'편집할 요소',exact:true});
  await layerSelect.selectOption('headline');
  await textEditor.getByLabel('문구 내용',{exact:true}).fill('관리자에서 바꾼 홈 배너\\r\\n두 번째 줄');
  await textEditor.getByLabel('글자 색상',{exact:true}).fill('#2457a8');
  await textEditor.getByLabel('글자 크기 (px)',{exact:true}).fill('46');
  await textEditor.getByLabel('X 좌표 (%)',{exact:true}).fill('15');
  await textEditor.getByLabel('Y 좌표 (%)',{exact:true}).fill('25');
  const previewText=textEditor.getByRole('button',{name:/미리보기 문구 관리자에서 바꾼 홈 배너/});
  expect(await previewText.textContent()).toContain('\n두 번째 줄');
  await previewText.scrollIntoViewIfNeeded();
  const dragStart=await previewText.boundingBox();
  await page.mouse.move(dragStart.x+12,dragStart.y+10);
  await page.mouse.down();
  await page.mouse.move(dragStart.x+50,dragStart.y+24,{steps:3});
  await page.mouse.up();
  const savedX=await textEditor.getByLabel('X 좌표 (%)',{exact:true}).inputValue();
  expect(Number(savedX)).toBeGreaterThan(15);
  await textEditor.getByRole('combobox',{name:'문구 정렬',exact:true}).selectOption('center');
  await textEditor.getByRole('button',{name:'아이콘 넣기',exact:true}).click();
  const picker=textEditor.getByRole('group',{name:'배너 아이콘',exact:true});
  await expect(picker.getByRole('button')).toHaveCount(20);
  for(const width of [1280,390]){
    await page.setViewportSize({width,height:900});
    const [preview,addText,addIcon,selector,icons,content]=await Promise.all([
      textEditor.locator('.banner-editor-stage'),
      textEditor.getByRole('button',{name:'텍스트 추가',exact:true}),
      textEditor.getByRole('button',{name:'아이콘 넣기',exact:true}),
      layerSelect,
      picker,
      textEditor.getByLabel('문구 내용',{exact:true})
    ].map(locator=>locator.boundingBox()));
    expect(Math.min(addText.y,addIcon.y)).toBeGreaterThanOrEqual(preview.y+preview.height);
    expect(icons.y).toBeGreaterThanOrEqual(selector.y+selector.height);
    expect(content.y).toBeGreaterThanOrEqual(icons.y+icons.height);
  }
  await page.setViewportSize({width:1280,height:900});
  await picker.getByRole('button',{name:'상담 아이콘 추가',exact:true}).click();
  await textEditor.getByRole('combobox',{name:'아이콘 배경',exact:true}).selectOption('rounded');
  await textEditor.getByLabel('배경 색상',{exact:true}).fill('#fff0cd');
  await textEditor.getByLabel('아이콘 크기 (px)',{exact:true}).fill('68');
  await textEditor.getByLabel('X 좌표 (%)',{exact:true}).fill('79');
  await textEditor.getByLabel('Y 좌표 (%)',{exact:true}).fill('48');
  const previewIcon=textEditor.getByRole('button',{name:'미리보기 아이콘 상담',exact:true});
  await expect(previewIcon).toHaveAttribute('data-icon-shape','rounded');
  await expect(previewIcon).toHaveCSS('background-color','rgb(255, 240, 205)');
  const originalOrder=await layerSelect.locator('option:checked').textContent();
  await textEditor.getByRole('button',{name:'한 단계 뒤로',exact:true}).click();
  await expect(layerSelect.locator('option:checked')).not.toHaveText(originalOrder);
  await textEditor.getByRole('button',{name:'선택 요소 복제',exact:true}).click();
  await expect(previewIcon).toHaveCount(2);
  await textEditor.getByRole('button',{name:'선택 요소 삭제',exact:true}).click();
  await expect(previewIcon).toHaveCount(1);
  await textEditor.getByRole('button',{name:'휴대폰',exact:true}).click();
  await expect(previewIcon).toBeVisible();
  await page.getByRole('button',{name:'화면 설정 저장'}).click();
  await expect(page.getByText('공개 화면에 반영했습니다.')).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('heading',{level:1,name:/관리자에서 바꾼 홈 배너/})).toBeVisible();
  const heading=page.locator('.hero-home .banner-text-item').filter({hasText:'관리자에서 바꾼 홈 배너'});
  await expect(heading).toHaveCSS('color','rgb(36, 87, 168)');
  await expect(heading).toHaveCSS('text-align','center');
  const publicIcon=page.locator('.hero-home .banner-icon-item');
  await expect(publicIcon).toHaveAttribute('data-icon-shape','rounded');
  await expect(publicIcon).toHaveCSS('background-color','rgb(255, 240, 205)');
  expect(await publicIcon.evaluate(node=>node.style.left)).toBe('79%');
  expect(await heading.textContent()).toContain('\n두 번째 줄');
  expect(await heading.evaluate(node=>node.style.left)).toBe(savedX+'%');
  await expect(page.locator('.hero-home img')).toHaveAttribute('src',url);
  const desktopImage=await page.locator('.hero-home img').evaluate(image=>image.currentSrc);
  await page.setViewportSize({width:390,height:844});
  expect(await page.locator('.hero-home img').evaluate(image=>image.currentSrc)).toBe(desktopImage);
  await page.setViewportSize({width:1280,height:900});
  expect((await page.request.get(url)).headers()['content-type']).toBe('image/png');

  await page.goto('/admin/images-banner');
  await expect(page.getByText('banner.png',{exact:true})).toBeVisible();
  await page.goto('/admin/banners');
  await page.getByRole('button',{name:'+ 새 항목',exact:true}).click();
  const slide=page.getByRole('dialog').filter({hasText:'홈 배너 슬라이드 등록'});
  await slide.getByLabel('배너 관리 이름',{exact:true}).fill('보관함 사진을 사용한 배너');
  await expect(slide.locator('input[type="file"]')).toHaveCount(0);
  await expect(slide.getByRole('button',{name:/보관함에서 선택/})).toHaveCount(1);
  await slide.getByRole('button',{name:'배너 이미지 보관함에서 선택',exact:true}).click();
  await page.getByRole('button',{name:'banner.png 선택',exact:true}).click();
  await expect(slide.getByRole('img',{name:'배너 이미지 미리보기'})).toHaveAttribute('src',url);
  await slide.getByLabel('배너 문구 표시',{exact:true}).check();
  await slide.getByLabel('문구 내용',{exact:true}).fill('슬라이드 문구');
  await slide.getByRole('button',{name:'아이콘 넣기',exact:true}).click();
  await slide.getByRole('button',{name:'인증 아이콘 추가',exact:true}).click();
  const slideSaved=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/admin/banners'&&response.request().method()==='POST');
  await slide.getByRole('button',{name:'저장',exact:true}).click();
  const savedSlide=await (await slideSaved).json();
  expect(savedSlide.image).toBe(url);
  expect(savedSlide.layers[0].text).toBe('슬라이드 문구');
  expect(savedSlide.layers[1]).toMatchObject({type:'icon',icon:'badge',shape:'circle'});

  await page.goto('/admin/page-telecom');
  const adminMenu=page.getByRole('navigation',{name:'관리 메뉴'});
  const telecom=adminMenu.getByText('통신',{exact:true}).locator('..');
  await telecom.getByText('휴대폰 관리',{exact:true}).click();
  await telecom.getByRole('link',{name:'휴대폰 등록',exact:true}).click();
  await expect(telecom.getByRole('link',{name:'휴대폰 등록',exact:true})).toHaveAttribute('aria-current','page');
  await page.getByLabel('제조사').selectOption('samsung');
  await page.getByLabel('모델명').fill('등록 확인 휴대폰');
  await page.getByLabel('공개 상태').selectOption('published');
  await page.getByRole('button',{name:'용량 추가',exact:true}).click();
  await page.getByLabel('용량',{exact:true}).fill('256GB');
  await page.getByRole('spinbutton',{name:'출고가',exact:true}).fill('1200000');
  await page.getByRole('button',{name:'색상 추가',exact:true}).click();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'대표 이미지 보관함에서 선택',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'색상 이미지 보관함에서 선택',exact:true})).toBeVisible();
  await page.getByLabel('색상',{exact:true}).fill('블랙');
  await page.getByRole('button',{name:'가격 조건 추가',exact:true}).click();
  await page.getByLabel('연결할 용량').selectOption({index:1});
  await page.getByLabel('요금제').selectOption('skt-5g');
  await page.getByLabel('추가 지원금').fill('150000');
  await page.getByRole('button',{name:'휴대폰 저장',exact:true}).click();
  await expect(page.getByRole('heading',{name:'등록 확인 휴대폰 등록 완료'})).toBeVisible();
  await page.getByRole('link',{name:'공개 상품 보기'}).click();
  await expect(page.getByRole('heading',{name:'등록 확인 휴대폰',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'256GB',exact:true})).toBeVisible();
  const purchase=page.getByRole('region',{name:'구매 조건 선택'});
  await purchase.getByRole('button',{name:'SKT',exact:true}).click();
  await purchase.getByRole('button',{name:'기기변경',exact:true}).click();
  await purchase.getByRole('button',{name:'256GB',exact:true}).click();
  await purchase.getByRole('combobox',{name:'요금제',exact:true}).selectOption('skt-5g');
  await purchase.getByRole('button',{name:'선택약정 25%',exact:true}).click();
  await purchase.getByRole('button',{name:'30개월',exact:true}).click();
  await page.getByRole('link',{name:'선택한 조건으로 상담 신청',exact:true}).click();
  const inquiry=page.getByRole('dialog',{name:'상담 신청',exact:true});
  const inquiryText='등록 확인 휴대폰, SKT 기기변경, 선택약정 25%, 256GB, 블랙, 5G 예시 요금제, 30개월 할부';
  await expect(inquiry.getByRole('textbox',{name:'문의 내용',exact:true})).toHaveValue(inquiryText);
  await inquiry.getByRole('button',{name:'닫기',exact:true}).click();
  await page.getByRole('banner').getByRole('link',{name:'상담 신청',exact:true}).click();
  await expect(inquiry.getByRole('combobox',{name:'상담 유형',exact:true})).toHaveValue('휴대폰');
  await expect(inquiry.getByRole('textbox',{name:'문의 내용',exact:true})).toHaveValue(inquiryText);
  await inquiry.getByLabel('이름',{exact:true}).fill('선택 조건 검증');
  await inquiry.getByLabel('연락처',{exact:true}).fill('01000000000');
  await inquiry.getByLabel('이메일 (선택)').fill('test@example.com');
  await inquiry.getByLabel('생년월일',{exact:true}).fill('1990-01-01');
  await inquiry.getByLabel('남은 위약금',{exact:true}).selectOption('no');
  await inquiry.getByLabel('남은 할부금',{exact:true}).selectOption('no');
  await inquiry.getByRole('checkbox').check();
  await inquiry.getByRole('button',{name:'상담 신청',exact:true}).click();
  const inquiryReceipt=await inquiry.locator('.success strong').textContent();
  expect(inquiryReceipt).toMatch(/^HT-A\d{14}-[0-9A-F]{16}$/);
  const {items:[inquiryLead]}=await (await page.request.get('/api/admin/leads?q='+inquiryReceipt)).json();
  const inquiryDetail=await (await page.request.get('/api/admin/leads/'+inquiryLead.id)).json();
  expect(inquiryDetail.email).toBe('test@example.com');
  expect(inquiryDetail.details).toBe(inquiryText);
  expect(JSON.parse(inquiryDetail.quote).mode).toBe('contract');

  await page.goto('/admin/capacities');
  const table=page.getByRole('table');
  await expect(table.getByRole('columnheader')).toHaveText(['휴대폰 모델','용량','출고가','관리','']);
  const registered=table.getByRole('row').filter({has:page.getByRole('cell',{name:'등록 확인 휴대폰',exact:true})});
  const otherPhone=table.getByRole('row').filter({has:page.getByRole('cell',{name:'갤럭시 S26+',exact:true})});
  await expect(registered.getByRole('cell')).toHaveText(['등록 확인 휴대폰','256GB','1,200,000원','수정 삭제','']);
  await expect(otherPhone.getByRole('cell',{name:'256GB',exact:true})).toBeVisible();
  await expect(otherPhone.getByRole('cell',{name:'1,300,000원',exact:true})).toBeVisible();
  await page.getByRole('searchbox',{name:'휴대폰 모델·용량·출고가 검색',exact:true}).fill('등록 확인 휴대폰 256GB');
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await registered.getByRole('button',{name:'수정',exact:true}).click();
  const capacityDialog=page.getByRole('dialog');
  await expect(capacityDialog.getByRole('combobox',{name:'휴대폰 모델',exact:true}).locator('option:checked')).toHaveText('등록 확인 휴대폰');
  await capacityDialog.getByRole('button',{name:'닫기',exact:true}).click();
  await registered.getByRole('button',{name:'삭제',exact:true}).click();
  await expect(capacityDialog.getByText('등록 확인 휴대폰 · 256GB · 1,200,000원 항목을 삭제합니다.',{exact:true})).toBeVisible();

  await page.goto('/admin/colors');
  const gallery=page.getByRole('region',{name:'휴대폰 색상 목록',exact:true});
  const colorCards=gallery.getByRole('article');
  const color=gallery.getByRole('article',{name:'등록 확인 휴대폰 · 블랙',exact:true});
  const photo=gallery.getByRole('img',{name:'갤럭시 S26 · 기본색 사진',exact:true});
  await expect(color.getByText('사진 없음',{exact:true})).toBeVisible();
  await expect(color.getByRole('button',{name:'등록 확인 휴대폰 · 블랙 관리 코드 복사',exact:true})).toBeVisible();
  await expect(photo).toHaveAttribute('src','/media/phone-0.svg');
  await expect.poll(()=>photo.evaluate(image=>image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByText('관리 코드',{exact:true})).toHaveCount(0);
  for(const width of [1280,390,320]) {
    await page.setViewportSize({width,height:900});
    const [first,second]=await colorCards.evaluateAll(cards=>cards.slice(0,2).map(card=>card.getBoundingClientRect().top));
    expect(first).toBe(second);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await page.getByRole('searchbox',{name:'모델명·색상 검색',exact:true}).fill('등록 확인 휴대폰 블랙');
  await expect(colorCards).toHaveCount(1);
  await color.getByRole('button',{name:'수정',exact:true}).click();
  const colorDialog=page.getByRole('dialog').filter({hasText:'색상·사진 수정'});
  await expect(colorDialog.getByRole('combobox',{name:'휴대폰 모델',exact:true}).locator('option:checked')).toHaveText('등록 확인 휴대폰');
  await colorDialog.getByRole('button',{name:'색상 이미지 보관함에서 선택',exact:true}).click();
  await page.getByRole('button',{name:'기본 휴대폰 이미지 1 선택',exact:true}).click();
  await colorDialog.getByRole('button',{name:'저장',exact:true}).click();
  await expect(color.getByRole('img',{name:'등록 확인 휴대폰 · 블랙 사진',exact:true})).toHaveAttribute('src','/media/phone-0.svg');
  await color.getByRole('button',{name:'삭제',exact:true}).click();
  await expect(page.getByRole('dialog').getByText('등록 확인 휴대폰 · 블랙 항목을 삭제합니다.',{exact:true})).toBeVisible();
});

test('media library uses compact tiles and deletes uploads individually and in bulk',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/admin/images-other');
  await page.getByLabel('아이디').fill('browser-admin');
  await page.getByLabel('비밀번호').fill(process.env.BROWSER_TEST_PASSWORD);
  await page.getByRole('button',{name:'로그인',exact:true}).click();
  const upload=page.getByLabel('파일 업로드',{exact:true});
  for(const name of ['single-delete.png','bulk-delete-a.png','bulk-delete-b.png']) {
    await upload.setInputFiles({name,mimeType:'image/png',buffer:Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2ZsAAAAASUVORK5CYII=','base64')});
    await expect(page.getByText(name,{exact:true})).toBeVisible();
  }
  const previews=page.locator('.media-library-preview');
  const first=await previews.nth(0).boundingBox(),second=await previews.nth(1).boundingBox();
  expect(first.height).toBeLessThanOrEqual(80);
  expect(first.y).toBe(second.y);

  await page.getByRole('button',{name:'single-delete.png 삭제',exact:true}).click();
  await page.getByRole('button',{name:'삭제 확인',exact:true}).click();
  await expect(page.getByText('1개 파일을 삭제했습니다.',{exact:true})).toBeVisible();
  await expect(page.getByText('single-delete.png',{exact:true})).toHaveCount(0);
  await page.getByRole('checkbox',{name:'bulk-delete-a.png 선택',exact:true}).check();
  await page.getByRole('checkbox',{name:'bulk-delete-b.png 선택',exact:true}).check();
  await page.getByRole('button',{name:'선택 삭제 (2)',exact:true}).click();
  await page.getByRole('button',{name:'삭제 확인',exact:true}).click();
  await expect(page.getByText('2개 파일을 삭제했습니다.',{exact:true})).toBeVisible();
  await expect(page.getByText('서비스 페이지 공용 이미지',{exact:true})).toBeVisible();
  await expect(page.getByText('bulk-delete-a.png',{exact:true})).toHaveCount(0);
  await expect(page.getByText('bulk-delete-b.png',{exact:true})).toHaveCount(0);
});
