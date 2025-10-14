// js/pdfHandler.js

/**
 * Módulo para manipulação de arquivos PDF.
 * Contém a lógica de extração de texto e dados usando a biblioteca pdf.js.
 */

// Define o worker para a pdf.js. Deve ser chamado uma vez no script principal.
export function setupPdfWorker() {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js`;
}

/**
 * Extrai nome, telefone, email e N° da OS do texto de um PDF.
 * @param {File} file - O arquivo PDF.
 * @returns {Promise<object>} - Um objeto com os dados extraídos.
 */
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
                const nomeRegex = /Cliente\s*:\s*([\s\S]+?)(?:Endereço:|CPF\/CNPJ:|Fone:|Celular:|Email:)/i;
                const osRegex = /Ordem de serviço N°\s*(\d+)/i;
                const celularRegex = /Celular\s*:\s*([()\d\s-]+)/i;
                const foneRegex = /(?:Telefone|Fone)\s*:\s*([()\d\s-]+)/i;
                const emailRegex = /(?:Email|E-mail)\s*:\s*([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;

                const nomeMatch = fullText.match(nomeRegex);
                const osMatch = fullText.match(osRegex);
                const celularMatch = fullText.match(celularRegex);
                const foneMatch = fullText.match(foneRegex);
                const emailMatch = fullText.match(emailRegex);

                let telefoneFinal = '';
                if (celularMatch && celularMatch[1]) {
                    telefoneFinal = celularMatch[1].trim().replace(/\D/g, '');
                } else if (foneMatch && foneMatch[1]) {
                    telefoneFinal = foneMatch[1].trim().replace(/\D/g, '');
                }

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
                    telefone: telefoneFinal,
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
