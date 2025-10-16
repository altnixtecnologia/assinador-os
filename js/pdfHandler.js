// js/pdfHandler.js
export function setupPdfWorker() {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js`;
}

export async function extractDataFromPdf(source) {
    return new Promise(async (resolve, reject) => {
        try {
            let data;
            if (source instanceof File) {
                data = await source.arrayBuffer();
            } else if (typeof source === 'string') {
                // Para URLs do Supabase Storage, não precisamos de 'cors'
                const response = await fetch(source); 
                if (!response.ok) throw new Error(`Falha ao buscar PDF da URL: ${response.statusText}`);
                data = await response.arrayBuffer();
            } else {
                return reject(new Error("Fonte inválida para extração de PDF."));
            }

            const pdfBytes = new Uint8Array(data);
            const pdfDoc = await pdfjsLib.getDocument(pdfBytes).promise;
            let fullText = "";
            for (let i = 1; i <= pdfDoc.numPages; i++) {
                const page = await pdfDoc.getPage(i);
                const textContent = await page.getTextContent();
                fullText += textContent.items.map(item => item.str).join(" ") + "\n";
            }

            // console.log("Texto extraído do PDF:", fullText);

            const nomeRegex = /Cliente\s+([\s\S]+?)\s+\d{3}\.\d{3}\.\d{3}-\d{2}/i;
            const osRegex = /Ordem de serviço N°\s*(\d+)/i;
            const foneRegex = /(?:Celular|Telefone|Fone)\s*:\s*.*?(\(?\d{2}\)?\s*\d{4,5}-?\d{4})/i;
            const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;

            const nomeMatch = fullText.match(nomeRegex);
            const osMatch = fullText.match(osRegex);
            const foneMatch = fullText.match(foneRegex);
            const emailMatch = fullText.match(emailRegex);

            let statusOS = null;
            const palavrasChave = ["Concluído", "Entregue", "Garantia", "Não autorizou"];
            for (const palavra of palavrasChave) {
                if (fullText.toLowerCase().includes(palavra.toLowerCase())) {
                    statusOS = palavra;
                    break;
                }
            }

            resolve({
                nome: nomeMatch ? nomeMatch[1].replace(/\s+/g, ' ').trim() : '',
                telefone: foneMatch ? foneMatch[1].replace(/\D/g, '') : '',
                email: emailMatch ? emailMatch[1].trim() : '',
                n_os: osMatch ? osMatch[1].trim() : '',
                status_os: statusOS || ''
            });

        } catch (error) {
            console.error("Erro ao processar o PDF no cliente:", error);
            reject(error);
        }
    });
}
