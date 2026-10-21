export interface CatalogContentV2 {
 sourceSku:string;canonicalTeaId:string;canonicalStatus:string;supplierReference:string;
 originalSourceName:string;chineseNameOriginal:string|null;chineseNameReference:string|null;chineseNameReferenceStatus:string;
 category:string;legacyCatalogCategory:string;taxonomyFamily:string;variety:string;
 contentStatus:string;sensoryScope:string;sourceIds:string[];sourceUrls:string[];possibleDuplicateGroupIds:string[];
 evidence:Record<string,{status:string;scope:string;sourceIds:string[]}>;
 content:{short:string;full:string;taste:string;aroma:string;finish:string;processing:string;brewing:string;buyerProfile:string;scopeDisclosure:string};
 recipe:{grams:number|null;waterMl:number|null;temperatureC:number|null;firstInfusionSeconds:number|null;adjustment:string}|null;
 sensory:Record<string,null>;discoveryDistance:null;verifiedFields:string[];
 publishAllowed:false;salesAllowed:false;recommendationApproved:false;previewOnly:true;
 image:{kind:string;rightsStatus:string;publicationAllowed:boolean;assignmentStatus:string;alt?:string;path?:string};
}
