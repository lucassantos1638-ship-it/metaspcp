import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');
import { agruparPorEtapa } from './src/lib/loteUtils';

async function test() {
  const { data: lote } = await supabase.from('lotes').select('*').eq('numero_lote', '2820').single();
  if(!lote) return console.log('Lote not found');

  const { data: prods } = await supabase.from('producoes_com_tempo').select('*').eq('lote_id', lote.id);
  
  const progresso = agruparPorEtapa(prods, lote.quantidade_total || 0, []);
  
  const tempoMedioLote = progresso.reduce((acc, curr) => {
      const unitarioEtapa = curr.quantidade_produzida > 0 ? curr.tempo_total / curr.quantidade_produzida : 0;
      return acc + unitarioEtapa;
  }, 0);
  
  console.log('TEMPO MEDIO:', tempoMedioLote);
  console.log('PROGRESSO:', JSON.stringify(progresso, null, 2));
}
test();
