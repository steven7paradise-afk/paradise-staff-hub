import { reviewsAdmin, privateJson } from '@/lib/google-business/access';
import { syncReviews } from '@/lib/google-business/reviews';
export const maxDuration=300;
export async function POST(request:Request) {
 try{await reviewsAdmin(request);}catch{return privateJson({error:'Accesso riservato ai super admin.'},403);}
 try{return privateJson(await syncReviews());}catch{return privateJson({error:'Sincronizzazione non riuscita. Controlla il collegamento e l’accesso alle API Google.'},502);}
}
