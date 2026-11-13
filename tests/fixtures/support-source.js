export const supportSelection={carrier:'SKT',network:'5G',maker:'삼성전자',model:'SM-S931N',plan:'NATM000110'};
export const supportInfo={
  dan_Company:'SKT',dan_Service:'5G',dan_Mau:'삼성전자',productName:'SM-S931N',dan_Pc_Name:'갤럭시 S25',
  dan_Plan_Code:'NATM000110',dan_Plan_Name:'컴팩트',planMonthVat:39000,used_Phone_Capacity:'256',factoryPrice:'1155000',
  dan_SupportMoney:'265000',conv_SupportMoney:'90000',sellingPrice:890000,dan_Conv_SellingPrice:800000,
  updateDate:'20260101',conv_UpdateDate:'20260101'
};
export function supportFetcher(change={}) {
  return async(url,options)=>{
    const path=new URL(url).pathname;
    if(path.endsWith('getTelProductList.do'))return Response.json([{listProductData:[{dan_Pc_Name:'갤럭시 S25',dan_Service:'5G',skt_Pn:'SM-S931N'}]}],{status:201});
    if(path.endsWith('getTelPlanList.do'))return Response.json([{listData:[{dan_Plan_Code:'NATM000110',dan_Plan_Name:'컴팩트'}]}],{status:201});
    if(path.endsWith('getPriceCompare.do')){
      const input=new URLSearchParams(options.body);
      if(input.get('productName')!==supportSelection.model||input.get('dan_Plan_Code')!==supportSelection.plan)return Response.json([{priceCompareInfo:null}],{status:201});
      return Response.json([{priceCompareInfo:{...supportInfo,...change}}],{status:201});
    }
    throw new Error('Unexpected external request in isolated support test');
  };
}
