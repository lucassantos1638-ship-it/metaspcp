import * as pdfjsLib from 'pdfjs-dist';

// Configurando o worker do PDF.js para funcionar com Vite
// Usa o CDN como fallback seguro caso o import de URL local dê problema
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  
  // Carrega o documento PDF
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdfDocument = await loadingTask.promise;
  
  const numPages = pdfDocument.numPages;
  let fullText = "";

  // Itera por todas as páginas
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDocument.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Extrai o texto dos itens e junta tudo
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(" ");
      
    fullText += `--- Página ${pageNum} ---\n${pageText}\n\n`;
  }

  return fullText;
}
