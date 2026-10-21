import { z } from 'zod';
import { DateKey } from './schemas';
import { listReviews, reviewsSummary } from '@/lib/google-business/reviews';
const nullable=z.string().nullable();
export function registerReviewTools(tool:any) {
 tool('list_reviews','Recensioni pubbliche Google della sede Corso Buenos Aires. Paginazione per ID; from/to filtrano la data di pubblicazione in Europe/Rome. Solo super admin.',{from:DateKey.optional(),to:DateKey.optional(),cursor:z.string().max(500).optional()}, {reviews:z.array(z.object({id:z.string(),rating:z.number().int().min(1).max(5),comment:nullable,reviewer_name:z.string(),created_at:z.string(),reply_text:nullable,staff_ids:z.array(z.string()),staff_names:z.array(z.string()),match_type:z.enum(['testo','manuale']).nullable()})),next_cursor:nullable},listReviews);
 const period=z.object({count:z.number().int(),avg:z.number().nullable()});
 tool('get_reviews_summary','Media e totale ufficiali Google all’ultima sincronizzazione. Oggi, settimana (da lunedì) e mese sono calcolati sulle recensioni Google sincronizzate, in Europe/Rome; avg null quando non ci sono recensioni. Solo super admin.',{}, {average_rating:z.number().nullable(),total_reviews:z.number().int().nullable(),today:period,week:period,month:period,last_sync_at:z.string()},()=>reviewsSummary());
}
