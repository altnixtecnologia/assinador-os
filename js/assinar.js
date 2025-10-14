// js/assinar.js
import * as db from './supabaseService.js';
import { setupPdfWorker } from './pdfHandler.js';

setupPdfWorker();

document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos da UI ---
    const loadingView = document.getElementById('loading-view');
    const mainContent = document.getElementById('main-content');
    const loginStep = document.getElementById('login-step');
    const signingStep = document.getElementById('signing-step');
    const successStep = document.getElementById('success-step');
    const googleLoginBtn = document.getElementById('google-login-btn');
    const pdfViewer = document.getElementById('pdf-viewer');
    const signatureForm = document.getElementById('signature-form');
    const userNameInput = document.getElementById('user-name');
    const userEmailInput = document.getElementById('user-email');
    const userCpfInput = document.getElementById('user-cpf');
    const clearSignatureBtn = document.getElementById('clear-signature-btn');
    const submitSignatureBtn = document.getElementById('submit-signature-btn');
    const signaturePadCanvas = document.getElementById('signature-pad');
    const loginError = document.getElementById('login-error');
    const feedbackContainer = document.getElementById('feedback-container');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    
    const signaturePad = new SignaturePad(signaturePadCanvas);

    // --- Estado do Aplicativo ---
    let currentDocumentId = null;
    let currentUser = null;
    let pdfDoc = null; 
    let pdfScale = 1.0; 

    // --- Funções de UI ---
    function showView(viewToShow) {
        loadingView.classList.add('hidden');
        mainContent.classList.remove('hidden');
        [loginStep, signingStep, successStep].forEach(view => {
            if (view.id === viewToShow) {
                view.classList.remove('hidden');
            } else {
                view.classList.add('hidden');
            }
        });
    }

    function showFeedback(message, type = 'error', duration = 4000) {
        const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
        const feedbackEl = document.createElement('div');
        feedbackEl.className = `p-4 ${bgColor} text-white rounded-lg shadow-lg mb-2`;
        feedbackEl.textContent = message;
        feedbackContainer.appendChild(feedbackEl);
        setTimeout(() => feedbackEl.remove(), duration);
    }
    
    function resizeCanvas() {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        signaturePadCanvas.width = signaturePadCanvas.offsetWidth * ratio;
        signaturePadCanvas.height = signaturePadCanvas.offsetHeight * ratio;
        signaturePadCanvas.getContext("2d").scale(ratio, ratio);
        signaturePad.clear();
    }

    // --- LÓGICA DE RENDERIZAÇÃO E ZOOM DO PDF ---
    async function loadAndRenderPdf(url) {
        pdfViewer.innerHTML = '<div class="flex justify-center items-center h-full"><div class="loader"></div></div>';
        try {
            pdfDoc = await pdfjsLib.getDocument(url).promise;
            
            const firstPage = await pdfDoc.getPage(1);
            const containerWidth = pdfViewer.clientWidth;
            const viewport = firstPage.getViewport({ scale: 1.0 });
            pdfScale = containerWidth / viewport.width; 
            
            await renderAllPdfPages();
        } catch (error) {
            showFeedback('Não foi possível carregar o documento PDF.');
            console.error('Erro ao carregar PDF:', error);
        }
    }
    
    async function renderAllPdfPages() {
        if (!pdfDoc) return;
        pdfViewer.innerHTML = ''; 
        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: pdfScale });
            const canvas = document.createElement('canvas');
            canvas.style.display = 'block';
            canvas.style.margin = '0 auto 1rem auto';
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            pdfViewer.appendChild(canvas);
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        }
    }

    // --- Lógica Principal ---
    async function initializePage() {
        const params = new URLSearchParams(window.location.search);
        currentDocumentId = params.get('id');
        if (!currentDocumentId) {
            loadingView.innerHTML = `<p class="text-red-500 font-bold">ERRO: ID do documento não encontrado na URL.</p>`;
            return;
        }

        try {
            if (await db.checkIfSigned(currentDocumentId)) {
                showView('success-step');
                return;
            }
            const { data: { session } } = await db.supabase.auth.getSession();
            if (session) {
                await setupSigningView(session.user);
            } else {
                showView('login-step');
            }
        } catch (error) {
            loadingView.innerHTML = `<p class="text-red-500 font-bold">ERRO: Não foi possível verificar o documento.</p>`;
            console.error(error);
        }
    }
    
    async function setupSigningView(user) {
        currentUser = user;
        userNameInput.value = user.user_metadata.full_name || '';
        userEmailInput.value = user.email || '';
        showView('signing-step');
        setTimeout(resizeCanvas, 100);

        try {
            const doc = await db.getDocumentForSigning(currentDocumentId);
            const publicUrl = db.getPublicUrl(doc.caminho_arquivo_storage);
            await loadAndRenderPdf(publicUrl);
        } catch (error) {
            pdfViewer.innerHTML = '<p class="text-red-500 p-4">Erro: Não foi possível carregar o documento para assinatura.</p>';
            console.error(error);
        }
    }
    
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
            
            // ### CORREÇÃO APLICADA AQUI ###
            // Chamando a nova e correta função 'submitSignature'
            await db.submitSignature({
                documento_id: currentDocumentId,
                nome_signatario: currentUser.user_metadata.full_name,
                email_signatario: currentUser.email,
                cpf_cnpj_signatario: userCpfInput.value,
                imagem_assinatura_base64: signatureImage,
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

    // --- Event Listeners ---
    googleLoginBtn.addEventListener('click', async () => {
        try {
            await db.signInWithGoogle();
        } catch (error) {
            loginError.textContent = `Erro no login: ${error.message}`;
        }
    });

    zoomInBtn.addEventListener('click', () => {
        if (!pdfDoc) return;
        pdfScale += 0.2;
        renderAllPdfPages();
    });

    zoomOutBtn.addEventListener('click', () => {
        if (!pdfDoc || pdfScale <= 0.2) return;
        pdfScale -= 0.2;
        renderAllPdfPages();
    });

    signatureForm.addEventListener('submit', handleSignatureSubmit);
    clearSignatureBtn.addEventListener('click', () => signaturePad.clear());
    window.addEventListener('resize', resizeCanvas);
    
    db.supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
            setupSigningView(session.user);
        }
    });
    
    initializePage();
});
