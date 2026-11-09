export function estimate(row,mode,months) {
  const support=mode==='support'&&row.support_known?row.support:0;
  const principal=Math.max(0,row.price-row.extra-support);
  const discount=mode==='contract'?Math.floor(row.fee*0.25):0;
  const installment=Math.ceil(principal/months);
  return {principal,discount,installment,monthly:row.fee-discount+installment,support,pending:mode==='support'&&!row.support_known,months,mode};
}
