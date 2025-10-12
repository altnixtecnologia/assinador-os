// Configuração do Supabase com a chave correta
const SUPABASE_URL = 'https://nlefwzyyhspyqcicfouc.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sZWZ3enl5aHNweXFjaWNmb3VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMzAyMzMsImV4cCI6MjA3NTgwNjIzM30.CpKg1MKbcTtEUfmGDzcXPvZoTQH3dygUL61yYYiLPyQ';

const supabase = self.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';

// Seleção de Elementos da UI
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
const signaturePad = new SignaturePad(signaturePadCanvas);

let currentDocumentId = null;
let currentUser = null;

// Função para recalibrar a área de assinatura
function resizeCanvas() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    signaturePadCanvas.width = signaturePadCanvas.offsetWidth * ratio;
    signaturePadCanvas.height = signaturePadCanvas.offsetHeight * ratio;
    signaturePadCanvas.getContext("2d").scale(ratio, ratio);
    signaturePad.clear();
}

async function init() {
    const params = new URLSearchParams(window.location.search);
    currentDocumentId = params.get('id');
    if (!currentDocumentId) {
        showError("ID do documento não encontrado na URL.");
        return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        const { data: existingSignature } = await supabase.from('assinaturas').select('id').eq('documento_id', currentDocumentId).single();
        if (existingSignature) {
            showSuccessView();
            return;
        }
        loadingView.classList.add('hidden');
        mainContent.classList.remove('hidden');
    }
}

// Função de login com Google
async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
    });
    if (error) {
        document.getElementById('login-error').textContent = `Erro no login: ${error.message}`;
    }
}

// Função para renderizar o PDF com escala dinâmica (responsivo)
async function renderPdf(url) {
    pdfViewer.innerHTML = '<div class="flex justify-center items-center h-full"><div class="loader"></div></div>';
    try {
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        pdfViewer.innerHTML = '';
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const containerWidth = pdfViewer.clientWidth;
            const desiredWidth = containerWidth * 0.95;
            const scale = desiredWidth / page.getViewport({ scale: 1 }).width;
            const viewport = page.getViewport({ scale: scale });
            const canvas = document.createElement('canvas');
            canvas.style.marginBottom = '1rem';
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            pdfViewer.appendChild(canvas);
            await page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
        }
    } catch (error) {
        showError('Não foi possível carregar o PDF.');
        console.error('Erro ao renderizar PDF:', error);
    }
}

async function handleSignatureSubmit(event) {
    event.preventDefault();
    if (signaturePad.isEmpty()) { alert("Por favor, forneça sua assinatura."); return; }
    submitSignatureBtn.disabled = true;
    submitSignatureBtn.textContent = 'Enviando...';
    const signatureImage = signaturePad.toDataURL('image/png');
    try {
        const { error } = await supabase.from('assinaturas').insert({
            documento_id: currentDocumentId,
            nome_signatario: currentUser.user_metadata.full_name,
            email_signatario: currentUser.email,
            cpf_cnpj_signatario: userCpfInput.value,
            imagem_assinatura_base64: signatureImage,
        });
        if (error) throw error;
        await supabase.from('documentos').update({ status: 'assinado' }).eq('id', currentDocumentId);
        showSuccessView();
    } catch (error) {
        alert(`Erro ao salvar assinatura: ${error.message}`);
    } finally {
        submitSignatureBtn.disabled = false;
        submitSignatureBtn.textContent = 'Assinar e Finalizar';
    }
}

function showSigningView(user) {
    currentUser = user;
    userNameInput.value = user.user_metadata.full_name || '';
    userEmailInput.value = user.email || '';
    loginStep.classList.add('hidden');
    mainContent.classList.remove('hidden');
    signingStep.classList.remove('hidden');
    loadingView.classList.add('hidden');
    loadDocumentForSigning();
    setTimeout(() => { resizeCanvas(); }, 100);
}

function showSuccessView() {
    loadingView.classList.add('hidden');
    mainContent.classList.remove('hidden');
    loginStep.classList.add('hidden');
    signingStep.classList.add('hidden');
    successStep.classList.remove('hidden');
}

function showError(message) {
    loadingView.innerHTML = `<p class="text-red-500 font-bold">${message}</p>`;
}

async function loadDocumentForSigning() {
    const { data: doc, error } = await supabase.from('documentos').select('caminho_arquivo_storage').eq('id', currentDocumentId).single();
    if (error || !doc) {
        pdfViewer.innerHTML = '<p class="text-red-500 p-4">Erro: Documento não encontrado.</p>';
        return;
    }
    const { data: publicUrlData } = supabase.storage.from('documentos').getPublicUrl(doc.caminho_arquivo_storage);
    renderPdf(publicUrlData.publicUrl);
}

// Event Listeners
window.addEventListener('DOMContentLoaded', init);
googleLoginBtn.addEventListener('click', handleGoogleLogin);
signatureForm.addEventListener('submit', handleSignatureSubmit);
clearSignatureBtn.addEventListener('click', () => signaturePad.clear());

supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
        showSigningView(session.user);
    }
});

window.addEventListener('resize', resizeCanvas);
