import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeIndianCurrency } from '../services/normalizerService.js';
import { policyDocumentIngestionService } from '../services/policyDocumentIngestionService.js';
import { policySegmentationEngine } from '../services/policySegmentationEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function test(file: string, name: string) {
  const buf = fs.readFileSync(file);
  const ing = await policyDocumentIngestionService.ingestPolicyPdf(buf, name);
  const segs = policySegmentationEngine.segmentDocument(ing);
  const schedText = segs.find(s => s.segmentType === 'SCHEDULE')!.combinedText;
  const subText = segs.filter(s => s.segmentType === 'SUBLIMITS').map(s => s.combinedText).join('\n\n');
  const inpText = segs.filter(s => s.segmentType === 'INPATIENT_AND_ROOM_RENT').map(s => s.combinedText).join('\n\n');

  const planM = schedText.match(/(?:Product\s*Name|Plan\s*Name)[:.\s]*([^\n\r•]+)/i);
  const siM = schedText.match(/(?:Basic\s*Sum\s*Insured|Total\s*Sum\s*Insured)(?:[^\n:0-9]*?)[:.\s]*(?:Rs\.?|INR)?\s*([0-9,]+(?:\s*Lakhs?)?)/i);
  const icuM = inpText.match(/(?:ICU\s*\/\s*ICCU\s*Daily\s*Capping\s*Entitlement|Intensive\s*Care\s*Unit)[\s\S]*?(?:capped\s*at\s*(?:a\s*maximum\s*of\s*)?|up\s*to\s*)([0-9.]+)%\s*of\s*(?:the\s*)?(?:Basic\s*)?Sum\s*Insured/i);

  const catM = subText.match(/(?:Cataract\s+Surgery\s+Sublimit|Cataract\s+Surgery\s+Sub-Limit)[\s\S]*?Rs\.?\s*([0-9,]+)/i);
  const kneeM = subText.match(/(?:Total\s+Knee\s+Replacement\s*(?:\(TKR\)\s*)?Sublimit|Total\s+Knee\s+Replacement\s+Sub-Limit)[\s\S]*?Rs\.?\s*([0-9,]+)/i);
  const herM = subText.match(/(?:Hernia\s+Repair\s+Procedures\s+Sublimit|Hernia\s+Sub-Limit)[\s\S]*?Rs\.?\s*([0-9,]+)/i);
  const appM = subText.match(/(?:Laparoscopic\s+Appendectomy\s+Sublimit|Laparoscopic\s+Appendectomy\s+Sub-Limit)[\s\S]*?Rs\.?\s*([0-9,]+)/i);

  console.log(`=== ${name} ===`);
  console.log('Plan:', planM?.[1]?.trim());
  console.log('SI:', normalizeIndianCurrency(siM?.[1] || ''));
  console.log('ICU:', icuM?.[1]);
  console.log('Cataract:', normalizeIndianCurrency(catM?.[1] || ''));
  console.log('Knee:', normalizeIndianCurrency(kneeM?.[1] || ''));
  console.log('Hernia:', normalizeIndianCurrency(herM?.[1] || ''));
  console.log('Appendectomy:', normalizeIndianCurrency(appM?.[1] || ''));
}

async function run() {
  await test(
    path.resolve(__dirname, '../../tests/fixtures/policies/synthetic_comprehensive_health_policy_45_pages.pdf'),
    'Arogya Bharat 45 Pages'
  );
  await test(
    path.resolve(__dirname, '../../../mock-policies/star_health_optima_full_wording_32pp.pdf'),
    'Star Health 32 Pages'
  );
}

run().catch(console.error);
