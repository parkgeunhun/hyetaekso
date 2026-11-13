import {test,expect} from '@playwright/test';

test('plan filters combine carrier, fee bounds, status and names and survive editing and reloads',async({page,baseURL})=>{
  const timing=await page.context().newCDPSession(page);
  await timing.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.setExtraHTTPHeaders({'cf-connecting-ip':'198.51.100.32'});
  await page.goto('/admin/plans');
  await page.getByLabel('아이디').fill('browser-admin');
  await page.getByLabel('비밀번호').fill(process.env.BROWSER_TEST_PASSWORD);
  await page.getByRole('button',{name:'로그인',exact:true}).click();
  const filters=page.getByRole('region',{name:'요금제 필터',exact:true});
  await expect(filters).toBeVisible();
  const headers={Origin:baseURL},created=[];
  const carriers=await (await page.request.get('/api/admin/carriers')).json();
  const [skt,kt]=['SKT','KT'].map(name=>carriers.find(row=>row.name===name));
  const name='필터 검증';
  try {
    for(const [carrier,fee,enabled,suffix] of [[skt,0,1,'무료'],[skt,39000,1,'기본'],[kt,69000,1,'상한'],[kt,99000,0,'중지']]){
      const response=await page.request.post('/api/admin/plans',{headers,data:{carrier_id:carrier.id,name:name+' '+suffix,fee,enabled,source_key:''}});
      expect(response.status()).toBe(201);created.push((await response.json()).id);
    }
    await page.reload();
    const search=filters.getByRole('searchbox'),carrier=filters.getByRole('combobox',{name:'통신사',exact:true}),state=filters.getByRole('combobox',{name:'사용 상태',exact:true});
    const min=filters.getByLabel('최소 월정액 (원)',{exact:true}),max=filters.getByLabel('최대 월정액 (원)',{exact:true});
    const rows=page.locator('tbody tr'),reset=filters.getByRole('button',{name:'필터 초기화',exact:true});
    const fees=rows.locator('td:nth-child(3)');
    await search.fill(name);
    await expect(rows).toHaveCount(4);
    await expect(filters.getByRole('status')).toContainText('4개 표시');
    await carrier.selectOption({label:'SKT'});
    await expect(rows).toHaveCount(2);
    await min.fill('0');await max.fill('0');
    await expect(rows).toHaveCount(1);await expect(fees).toHaveText(['0원']);
    await reset.click();
    await expect(search).toHaveValue('');await expect(carrier).toHaveValue('');await expect(reset).toBeDisabled();
    await search.fill(name);await min.fill('39000');await max.fill('69000');
    await expect(rows).toHaveCount(2);
    await state.selectOption('1');await carrier.selectOption({label:'KT'});
    await expect(rows).toHaveCount(1);await expect(fees).toHaveText(['69,000원']);
    await page.reload();
    await expect(search).toHaveValue(name);await expect(carrier).toHaveValue(kt.id);await expect(min).toHaveValue('39000');await expect(max).toHaveValue('69000');
    await expect(rows).toHaveCount(1);
    await page.getByRole('navigation',{name:'관리 메뉴',exact:true}).getByRole('link',{name:'통신사',exact:true}).click();
    await expect(page.getByRole('heading',{name:'통신사',exact:true})).toBeVisible();
    await page.goBack();
    await expect(search).toHaveValue(name);await expect(carrier).toHaveValue(kt.id);await expect(rows).toHaveCount(1);
    await max.fill('10000');
    await expect(filters.getByRole('alert')).toContainText('최대 월정액을 최소 월정액 이상');await expect(max).toHaveAttribute('aria-invalid','true');
    await reset.click();await search.fill(name);
    await filters.getByRole('combobox',{name:'정렬',exact:true}).selectOption('fee-desc');
    await expect(rows).toHaveCount(4);await expect(fees).toHaveText(['99,000원','69,000원','39,000원','0원']);
    await filters.getByRole('combobox',{name:'정렬',exact:true}).selectOption('fee-asc');
    await expect(fees).toHaveText(['0원','39,000원','69,000원','99,000원']);
    await state.selectOption('0');await expect(rows).toHaveCount(1);await expect(rows).toContainText('사용 안 함');
    await rows.getByRole('button',{name:'수정',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'요금제 수정',exact:true});
    await dialog.getByLabel('월정액',{exact:true}).fill('89000');
    await dialog.getByRole('button',{name:'저장',exact:true}).click();
    await expect(dialog).toHaveCount(0);await expect(rows).toHaveCount(1);await expect(rows).toContainText('89,000원');
    await expect(state).toHaveValue('0');await expect(search).toHaveValue(name);
    await search.fill('없는 요금제 검색');await expect(rows).toHaveCount(0);
    await expect(page.getByText('조건에 맞는 요금제가 없습니다. 필터를 변경하거나 초기화해 주세요.',{exact:true})).toBeVisible();
    await reset.click();await search.fill(name);
    await expect(rows).toHaveCount(4);
    await state.selectOption('0');await expect(rows).toHaveCount(1);
    await filters.evaluate((section,query)=>{
      const input=section.querySelector('input[type="search"]');
      section.querySelector('button').click();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,query);
      input.dispatchEvent(new Event('input',{bubbles:true}));
    },name+' 기본');
    await expect(state).toHaveValue('');await expect(search).toHaveValue(name+' 기본');
    await expect(rows).toHaveCount(1);await expect(rows).toContainText('39,000원');
    await search.fill(name);await expect(rows).toHaveCount(4);
    for(const width of [1280,820,390,320]){
      await page.setViewportSize({width,height:900});
      await expect(filters).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      for(const field of [search,carrier,state,min,max]){
        const box=await field.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);
      }
      if([1280,390].includes(width))await page.screenshot({path:'.local/plan-filters-'+width+'.png',fullPage:true,animations:'disabled'});
    }
  }finally{
    for(const id of created)expect((await page.request.delete('/api/admin/plans/'+id,{headers})).status()).toBe(200);
  }
});
