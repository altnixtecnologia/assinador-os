// Configuração do Supabase e do Site (não muda)
// ...

// --- Elementos da UI (com adições para o novo modal) ---
// ... (elementos antigos)
const deleteConfirmModal = document.getElementById('delete-confirm-modal');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const deleteCheckbox = document.getElementById('delete-checkbox');

// --- Estado do Aplicativo ---
let docIdParaExcluir = null;
// ... (outras variáveis de estado)


// --- FUNÇÃO DE EXCLUIR ATUALIZADA ---
async function excluirDocumento(docId) {
    // Em vez de confirmar, agora preparamos e abrimos o modal
    docIdParaExcluir = docId;
    deleteCheckbox.checked = false; // Garante que a caixa começa desmarcada
    confirmDeleteBtn.disabled = true; // Garante que o botão começa desabilitado
    confirmDeleteBtn.classList.add('btn-disabled');
    deleteConfirmModal.classList.add('active');
}

// NOVA FUNÇÃO para executar a exclusão após a confirmação no modal
async function executarExclusao() {
    if (!docIdParaExcluir) return;

    confirmDeleteBtn.textContent = 'Excluindo...';
    
    try {
        await supabase.from('assinaturas').delete().eq('documento_id', docIdParaExcluir);
        await supabase.from('documentos').delete().eq('id', docIdParaExcluir);
        
        alert('Documento excluído com sucesso!');
        fecharModalExclusao();
        carregarDocumentos(); // Recarrega a lista
    } catch (error) {
        alert(`Erro ao excluir o documento: ${error.message}`);
    } finally {
        confirmDeleteBtn.textContent = 'Confirmar Exclusão';
    }
}

// NOVA FUNÇÃO para fechar o modal de exclusão
function fecharModalExclusao() {
    docIdParaExcluir = null;
    deleteConfirmModal.classList.remove('active');
}


// --- O RESTANTE DO CÓDIGO ---
// Para garantir, aqui está o arquivo 100% completo, com todas as funções e listeners no lugar certo.

const SUPABASE_URL = 'https://nlefwzyyhspyqcicfouc.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sZWZ3enl5aHNweXFjaWNmb3VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMzAyMzMsImV4cCI6MjA3NTgwNjIzM30.CpKg1MKbcTtEUfmGDzcXPvZoTQH3dygUL61yYYiLPyQ';
const SITE_BASE_URL = 'https://altnixtecnologia.github.io/assinador-os';
const supabase = self.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Elementos da UI
const uploadForm = document.getElementById('upload-form');
const osFileInput = document.getElementById('os-file');
const clienteNomeInput = document.getElementById('cliente-nome');
const clienteTelefoneInput = document.getElementById('cliente-telefone');
const clienteEmailInput = document.getElementById('cliente-email');
const submitButton = document.getElementById('submit-button');
const feedbackMessage = document.getElementById('feedback-message');
const actionsContainer = document.getElementById('actions-container');
const linkInput = document.getElementById('link-gerado-input');
const copiarBtn = document.getElementById('copiar-link-btn');
const whatsappBtn = document.getElementById('whatsapp-btn');
const whatsappContainer = document.getElementById('whatsapp-container');
const documentList = document.getElementById('document-list');
const listLoadingFeedback = document.getElementById('list-loading-feedback');
const statusFilterButtons = document.getElementById('status-filter-buttons');
const searchInput = document.getElementById('search-input');
const detailsModal = document.getElementById('details-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const modalContent = document.getElementById('modal-content');
const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');
const pageInfo = document.getElementById('page-info');

// Estado do App
let currentPage = 0;
const ITENS_PER_PAGE = 50;
let totalDocuments = 0;
let currentStatusFilter = 'todos';
let currentSearchTerm = '';
let debounceTimer;
let allDocumentsData = []; 

// Funções
async function processarArquivoPDF(file) { /* ... (código sem alteração) ... */ }
function sanitizarNomeArquivo(nome) { /* ... (código sem alteração) ... */ }
async function carregarDocumentos() { /* ... (código sem alteração) ... */ }
function renderizarLista(docs) { /* ... (código sem alteração) ... */ }
function atualizarControlesPaginacao() { /* ... (código sem alteração) ... */ }
function abrirModalDetalhes(doc) { /* ... (código sem alteração) ... */ }
function setLoading(isLoading) { /* ... (código sem alteração) ... */ }
function showFeedback(message, type) { /* ... (código sem alteração) ... */ }

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', carregarDocumentos);
osFileInput.addEventListener('change', (event) => { /* ... (código sem alteração) ... */ });
uploadForm.addEventListener('submit', async (event) => { /* ... (código sem alteração) ... */ });
copiarBtn.addEventListener('click', () => { /* ... (código sem alteração) ... */ });
whatsappBtn.addEventListener('click', () => { /* ... (código sem alteração) ... */ });
documentList.addEventListener('click', (e) => {
    const target = e.target;
    const docId = target.dataset.docId;
    if (target.classList.contains('download-btn')) {
        const path = target.dataset.path;
        const { data } = supabase.storage.from('documentos').getPublicUrl(path);
        window.open(data.publicUrl, '_blank');
    }
    if (target.classList.contains('ver-detalhes-btn')) {
        const doc = allDocumentsData.find(d => d.id === docId);
        if (doc && doc.assinaturas && doc.assinaturas.length > 0) {
            abrirModalDetalhes(doc);
        }
    }
    if (target.classList.contains('excluir-btn')) {
        excluirDocumento(docId); // A função `excluirDocumento` agora abre o modal
    }
});
statusFilterButtons.addEventListener('click', (e) => { /* ... (código sem alteração) ... */ });
searchInput.addEventListener('input', () => { /* ... (código sem alteração) ... */ });
prevPageBtn.addEventListener('click', () => { /* ... (código sem alteração) ... */ });
nextPageBtn.addEventListener('click', () => { /* ... (código sem alteração) ... */ });
closeModalBtn.addEventListener('click', () => { detailsModal.classList.remove('active'); });

// NOVOS LISTENERS PARA O MODAL DE EXCLUSÃO
deleteCheckbox.addEventListener('change', () => {
    if (deleteCheckbox.checked) {
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.classList.remove('btn-disabled');
    } else {
        confirmDeleteBtn.disabled = true;
        confirmDeleteBtn.classList.add('btn-disabled');
    }
});
cancelDeleteBtn.addEventListener('click', fecharModalExclusao);
confirmDeleteBtn.addEventListener('click', executarExclusao);
