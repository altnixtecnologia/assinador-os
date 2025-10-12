// Configuração do Supabase (não muda)
const SUPABASE_URL = 'https://nlefwzyyhspyqcicfouc.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sZWZ3enl5aHNweXFjaWNmb3VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMzAyMzMsImV4cCI6MjA3NTgwNjIzM30.CpKg1MKbcTtEUfmGDzcXPvZoTQH3dygUL61yYYiLPyQ';
const SITE_BASE_URL = 'https://altnixtecnologia.github.io/assinador-os';
const supabase = self.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- SEÇÃO DE ENVIO DE ARQUIVOS (código antigo, sem alterações) ---

const uploadForm = document.getElementById('upload-form');
const osFileInput = document.getElementById('os-file');
const clienteEmailInput = document.getElementById('cliente-email');
const submitButton = document.getElementById('submit-button');
const feedbackMessage = document.getElementById('feedback-message');
const linkContainer = document.getElementById('link-gerado-container');
const linkInput = document.getElementById('link-gerado-input');
const copiarBtn = document.getElementById('copiar-link-btn');

function sanitizarNomeArquivo(nome) { /* ... (código antigo) ... */ }

uploadForm.addEventListener('submit', async (event) => { /* ... (código antigo) ... */ });
copiarBtn.addEventListener('click', () => { /* ... (código antigo) ... */ });
function setLoading(isLoading) { /* ... (código antigo) ... */ }
function showFeedback(message, type) { /* ... (código antigo) ... */ }

// --- NOVA SEÇÃO DE CONSULTA DE DOCUMENTOS ---

// Elementos da UI da nova seção
const documentList = document.getElementById('document-list');
const listLoadingFeedback = document.getElementById('list-loading-feedback');
const statusFilterButtons = document.getElementById('status-filter-buttons');
const searchInput = document.getElementById('search-input');
const detailsModal = document.getElementById('details-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const modalContent = document.getElementById('modal-content');

// Variáveis para guardar os dados e filtros
let allDocuments = [];
let currentStatusFilter = 'todos';
let currentSearchTerm = '';

// Função principal que busca os dados no Supabase
async function carregarDocumentos() {
    listLoadingFeedback.textContent = "Carregando documentos...";
    documentList.innerHTML = '';

    const { data, error } = await supabase
        .from('documentos')
        .select(`
            *,
            assinaturas ( * )
        `)
        .order('created_at', { ascending: false });

    if (error) {
        listLoadingFeedback.textContent = `Erro ao carregar documentos: ${error.message}`;
        return;
    }

    allDocuments = data;
    renderizarLista();
}

// Função que desenha a lista de documentos na tela
function renderizarLista() {
    documentList.innerHTML = '';
    
    let filteredDocuments = allDocuments;

    // 1. Aplica filtro de Status
    if (currentStatusFilter !== 'todos') {
        filteredDocuments = filteredDocuments.filter(doc => doc.status === currentStatusFilter);
    }

    // 2. Aplica filtro de Busca
    if (currentSearchTerm) {
        const lowerCaseSearch = currentSearchTerm.toLowerCase();
        filteredDocuments = filteredDocuments.filter(doc => 
            (doc.caminho_arquivo_storage && doc.caminho_arquivo_storage.toLowerCase().includes(lowerCaseSearch)) ||
            (doc.cliente_email && doc.cliente_email.toLowerCase().includes(lowerCaseSearch)) ||
            (doc.assinaturas[0] && doc.assinaturas[0].nome_signatario && doc.assinaturas[0].nome_signatario.toLowerCase().includes(lowerCaseSearch)) ||
            (doc.assinaturas[0] && doc.assinaturas[0].cpf_cnpj_signatario && doc.assinaturas[0].cpf_cnpj_signatario.toLowerCase().includes(lowerCaseSearch))
        );
    }

    if (filteredDocuments.length === 0) {
        documentList.innerHTML = '<p class="text-center text-gray-500 py-8">Nenhum documento encontrado.</p>';
        return;
    }

    filteredDocuments.forEach(doc => {
        const assinatura = doc.assinaturas[0]; // Pega a primeira (e única) assinatura
        const card = document.createElement('div');
        card.className = 'border rounded-lg p-4 bg-gray-50 shadow-sm';

        const statusClass = doc.status === 'assinado' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
        const statusText = doc.status === 'assinado' ? 'Assinado ✅' : 'Pendente ⏳';

        const dataEnvio = new Date(doc.created_at).toLocaleDateString('pt-BR');

        card.innerHTML = `
            <div class="flex flex-col sm:flex-row justify-between sm:items-center">
                <div class="flex-grow mb-4 sm:mb-0">
                    <p class="font-bold text-gray-800">${doc.caminho_arquivo_storage.split('-').slice(1).join('-')}</p>
                    <p class="text-sm text-gray-500">
                        ${assinatura ? `Assinado por: ${assinatura.nome_signatario || 'N/A'}` : `Enviado para: ${doc.cliente_email || 'N/A'}`}
                    </p>
                </div>
                <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <span class="text-xs font-medium px-2.5 py-1 rounded-full ${statusClass}">${statusText}</span>
                    <span class="text-sm text-gray-600">Enviado em: ${dataEnvio}</span>
                    <div class="flex gap-2">
                        <button class="download-original-btn text-sm text-blue-600 hover:underline" data-path="${doc.caminho_arquivo_storage}">Baixar Original</button>
                        ${doc.status === 'assinado' ? `
                            <button class="download-assinado-btn text-sm text-green-600 hover:underline" data-path="${doc.caminho_arquivo_assinado}">Baixar Assinado</button>
                            <button class="ver-detalhes-btn text-sm text-gray-600 hover:underline" data-doc-id="${doc.id}">Ver Detalhes</button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
        documentList.appendChild(card);
    });
}

// Funções para lidar com os cliques nos botões
documentList.addEventListener('click', (e) => {
    if (e.target.classList.contains('download-original-btn')) {
        const path = e.target.dataset.path;
        const { data } = supabase.storage.from('documentos').getPublicUrl(path);
        window.open(data.publicUrl, '_blank');
    }
    if (e.target.classList.contains('download-assinado-btn')) {
        const path = e.target.dataset.path;
        const { data } = supabase.storage.from('documentos').getPublicUrl(path);
        window.open(data.publicUrl, '_blank');
    }
    if (e.target.classList.contains('ver-detalhes-btn')) {
        const docId = e.target.dataset.docId;
        const doc = allDocuments.find(d => d.id === docId);
        if (doc && doc.assinaturas[0]) {
            abrirModalDetalhes(doc.assinaturas[0]);
        }
    }
});

// Funções dos filtros
statusFilterButtons.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
        currentStatusFilter = e.target.dataset.status;
        // Atualiza a aparência dos botões
        statusFilterButtons.querySelectorAll('button').forEach(btn => {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('bg-white', 'text-gray-700');
        });
        e.target.classList.add('bg-blue-600', 'text-white');
        e.target.classList.remove('bg-white', 'text-gray-700');
        
        renderizarLista();
    }
});

