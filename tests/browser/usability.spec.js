import {test,expect} from '@playwright/test';

test('phone filters survive a detail visit and can be cleared',async({page})=>{
  await page.goto('/phones');
  await page.getByRole('searchbox',{name:'모델 검색'}).fill('S26 Ultra');
  await page.getByRole('combobox',{name:'정렬',exact:true}).selectOption('name');
  const phones=page.locator('.catalog-card');
  await expect(phones).toHaveCount(1);
  await phones.first().click();
  await expect(page.getByRole('heading',{name:'구매 조건 선택',exact:true})).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('searchbox',{name:'모델 검색'})).toHaveValue('S26 Ultra');
  await expect(page.getByRole('combobox',{name:'정렬',exact:true})).toHaveValue('name');
  await expect(phones).toHaveCount(1);
  await page.reload();
  await expect(phones).toHaveCount(1);
  await page.getByRole('searchbox',{name:'모델 검색'}).fill('없는모델');
  await expect(phones).toHaveCount(0);
  await expect(page.getByText('조건에 맞는 모델이 없습니다.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'검색 조건 초기화',exact:true}).click();
  await expect(page.getByRole('searchbox',{name:'모델 검색'})).toHaveValue('');
  await expect(page.getByRole('combobox',{name:'정렬',exact:true})).toHaveValue('display');
  await expect(page.getByRole('button',{name:'검색 조건 초기화',exact:true})).toBeDisabled();
  expect(await phones.count()).toBeGreaterThan(1);
});

test('FAQ search matches answers and combines with service categories',async({page})=>{
  await page.goto('/support');
  const query=page.getByRole('searchbox',{name:'질문 검색',exact:true});
  await query.fill('예상 금액');
  const questions=page.locator('.faq-list details');
  await expect(questions).toHaveCount(1);
  await questions.locator('summary').click();
  await expect(questions.locator('p')).toContainText('예상 금액');
  await page.getByRole('button',{name:'보험',exact:true}).click();
  await expect(questions).toHaveCount(0);
  await expect(page.getByText('검색 결과가 없습니다. 다른 검색어나 분류를 선택해 주세요.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'검색 조건 초기화',exact:true}).click();
  await expect(query).toHaveValue('');
  await expect(questions).toHaveCount(1);
  await expect(page.getByRole('navigation',{name:'고객 지원 바로가기'})).toHaveCount(0);
});

test('a consultation dialog keeps the background still and restores scrolling on close',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/rental');
  await page.evaluate(()=>window.scrollTo(0,500));
  await page.getByRole('banner').getByRole('link',{name:'상담 신청',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'상담 신청',exact:true});
  await expect(dialog).toBeVisible();
  const before=await page.evaluate(()=>window.scrollY);
  await expect(page.locator('html')).toHaveCSS('overflow-y','hidden');
  await page.mouse.move(2,400);
  await page.mouse.wheel(0,500);
  expect(await page.evaluate(()=>window.scrollY)).toBe(before);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveCSS('overflow-y','hidden');
  await page.mouse.wheel(0,300);
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(before);
});

test('banner edits support grouped undo, keyboard placement and drafts across navigation',async({page})=>{
  await page.goto('/admin/page-rental');
  await page.getByLabel('아이디').fill('browser-admin');
  await page.getByLabel('비밀번호').fill(process.env.BROWSER_TEST_PASSWORD);
  await page.getByRole('button',{name:'로그인',exact:true}).click();
  const editor=page.getByRole('region',{name:'배너 편집기',exact:true});
  await expect(editor).toBeVisible();
  const saved=await (await page.request.get('/api/admin/appearance')).json();
  const slot=await page.getByRole('combobox',{name:'편집할 위치',exact:true}).inputValue();
  const undo=editor.getByRole('button',{name:'되돌리기',exact:true});
  const redo=editor.getByRole('button',{name:'다시 실행',exact:true});
  await expect(undo).toBeDisabled();
  await editor.getByRole('combobox',{name:'편집할 요소',exact:true}).selectOption('headline');
  const text=editor.getByRole('textbox',{name:/문구 내용/});
  const original=await text.inputValue();
  await text.fill('임시 보관 배너');
  await text.pressSequentially(' 수정');
  await undo.click();
  await expect(text).toHaveValue(original);
  await redo.click();
  await expect(text).toHaveValue('임시 보관 배너 수정');

  const preview=editor.getByRole('button',{name:'미리보기 문구 임시 보관 배너 수정',exact:true});
  await preview.focus();
  const x=editor.getByLabel('X 좌표 (%)',{exact:true});
  const initialX=Number(await x.inputValue());
  await page.keyboard.press('ArrowRight');
  await expect(x).toHaveValue(String(initialX+1));
  await page.keyboard.press('Shift+ArrowRight');
  await expect(x).toHaveValue(String(initialX+6));
  await undo.click();
  await expect(x).toHaveValue(String(initialX+1));

  await preview.scrollIntoViewIfNeeded();
  const bounds=await preview.boundingBox();
  await page.mouse.move(bounds.x+10,bounds.y+10);
  await page.mouse.down();
  await page.mouse.move(bounds.x+65,bounds.y+25,{steps:5});
  await page.mouse.up();
  expect(Number(await x.inputValue())).toBeGreaterThan(initialX+1);
  await undo.click();
  await expect(x).toHaveValue(String(initialX+1));
  await expect(page.getByText(/미저장 변경 내용은 이 탭에 임시 보관됩니다/)).toBeVisible();

  const positions=page.getByRole('combobox',{name:'편집할 위치',exact:true});
  const other=await positions.locator('option').nth(1).getAttribute('value');
  await positions.selectOption(other);
  await expect(editor).toHaveCount(0);
  await positions.selectOption(slot);
  await editor.getByRole('combobox',{name:'편집할 요소',exact:true}).selectOption('headline');
  await expect(text).toHaveValue('임시 보관 배너 수정');
  await page.goto('/admin');
  await page.goto('/admin/page-rental');
  await editor.getByRole('combobox',{name:'편집할 요소',exact:true}).selectOption('headline');
  await expect(text).toHaveValue('임시 보관 배너 수정');
  await expect(page.getByText(/이 탭에 임시 보관한 편집 내용을 복원했습니다/)).toBeVisible();
  expect((await (await page.request.get('/api/admin/appearance')).json())[slot]).toEqual(saved[slot]);

  await page.getByRole('button',{name:'미저장 변경 취소',exact:true}).click();
  await editor.getByRole('combobox',{name:'편집할 요소',exact:true}).selectOption('headline');
  await expect(text).toHaveValue(original);
  await expect(undo).toBeDisabled();
  await page.getByRole('button',{name:'기본값 복원',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'취소',exact:true}).click();
  expect((await (await page.request.get('/api/admin/appearance')).json())[slot]).toEqual(saved[slot]);

  await text.fill('저장되는 배너');
  await page.getByRole('button',{name:'화면 설정 저장',exact:true}).click();
  await expect(page.getByText('공개 화면에 반영했습니다.',{exact:true})).toBeVisible();
  expect(await page.evaluate(key=>sessionStorage.getItem(key),'hyetaekso-appearance-draft:v1:'+slot)).toBeNull();
  await page.reload();
  await editor.getByRole('combobox',{name:'편집할 요소',exact:true}).selectOption('headline');
  await expect(text).toHaveValue('저장되는 배너');
  await page.getByRole('button',{name:'기본값 복원',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'기본값으로 복원',exact:true}).click();
  await expect(page.getByText('기본 이미지와 문구를 복원했습니다.',{exact:true})).toBeVisible();
});
