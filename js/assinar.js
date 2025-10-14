// js/assinar.js
import * as db from './supabaseService.js';
import { setupPdfWorker } from './pdfHandler.js';

setupPdfWorker();

document.addEventListener('DOMContentLoaded', () => {
    // ... (todo o início do arquivo, seletores e estado permanecem os mesmos) ...
    const signaturePad = new SignaturePad(signaturePadCanvas);
    let currentUser = null;
    let currentDocumentId = null;
    // ... (resto das variáveis de estado) ...
    
    // ... (todas as funções de UI e renderização de PDF permanecem as mesmas) ...

    async function handleSignatureSubmit(event) {
        event.preventDefault();
        
        const cpfCnpjValue = userCpfInput.value.replace(/\D/g, '');
        if (cpfCnpjValue.length !== 11 && cpfCnpjValue.length !== 14) {
            showFeedback('CPF ou CNPJ inválido. Verifique o número de dígitos.');
            return;
        }
        if (signaturePad.isEmpty()) {
            showFeedback("Por favor, forneça sua assinatura no campo designado.");
            return;
        }

        submitSignatureBtn.disabled = true;
        submitSignatureBtn.textContent = 'Enviando...';

        try {
            const signatureImage = signaturePad.toDataURL('image/png');
            
            // ATUALIZADO AQUI: Captura a data/hora local formatada
            const dataHoraLocalFormatada = new Date().toLocaleString('pt-BR', {
                timeZone: 'America/Sao_Paulo' // Garante o fuso horário correto
            });
            
            await db.submitSignature({
                documento_id: currentDocumentId,
                nome_signatario: currentUser.user_metadata.full_name,
                email_signatario: currentUser.email,
                cpf_cnpj_signatario: userCpfInput.value,
                imagem_assinatura_base64: signatureImage,
                data_hora_local: dataHoraLocalFormatada, // Envia a data formatada
            });

            showView('success-step');

        } catch (error) {
            showFeedback(`Erro ao salvar assinatura: ${error.message}`);
            console.error(error);
        } finally {
            submitSignatureBtn.disabled = false;
            submitSignatureBtn.textContent = 'Assinar e Finalizar';
        }
    }

    // ... (todos os Event Listeners permanecem os mesmos) ...
    
    initializePage();
});
