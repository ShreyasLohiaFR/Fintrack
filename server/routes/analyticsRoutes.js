const express = require('express');
const {
  getSummary,
  getCategories,
  getMonthly
} = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/summary', getSummary);
router.get('/categories', getCategories);
router.get('/monthly', getMonthly);

module.exports = router;
