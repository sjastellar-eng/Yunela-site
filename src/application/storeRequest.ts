/** Normalize network and proxy errors without exposing HTML/parser diagnostics. */
export async function storeRequest<T>(url:string,init:RequestInit):Promise<T> {
  let response:Response;
  try { response=await fetch(url,init); }
  catch { throw new Error('Не вдалося з’єднатися з сервером. Перевірте інтернет і спробуйте ще раз.'); }
  if(response.status>=500) throw new Error('Сервер тимчасово недоступний. Спробуйте ще раз пізніше.');
  let result:unknown;
  try { result=await response.json(); }
  catch { throw new Error('Сервер тимчасово недоступний. Спробуйте ще раз пізніше.'); }
  if(!response.ok) {
    const message=(result as {error?:{message?:unknown}}|null)?.error?.message;
    throw new Error(typeof message==='string'?message:'Сервер тимчасово недоступний. Спробуйте ще раз пізніше.');
  }
  return result as T;
}
