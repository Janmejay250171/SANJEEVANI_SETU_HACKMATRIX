import { Router } from 'express';
import {
  getCities,
  getTaxonomy,
  searchHospitals,
  getHospitalCostBreakdown,
  recalculateScenario,
  getNearestHospitalsGuidance,
  getMLCostAnalysis
} from '../controllers/hospitalController.js';

const router = Router();

router.get('/cities', getCities);
router.get('/taxonomy', getTaxonomy);
router.post('/search', searchHospitals);
router.post('/breakdown', getHospitalCostBreakdown);
router.post('/recalculate', recalculateScenario);
router.post('/nearest-guidance', getNearestHospitalsGuidance);
router.post('/ml-cost-analysis', getMLCostAnalysis);

export default router;
