import {describe,it,expect} from 'vitest';
import {calculatePackage,assessOrder,DEVELOPMENT_POLICY as p} from './flexiblePricing';
import refs from './fixtures/cfo-v5-reference.json';
import {syntheticCommercial} from './commercialCatalog';
describe('CFO V5 exact rational pricing',()=>{
 it('matches all 858 allowed cached CFO weight references, including normalized PHOTO-026 anchors',()=>{for(const row of refs)expect(calculatePackage(row.curve,p,row.format as 'WEIGHT'|'WHOLE',row.grams).retailMinor,row.sourceKey).toBe(row.expectedMinor);});
 it('rejects below-minimum, fractional, wrong step, excessive and wrong whole masses',()=>{for(const w of [0,-5,15,21,25.5,357,360])expect(()=>calculatePackage(syntheticCommercial.curve!,p,'WEIGHT',w)).toThrow();expect(()=>calculatePackage(syntheticCommercial.curve!,p,'WHOLE',355)).toThrow();expect(calculatePackage(syntheticCommercial.curve!,p,'WHOLE',357).retailMinor).toBe(120000);});
 it('applies one CAC/order/parcel and rejects insufficient CP without universal minimum basket',()=>{expect(assessOrder([{revenue:10000,landed:1000,perPack:300}],p).passes).toBe(false);expect(assessOrder([{revenue:100000,landed:1000,perPack:300}],p).passes).toBe(true);});
});
