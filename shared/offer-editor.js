export const offerEditLimit=100;

export const offerTitle=row=>[row.product_name,row.storage,row.carrier,row.plan,row.join_type].filter(Boolean).join(' · ')||'가격 조건';
