export function onRequest({request,env}) {
  if (!env.HYETAEKSO_API) return Response.json({error:{code:'unavailable',message:'API 연결을 설정해 주세요.'}},{status:503});
  return env.HYETAEKSO_API.fetch(request);
}