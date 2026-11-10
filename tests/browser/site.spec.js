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
  const model=page.getByRole('link',{name:/갤럭시 S26.*조건 선택하기/}).first();
  const detailPath=await model.getAttribute('href');
  await model.click();
  await expect(page).toHaveURL(new URL(detailPath,page.url()).href);
  await expect(page.getByLabel('할인 방식')).toBeVisible();
  await expect(page.getByRole('heading',{name:'갤럭시 S26',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'SKT',exact:true}).click();
  await page.getByRole('button',{name:'기기변경',exact:true}).click();
  await page.getByRole('button',{name:'256GB',exact:true}).click();
  await page.getByLabel('요금제',{exact:true}).selectOption({index:1});
  await expect(page.locator('.quote-total strong')).toHaveText('112,750원');
  await page.getByLabel('할인 방식').selectOption('contract');
  await expect(page.locator('.quote-total strong')).toHaveText('95,500원');
  await expect(page.getByRole('button',{name:'SKT',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'KT',exact:true}).click();
  await expect(page.getByRole('button',{name:'기기변경',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('button',{name:'256GB',exact:true})).toHaveAttribute('aria-pressed','true');
  const plans=page.getByLabel('요금제',{exact:true});
  await expect(plans).toHaveValue('');
  await plans.selectOption('kt-5g');
  await expect(page.locator('.quote-total strong')).toHaveText('95,500원');
  await page.goto('/admin/leads');
  await expect(page.getByRole('heading',{name:'관리자 로그인'})).toBeVisible();
});

test('administrator can sign in, change the company, and sign out',async({page})=>{
  await page.goto('/admin/contact');
  await page.getByLabel('아이디').fill('browser-admin');
  await page.getByLabel('비밀번호').fill(process.env.BROWSER_TEST_PASSWORD);
  await page.getByRole('button',{name:'로그인',exact:true}).click();
  await page.getByLabel('회사명',{exact:true}).fill('혜택소 테스트');
  const saved=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/admin/settings'&&response.request().method()==='PUT');
  await page.getByRole('button',{name:/저장/}).last().click();
  expect((await saved).ok()).toBe(true);
  await page.reload();
  await expect(page.getByLabel('회사명',{exact:true})).toHaveValue('혜택소 테스트');
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
  await page.goto('/admin/page-home');
  const textEditor=page.getByRole('region',{name:'배너 텍스트 편집기'});
  await textEditor.getByRole('combobox',{name:/편집할 문구/}).selectOption('headline');
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
  const uploaded=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/admin/media'&&response.request().method()==='POST');
  await page.getByLabel('PC 사진',{exact:true}).setInputFiles({
    name:'banner.png',mimeType:'image/png',
    buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2ZsAAAAASUVORK5CYII=','base64')
  });
  const upload=await uploaded;
  expect(upload.status()).toBe(201);
  const {url}=await upload.json();
  await expect(page.getByRole('img',{name:'PC 사진 미리보기'})).toHaveAttribute('src',url);
  await page.getByRole('button',{name:'화면 설정 저장'}).click();
  await expect(page.getByText('공개 화면에 반영했습니다.')).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('heading',{level:1,name:/관리자에서 바꾼 홈 배너/})).toBeVisible();
  const heading=page.locator('.hero-home .banner-text-item').filter({hasText:'관리자에서 바꾼 홈 배너'});
  await expect(heading).toHaveCSS('color','rgb(36, 87, 168)');
  expect(await heading.textContent()).toContain('\n두 번째 줄');
  expect(await heading.evaluate(node=>node.style.left)).toBe(savedX+'%');
  await expect(page.locator('.hero-home img')).toHaveAttribute('src',url);
  expect((await page.request.get(url)).headers()['content-type']).toBe('image/png');

  await page.goto('/admin/images-banner');
  await expect(page.getByText('banner.png',{exact:true})).toBeVisible();
  await page.goto('/admin/banners');
  await page.getByRole('button',{name:'+ 새 항목',exact:true}).click();
  const slide=page.getByRole('dialog').filter({hasText:'홈 배너 슬라이드 등록'});
  await slide.getByLabel('배너 관리 이름',{exact:true}).fill('보관함 사진을 사용한 배너');
  await slide.getByRole('button',{name:'PC 사진 보관함에서 선택',exact:true}).click();
  await page.getByRole('button',{name:'banner.png 선택',exact:true}).click();
  await expect(slide.getByRole('img',{name:'PC 사진 미리보기'})).toHaveAttribute('src',url);
  await slide.getByLabel('배너 문구 표시',{exact:true}).check();
  await slide.getByLabel('문구 내용',{exact:true}).fill('슬라이드 문구');
  const slideSaved=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/admin/banners'&&response.request().method()==='POST');
  await slide.getByRole('button',{name:'저장',exact:true}).click();
  const savedSlide=await (await slideSaved).json();
  expect(savedSlide.image).toBe(url);
  expect(savedSlide.layers[0].text).toBe('슬라이드 문구');

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
