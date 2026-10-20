"""Convert Product V2 XLSX to reviewable JSON. Does not import or approve anything."""
import argparse,json,hashlib
import openpyxl
p=argparse.ArgumentParser();p.add_argument('xlsx');p.add_argument('output');args=p.parse_args()
w=openpyxl.load_workbook(args.xlsx,data_only=True);s=w['Commercial Catalog'];rows=[]
for v in s.iter_rows(min_row=2,values_only=True):
 if not v[0]:continue
 rows.append(dict(sourceSku=v[0],canonicalTeaId=v[1],name=v[3],family=v[4],image=v[6],lot=None,version='PRODUCT-V2-2026-10-20',curve=None,stockGrams=None,testFixture=False,approvedForTest=False,packaging=None,metadata={'canonicalStatus':'PROVISIONAL','originalName':v[2],'sourcePriceEvidence':v[7],'duplicateReview':v[8],'sourceStatus':v[10],'descriptionDraft':v[11],'CEOPriceApproval':v[15],'sourceSha256':hashlib.sha256(open(args.xlsx,'rb').read()).hexdigest()}))
open(args.output,'w').write(json.dumps(rows,ensure_ascii=False,indent=2)+'\n');print(len(rows),'blocked candidates, no sale approvals')
