import {test,expect} from '@playwright/test';

test('a fresh visitor can view a published phone, choose a quote and submit and look up a consultation',async({page,browser,baseURL})=>{
  // Fixture setup uses a separate context; the customer never receives its session cookie.
  const administrator=await browser.newContext({baseURL});
  const headers={Origin:baseURL,'cf-connecting-ip':'198.51.100.24'};
  let product,media,receipt;
  const create=async(table,data)=>{
    const response=await administrator.request.post('/api/admin/'+table,{headers,data});
    expect(response.status()).toBe(201);
    return response.json();
  };
  try {
    expect((await administrator.request.post('/api/admin/login',{headers,data:{
      username:'browser-admin',password:process.env.BROWSER_TEST_PASSWORD
    }})).status()).toBe(200);
    const uploaded=await administrator.request.post('/api/admin/media?name=guest-phone.png&category=phone',{
      headers:{...headers,'Content-Type':'image/png'},
      data:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2ZsAAAAASUVORK5CYII=','base64')
    });
    expect(uploaded.status()).toBe(201);
    media=(await uploaded.json()).url;
    product=await create('products',{manufacturer_id:'samsung',name:'비로그인 검증 휴대폰',status:'published',image:media});
    const capacity=await create('capacities',{product_id:product.id,name:'256GB',price:1200000});
    await create('colors',{product_id:product.id,name:'블랙',image:media});
    await create('offers',{capacity_id:capacity.id,plan_id:'skt-5g',join_type:'기기변경',extra:150000});

    expect((await page.request.get('/api/admin/session')).status()).toBe(401);
    expect((await page.context().cookies()).some(cookie=>cookie.name==='hyetaekso_session')).toBe(false);
    const site=await page.request.get('/api/site');
    expect(site.status()).toBe(200);
    expect((await site.json()).settings.intake).toBe(1);
    const failures=[];
    page.on('response',response=>{
      if(new URL(response.url()).pathname.startsWith('/api/')&&response.status()>=400)failures.push(response.status()+' '+new URL(response.url()).pathname);
    });
    await page.setViewportSize({width:390,height:844});
    await page.goto('/phones?name='+encodeURIComponent(product.name));
    await page.getByRole('link',{name:new RegExp(product.name+'.*조건 선택하기')}).click();
    await expect(page).toHaveURL(new URL('/phones/'+product.id,baseURL).href);
    await expect(page.getByRole('heading',{name:product.name,exact:true})).toBeVisible();
    const photo=page.locator('.phone-media img');
    await expect(photo).toHaveAttribute('src',media);
    await expect.poll(()=>photo.evaluate(image=>image.naturalWidth)).toBeGreaterThan(0);
    const purchase=page.getByRole('region',{name:'구매 조건 선택'});
    for(const name of ['블랙','SKT','기기변경','256GB'])await purchase.getByRole('button',{name,exact:true}).click();
    await purchase.getByRole('combobox',{name:'요금제',exact:true}).selectOption('skt-5g');
    await purchase.getByRole('button',{name:'선택약정 25%',exact:true}).click();
    await expect(page.locator('.quote-total strong')).toHaveText('95,500원');
    await page.getByRole('link',{name:'선택한 조건으로 상담 신청',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'상담 신청',exact:true});
    await expect(dialog.getByRole('textbox',{name:'문의 내용',exact:true})).toHaveValue(/비로그인 검증 휴대폰.*SKT 기기변경.*256GB.*블랙/s);
    await expect(dialog.getByRole('textbox',{name:'문의 내용',exact:true})).toHaveValue(/선택약정/);
    await dialog.getByLabel('이름',{exact:true}).fill('방문자 검증');
    await dialog.getByLabel('연락처',{exact:true}).fill('01000000000');
    await dialog.getByLabel('생년월일',{exact:true}).fill('2000-01-01');
    await dialog.getByRole('combobox',{name:'남은 위약금',exact:true}).selectOption('no');
    await dialog.getByRole('combobox',{name:'남은 할부금',exact:true}).selectOption('no');
    await dialog.getByRole('checkbox').check();
    await dialog.getByRole('button',{name:'상담 신청',exact:true}).click();
    await expect(dialog.locator('.success strong')).toBeVisible();
    receipt=await dialog.locator('.success strong').textContent();
    expect(receipt).toMatch(/^HT-A\d{14}-[0-9A-F]{16}$/);
    await dialog.getByRole('link',{name:'신청 내역 조회',exact:true}).click();
    await page.getByLabel('신청번호',{exact:true}).fill(receipt);
    await page.getByLabel('신청 당시 휴대폰 번호',{exact:true}).fill('01000000000');
    await page.getByRole('button',{name:'조회',exact:true}).click();
    await expect(page.getByText('휴대폰 · 접수완료',{exact:true})).toBeVisible();
    expect(failures).toEqual([]);
    expect((await page.request.get('/api/admin/leads')).status()).toBe(401);
    expect((await page.context().cookies()).some(cookie=>cookie.name==='hyetaekso_session')).toBe(false);
  } finally {
    if(receipt){
      const leads=await (await administrator.request.get('/api/admin/leads?q='+encodeURIComponent(receipt))).json();
      for(const row of leads.items.filter(row=>row.receipt===receipt))expect((await administrator.request.delete('/api/admin/leads/'+row.id,{headers})).status()).toBe(200);
    }
    if(product)expect((await administrator.request.delete('/api/admin/products/'+product.id,{headers})).status()).toBe(200);
    if(media)expect((await administrator.request.delete('/api/admin/media/'+media.split('/').at(-1),{headers})).status()).toBe(200);
    await administrator.request.post('/api/admin/logout',{headers});
    await administrator.close();
  }
});
