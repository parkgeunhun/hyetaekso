export const offerEditLimit=100;

export function offerCode(id) {
  return /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)
    ? 'PC-'+id.slice(0,8).toUpperCase()
    : id;
}
