// js/pdfHandler.js

export function setupPdfWorker() {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js`;
}

export async function extractDataFromPdf(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function() {
            try {
                const pdfBytes = new Uint8Array(this.result);
                const pdfDoc = await pdfjsLib.getDocument(pdfBytes).promise;
                let fullText = "";
                for (let i = 1; i <= pdfDoc.numPages; i++) {
                    const page = await pdfDoc.getPage(i);
                    const textContent = await page.getTextContent();
                    fullText += textContent.items.map(item => item.str).join(" ") + "\n";
                }

                // --- Regex Melhoradas ---
                const nomeRegex = /Cliente\s*:\s*(.*)/i;
                const osRegex = /Ordem de serviço N°\s*(\d+)/i;
                // ATUALIZADO AQUI: Regex mais específica para telefone
                const foneRegex = /(?:Celular|Telefone|Fone)\s*:\s*.*?(\(?\d{2}\)?\s*\d{4,5}-?\d{4})/i;
                const emailRegex = /(?:Email|E-mail)\s*:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;

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
                    nome: nomeMatch ? nomeMatch[1].trim() : '',
                    telefone: foneMatch ? foneMatch[1].replace(/\D/g, '') : '',
                    email: emailMatch ? emailMatch[1].trim() : '',
                    n_os: osMatch ? osMatch[1].trim() : '',
                    status_os: statusOS || ''
                });

            } catch (error) {
                console.error("Erro ao processar o PDF no cliente:", error);
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
}
