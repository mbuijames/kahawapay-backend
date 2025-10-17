
import { Router } from 'express';import { query } from '../db.js';import { requireAuth, requireAdmin } from '../middleware/auth.js';
const router=Router();
router.get("/admin/transactions", requireAdmin, async (req, res) => {const r=await query("SELECT * FROM transactions WHERE status='pending' ORDER BY created_at ASC");res.json({transactions:r.rows});});
router.post('/transactions/:id/pay',requireAuth,requireAdmin,async(req,res)=>{const{id}=req.params;const r=await query("UPDATE transactions SET status='paid' WHERE id=$1 RETURNING *",[id]);if(r.rowCount===0)return res.status(404).json({error:'Not found'});res.json({transaction:r.rows[0]});});
export default router;
