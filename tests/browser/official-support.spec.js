import {test,expect} from '@playwright/test';

test('official names can be selected, checked, saved as a draft and refreshed',async({page,baseURL})=>{
  await page.setExtraHTTPHeaders({'cf-connecting-ip':'198.51.100.31'});
  await page.setViewportSize({width:390,height:844});
  await page.goto('/admin/sync');
  await page.getByLabel('아이디').fill('browser-admin');
  await page.getByLabel('비밀번호').fill(process.env.BROWSER_TEST_PASSWORD);
  await page.getByRole('button',{name:'로그인',exact:true}).click();
  const run=page.getByRole('button',{name:'지금 갱신',exact:true});
  await expect(run).toBeDisabled();
  const setup=page.getByRole('region',{name:'공식 상품 연결',exact:true});
  await setup.getByRole('button',{name:'공식 목록 불러오기',exact:true}).click();
  await setup.getByRole('combobox',{name:'공식 휴대폰',exact:true}).selectOption({label:'갤럭시 S25'});
  await setup.getByRole('combobox',{name:'공식 요금제',exact:true}).selectOption({label:'컴팩트'});
  await setup.getByRole('button',{name:'지원금 확인',exact:true}).click();
  await expect(setup.getByRole('heading',{name:'갤럭시 S25 · 256GB',exact:true})).toBeVisible();
  await expect(setup).toContainText('1,155,000원');
  await expect(setup).toContainText('355,000원');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const saving=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/admin/sync/connect');
  await setup.getByRole('button',{name:'연결하고 지원금 저장',exact:true}).click();
  const response=await saving;expect(response.status()).toBe(201);
  const saved=await response.json();
  try {
    await expect(setup.getByRole('status')).toContainText('3개 가입 조건 연결 완료');
    await expect(setup.getByRole('status')).toContainText('비공개 상품');
    await expect(run).toBeEnabled();
    await run.click();
    await expect(page.getByText('갱신 완료',{exact:true})).toBeVisible();
    const history=await (await page.request.get('/api/admin/sync')).json();
    expect(history[0].status).toBe('success');
    expect(history[0].counts.updated).toBe(3);
    expect(history[0].issues).toEqual([]);
    expect((await page.request.get('/api/products/'+saved.id)).status()).toBe(404);
    await page.reload();
    await expect(page.getByText('실제 가격 조건 3개 중 자동 갱신 가능 3개',{exact:true})).toBeVisible();
  } finally {
    const offers=await (await page.request.get('/api/admin/offers')).json();
    const planIds=[...new Set(offers.filter(row=>row.product_id===saved.id).map(row=>row.plan_id))];
    expect((await page.request.delete('/api/admin/products/'+saved.id,{headers:{Origin:baseURL}})).status()).toBe(200);
    for(const id of planIds)expect((await page.request.delete('/api/admin/plans/'+id,{headers:{Origin:baseURL}})).status()).toBe(200);
  }
});