searchInput.addEventListener('input', () => {
    currentSearchTerm = searchInput.value;
    // Debounce para não buscar a cada tecla digitada
    setTimeout(() => {
        renderizarLista();
    }, 300);
});

// Funções do Modal de Detalhes
function abrirModalDetalhes(assinatura) {
    modalContent.innerHTML = `
        <p><strong>Nome do Assinante:</strong> ${assinatura.nome_signatario}</p>
        <p><strong>Email:</strong> ${assinatura.email_signatario}</p>
        <p><strong>CPF/CNPJ:</strong> ${assinatura.cpf_cnpj_signatario}</p>
        <p><strong>Data da Assinatura:</strong> ${new Date(assinatura.assinado_em).toLocaleString('pt-BR')}</p>
        <div>
            <p><strong>Assinatura Gráfica:</strong></p>
            <img src="${assinatura.imagem_assinatura_base64}" class="border mt-2" alt="Assinatura">
        </div>
    `;
    detailsModal.classList.add('active');
}

closeModalBtn.addEventListener('click', () => {
    detailsModal.classList.remove('active');
});

// --- INICIALIZAÇÃO ---
// Adiciona o código antigo que já tínhamos para garantir que a página continue funcionando por completo
document.addEventListener('DOMContentLoaded', () => {
    // Código antigo para upload
    function sanitizarNomeArquivo(nome) {
        const nomeSemAcentos = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return nomeSemAcentos.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9.\-_]/g, '_');
    }

    uploadForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const file = osFileInput.files[0];
        const email = clienteEmailInput.value || null;
        if (!file) { showFeedback('Por favor, selecione um arquivo PDF.', 'error'); return; }
        linkContainer.classList.add('hidden');
        setLoading(true);
        try {
            const fileName = `${Date.now()}-${sanitizarNomeArquivo(file.name)}`;
            const { data: uploadData, error: uploadError } = await supabase.storage.from('documentos').upload(fileName, file);
            if (uploadError) throw uploadError;
            const { data: insertData, error: insertError } = await supabase.from('documentos').insert({ caminho_arquivo_storage: uploadData.path, cliente_email: email }).select('id').single();
            if (insertError) throw insertError;
            const documentoId = insertData.id;
            const linkDeAssinatura = `${SITE_BASE_URL}/assinar.html?id=${documentoId}`;
            linkInput.value = linkDeAssinatura;
            linkContainer.classList.remove('hidden');
            showFeedback('Link gerado! Copie e envie para seu cliente via WhatsApp.', 'success');
            uploadForm.reset();
            
            // Recarrega a lista após o sucesso do upload
            carregarDocumentos();

        } catch (error) {
            console.error('Erro no processo:', error);
            showFeedback(`Erro: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    });

    copiarBtn.addEventListener('click', () => {
        linkInput.select();
        navigator.clipboard.writeText(linkInput.value);
        copiarBtn.textContent = 'Copiado!';
        setTimeout(() => { copiarBtn.textContent = 'Copiar'; }, 2000);
    });

    function setLoading(isLoading) {
        if (isLoading) {
            submitButton.disabled = true;
            submitButton.innerHTML = `<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Gerando...`;
            feedbackMessage.textContent = '';
        } else {
            submitButton.disabled = false;
            submitButton.textContent = 'Gerar Link de Assinatura';
        }
    }

    function showFeedback(message, type) {
        feedbackMessage.textContent = message;
        feedbackMessage.className = `mt-4 text-center text-sm ${type === 'success' ? 'text-green-600' : 'text-red-600'}`;
    }

    // Carrega a lista de documentos quando a página abre
    carregarDocumentos();
});
