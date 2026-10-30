import {afterEach,expect,it,vi} from 'vitest';
import {storeRequest} from './storeRequest';
afterEach(()=>vi.unstubAllGlobals());
it('shows actionable messages for disconnected network, HTML proxy errors and invalid JSON',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
  await expect(storeRequest('/test',{})).rejects.toThrow('Перевірте інтернет');
  for(const response of [new Response('<html>Bad gateway</html>',{status:502}),Response.json({error:{message:'An unexpected error occurred'}},{status:500}),new Response('invalid',{status:200})]) {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response));
    await expect(storeRequest('/test',{})).rejects.toThrow('Сервер тимчасово недоступний');
  }
});
it('preserves server validation messages and returns successful data',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({error:{message:'Некоректний телефон'}},{status:400})));
  await expect(storeRequest('/test',{})).rejects.toThrow('Некоректний телефон');
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({id:'TEST'})));
  await expect(storeRequest('/test',{})).resolves.toEqual({id:'TEST'});
});
