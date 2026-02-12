
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase URL or Key in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectLot() {
    const lotNumber = 1313;
    console.log(`Inspecting Lot #${lotNumber}...`);

    // 1. Get Lot ID and Quantity
    const { data: lot, error: lotError } = await supabase
        .from('lotes')
        .select('*')
        .eq('numero_lote', lotNumber)
        .single();

    if (lotError) {
        console.error("Error fetching lot:", lotError);
        return;
    }

    console.log("Lot Data:", {
        id: lot.id,
        numero_lote: lot.numero_lote,
        quantidade: lot.quantidade,
        quantidade_total: lot.quantidade_total
    });

    // 2. Get Material Consumption
    const { data: consumos, error: consError } = await supabase
        .from('lote_consumo')
        .select(`
      id,
      quantidade_real,
      material:materiais(id, nome, preco_custo, unidade_medida)
    `)
        .eq('lote_id', lot.id);

    if (consError) {
        console.error("Error fetching consumption:", consError);
        return;
    }

    console.log("\nConsumption Data:");
    let totalMaterialCost = 0;
    consumos.forEach(c => {
        const qty = Number(c.quantidade_real) || 0;
        const cost = Number(c.material?.preco_custo) || 0;
        const total = qty * cost;
        totalMaterialCost += total;
        console.log(`- Material: ${c.material?.nome} | Qty: ${qty} (${c.material?.unidade_medida}) | Unit Cost: ${cost} | Total: ${total}`);
    });

    console.log("\n--- Analysis ---");
    console.log(`Total Consumption Cost: ${totalMaterialCost.toFixed(2)}`);

    const quantidadeParaCalculo = lot.quantidade || lot.quantidade_total || 0;
    console.log(`Lot Quantity (Divisor): ${quantidadeParaCalculo}`);

    if (quantidadeParaCalculo > 0) {
        const unitCost = totalMaterialCost / quantidadeParaCalculo;
        console.log(`Calculated Unit Material Cost: ${unitCost.toFixed(4)}`);
    } else {
        console.log("Cannot calculate unit cost (quantity is 0)");
    }
}

inspectLot();
