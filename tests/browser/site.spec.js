import {test,expect} from '@playwright/test';

test('service pages and mobile menu work without horizontal overflow',async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  for(const width of [1280,820,390]) {
    await page.setViewportSize({width,height:950});
    for(const route of width===1280?['','about','telecom','rental','moving','space','mobility','business','franchise','support','insurance']:['','telecom','insurance','support']) {
      await page.goto('/'+route,{waitUntil:'domcontentloaded'});
      await expect(page.getByRole('main').getByRole('heading',{level:1})).toBeVisible();
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

test('a real consultation saves and can be looked up by receipt',async({page})=>{
  await page.goto('/consult?service=렌탈');
  await page.getByLabel('이름',{exact:true}).fill('검증 고객');
  await page.getByLabel('휴대폰 번호',{exact:true}).fill('01000000000');
  await page.getByLabel('상담 내용',{exact:true}).fill('격리된 브라우저 검증');
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'상담 신청하기',exact:true}).click();
  const receipt=await page.locator('.success strong').textContent();
  expect(receipt).toMatch(/^HT-/);
  await page.getByRole('link',{name:'신청 내역 조회',exact:true}).click();
  await page.getByLabel('신청번호',{exact:true}).fill(receipt);
  await page.getByLabel('신청 당시 휴대폰 번호',{exact:true}).fill('01000000000');
  await page.getByRole('button',{name:'조회',exact:true}).click();
  await expect(page.getByText('렌탈 · 접수완료')).toBeVisible();
});

test('direct links render catalog and gated administrator sign-in',async({page})=>{
  await page.goto('/phones');
  await page.getByRole('link',{name:/갤럭시 S26.*조건 선택하기/}).first().click();
  await expect(page.getByRole('heading',{name:/갤럭시 S26/})).toBeVisible();
  await expect(page.getByLabel('할인 방식')).toBeVisible();
  await page.getByRole('button',{name:'SKT',exact:true}).click();
  await page.getByRole('button',{name:'기기변경',exact:true}).click();
  await page.getByRole('button',{name:'256GB',exact:true}).click();
  await page.getByLabel('요금제',{exact:true}).selectOption({index:1});
  await expect(page.locator('.quote-total strong')).toHaveText('112,750원');
  await page.getByLabel('할인 방식').selectOption('contract');
  await expect(page.locator('.quote-total strong')).toHaveText('95,500원');
  await expect(page.getByRole('button',{name:'SKT',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.goto('/admin/leads');
  await expect(page.getByRole('heading',{name:'관리자 로그인'})).toBeVisible();
});

test('administrator can sign in, change the company, and sign out',async({page})=>{
  await page.goto('/admin/settings');
  await page.getByLabel('아이디').fill('browser-admin');
  await page.getByLabel('비밀번호').fill(process.env.BROWSER_TEST_PASSWORD);
  await page.getByRole('button',{name:'로그인',exact:true}).click();
  await page.getByLabel('회사명',{exact:true}).fill('혜택소 테스트');
  await page.getByRole('button',{name:/저장/}).last().click();
  await page.reload();
  await expect(page.getByLabel('회사명',{exact:true})).toHaveValue('혜택소 테스트');
  await page.goto('/admin');
  await expect(page.getByRole('heading',{name:'대시보드'})).toBeVisible();
  await page.screenshot({path:'.local/admin-desktop.png',fullPage:true,animations:'disabled'});
  await page.getByRole('button',{name:'로그아웃'}).click();
  await expect(page.getByRole('heading',{name:'관리자 로그인'})).toBeVisible();
});
