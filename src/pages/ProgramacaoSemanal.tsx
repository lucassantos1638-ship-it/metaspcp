import { Card } from "@/components/ui/card";
import { Calendar } from "lucide-react";

export default function ProgramacaoSemanal() {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Programação Semanal</h1>
            </div>
            
            <Card className="p-6">
                <div className="flex flex-col items-center justify-center text-slate-500 py-12">
                    <Calendar className="w-16 h-16 mb-4 text-slate-300" />
                    <h2 className="text-xl font-semibold mb-2">Programação Semanal</h2>
                    <p>Em breve você poderá gerenciar a programação semanal aqui.</p>
                </div>
            </Card>
        </div>
    );
}
