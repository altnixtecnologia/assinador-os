// Configuração do Supabase
const SUPABASE_URL = 'https://nlefwzyyhspyqcicfouc.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sZWZ3enl5aHNweXFjaWNmb3VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMzAyMzMsImV4cCI6MjA3NTgwNjIzM30.CpKg1MKbcTtEUfmGDzcXPvZoTQH3dygUL61yYYiLPyQ';
const SITE_BASE_URL = 'https://altnixtecnologia.github.io/assinador-os';
const supabase = self.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Elementos da UI ---
const uploadForm = document.getElementById('upload-form');
const osFileInput = document.getElementById('os-file');
const clienteNomeInput = document.getElementById('cliente-nome');
const clienteIdInput = document.getElementById('cliente-id');
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

// --- Estado do Aplicativo ---
let currentPage = 0;
const ITENS_PER_PAGE = 50;
let totalDocuments = 0;
let currentStatusFilter = 'todos';
let currentSearchTerm = '';
let debounceTimer;
let allDocumentsData = []; 

// --- Funções ---

async function processarArquivoPDF(file) {
    showFeedback('Lendo dados do PDF...', 'info');
    try {
        const { data, error } = await supabase.functions.invoke('processar-pdf', {
            body: file,
            headers: { 'Content-Type': 'application/pdf' }
        });
        if (error) throw error;
        
        // Atualiza os campos do formulário com os dados retornados
        if (data.nome_cliente) clienteNomeInput.value = data.nome_cliente;
        // O id_cliente agora é o N° da OS, mas não temos um campo para ele no formulário de envio
        if (data.telefone_cliente) clienteTelefoneInput.value = data.telefone_cliente;
        
        showFeedback('Dados extraídos do PDF! Verifique e prossiga.', 'success');

        // Salva os dados extraídos para serem enviados com o formulário principal
        uploadForm.dataset.extractedOs = data.id_cliente || '';
        uploadForm.dataset.extractedData = data.dados_adicionais || '';

    } catch (error) {
        console.error("Erro ao processar o PDF:", error);
        showFeedback('Não foi possível ler os dados do PDF. Preencha manualmente.', 'error');
    }
}

function sanitizarNomeArquivo(nome) {
    const nomeSemAcentos = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return nomeSemAcentos.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9.\-_]/g, '_');
}

async function carregarDocumentos() {
    listLoadingFeedback.style.display = 'block';
    listLoadingFeedback.textContent = "Carregando documentos...";
    documentList.innerHTML = '';

    const from = currentPage * ITENS_PER_PAGE;
    const to = from + ITENS_PER_PAGE - 1;

    // ATUALIZADO: Adicionamos n_os e dados_adicionais ao select
    let query = supabase
        .from('documentos')
        .select(`
            id, created_at, status, cliente_email, nome_cliente, id_cliente, n_os, dados_adicionais,
            caminho_arquivo_storage, caminho_arquivo_assinado,
            assinaturas ( nome_signatario, cpf_cnpj_signatario, email_signatario, assinado_em, imagem_assinatura_base64 )
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

    if (currentStatusFilter !== 'todos') {
        query = query.eq('status', currentStatusFilter);
    }
    if (currentSearchTerm) {
        // ATUALIZADO: Adicionamos n_os à busca
        query = query.or(`caminho_arquivo_storage.ilike.%${currentSearchTerm}%,cliente_email.ilike.%${currentSearchTerm}%,nome_cliente.ilike.%${currentSearchTerm}%,n_os.ilike.%${currentSearchTerm}%,assinaturas.nome_signatario.ilike.%${currentSearchTerm}%`);
    }

    const { data, error, count } = await query;

    listLoadingFeedback.style.display = 'none';

    if (error) {
        documentList.innerHTML = `<p class="text-center text-red-500 py-8">Erro ao carregar documentos: ${error.message}</p>`;
        return;
    }

    allDocumentsData = data;
    totalDocuments = count;
    renderizarLista(data);
    atualizarControlesPaginacao();
}

function renderizarLista(docs) {
    documentList.innerHTML = '';
    if (!docs || docs.length === 0) {
        documentList.innerHTML = '<p class="text-center text-gray-500 py-8">Nenhum documento encontrado.</p>';
        return;
    }

    docs.forEach(doc => {
        const assinatura = doc.assinaturas && doc.assinaturas.length > 0 ? doc.assinaturas[0] : null;
        const card = document.createElement('div');
        card.className = 'border rounded-lg p-4 bg-gray-50 shadow-sm';
        const statusClass = doc.status === 'assinado' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
        const statusText = doc.status === 'assinado' ? 'Assinado ✅' : 'Pendente ⏳';
        const dataEnvio = new Date(doc.created_at).toLocaleDateString('pt-BR');
        const nomeArquivoOriginal = doc.caminho_arquivo_storage.split('-').slice(1).join('-') || doc.caminho_arquivo_storage;

        // ATUALIZADO: HTML do card para mostrar os novos dados
        card.innerHTML = `
            <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div class="flex-grow min-w-0">
                    <p class="font-bold text-gray-800 break-all">${nomeArquivoOriginal}</p>
                    <p class="text-sm text-gray-500 truncate">
                        ${doc.nome_cliente ? `Cliente: ${doc.nome_cliente}` : (assinatura ? `Assinado por: ${assinatura.nome_signatario}` : '')}
                    </p>
                    ${doc.n_os ? `<p class="text-sm text-gray-500">OS N°: ${doc.n_os}</p>` : ''}
                </div>
                <div class="flex-shrink-0 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div class="flex flex-col items-start sm:items-end">
                        <span class="text-xs font-medium px-2.5 py-1 rounded-full ${statusClass}">${statusText}</span>
                        ${doc.dados_adicionais ? `<span class="text-xs font-semibold mt-1 text-blue-800">${doc.dados_adicionais}</span>` : ''}
                    </div>
                    <span class="text-sm text-gray-600">Enviado em: ${dataEnvio}</span>
                    <div class="flex gap-2 flex-wrap">
                        <button class="download-btn text-sm text-blue-600 hover:underline" data-path="${doc.caminho_arquivo_storage}">Original</button>
                        ${doc.status === 'assinado' && doc.caminho_arquivo_assinado ? `<button class="download-btn text-sm text-green-600 hover:underline" data-path="${doc.caminho_arquivo_assinado}">Assinado</button>` : ''}
                        ${assinatura ? `<button class="ver-detalhes-btn text-sm text-gray-600 hover:underline" data-doc-id="${doc.id}">Detalhes</button>` : ''}
                        <button class="excluir-btn text-sm text-red-600 hover:underline" data-doc-id="${doc.id}">Excluir</button>
                    </div>
                </div>
            </div>
        `;
        documentList.appendChild(card);
    });
}

async function excluirDocumento(docId) { /* ...código sem alteração... */ }
function atualizarControlesPaginacao() { /* ...código sem alteração... */ }

// ATUALIZADO: Modal para mostrar os novos dados
function abrirModalDetalhes(doc) {
    const assinatura = doc.assinaturas[0];
    modalContent.innerHTML = `
        <h4 class="font-bold">Documento</h4>
        <p><strong>Nome Original:</strong> ${doc.caminho_arquivo_storage.split('-').slice(1).join('-')}</p>
        <p><strong>Enviado em:</strong> ${new Date(doc.created_at).toLocaleString('pt-BR')}</p>
        <p><strong>Nº da O.S.:</strong> ${doc.n_os || 'Não informado'}</p>
        <p><strong>Dados Adicionais:</strong> ${doc.dados_adicionais || 'Nenhum'}</p>
        <p><strong>Cliente (manual):</strong> ${doc.nome_cliente || 'Não informado'}</p>
        <p><strong>ID Cliente (manual):</strong> ${doc.id_cliente || 'Não informado'}</p>
        <hr class="my-4">
        <h4 class="font-bold">Dados da Assinatura</h4>
        <p><strong>Nome do Assinante:</strong> ${assinatura.nome_signatario || 'Não informado'}</p>
        <p><strong>Email:</strong> ${assinatura.email_signatario || 'Não informado'}</p>
        <p><strong>CPF/CNPJ:</strong> ${assinatura.cpf_cnpj_signatario || 'Não informado'}</p>
        <p><strong>Data da Assinatura:</strong> ${new Date(assinatura.assinado_em).toLocaleString('pt-BR')}</p>
        <div>
            <p><strong>Assinatura Gráfica:</strong></p>
            <img src="${assinatura.imagem_assinatura_base64}" class="border mt-2 w-full max-w-sm" alt="Assinatura">
        </div>
    `;
    detailsModal.classList.add('active');
}

function setLoading(isLoading) { /* ...código sem alteração... */ }
function showFeedback(message, type) { /* ...código sem alteração... */ }

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', carregarDocumentos);

osFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file && file.type === "application/pdf") {
        processarArquivoPDF(file);
    }
});

// ATUALIZADO: Lógica de submit para incluir os dados extraídos
uploadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const file = osFileInput.files[0];
    const nomeCliente = clienteNomeInput.value || null;
    const idCliente = clienteIdInput.value || null;
    const telefoneCliente = clienteTelefoneInput.value || null;
    const emailCliente = clienteEmailInput.value || null;
    
    // Pega os dados extraídos que salvamos no formulário
    const n_os = uploadForm.dataset.extractedOs || null;
    const dados_adicionais = uploadForm.dataset.extractedData || null;

    if (!file) { showFeedback('Por favor, selecione um arquivo PDF.', 'error'); return; }
    actionsContainer.classList.add('hidden');
    setLoading(true);
    try {
        const fileName = `${Date.now()}-${sanitizarNomeArquivo(file.name)}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from('documentos').upload(fileName, file);
        if(uploadError) throw uploadError;

        const { data: insertData, error: insertError } = await supabase.from('documentos').insert({ 
            caminho_arquivo_storage: uploadData.path, 
            nome_cliente: nomeCliente,
            id_cliente: idCliente,
            telefone_cliente: telefoneCliente,
            cliente_email: emailCliente,
            n_os: n_os, // Salva o N° da OS
            dados_adicionais: dados_adicionais // Salva os dados adicionais
        }).select('id').single();
        if(insertError) throw insertError;

        const documentoId = insertData.id;
        const linkDeAssinatura = `${SITE_BASE_URL}/assinar.html?id=${documentoId}`;
        linkInput.value = linkDeAssinatura;
        actionsContainer.classList.remove('hidden');
        whatsappContainer.style.display = telefoneCliente ? 'block' : 'none';
        showFeedback('Link gerado!', 'success');
        uploadForm.reset();
        carregarDocumentos();
    } catch (error) {
        console.error('Erro no processo:', error);
        showFeedback(`Erro: ${error.message}`, 'error');
    } finally {
        setLoading(false);
    }
});

// ... (todos os outros listeners continuam iguais)
copiarBtn.addEventListener('click', () => { /* ... */ });
whatsappBtn.addEventListener('click', () => { /* ... */ });
documentList.addEventListener('click', (e) => { /* ... */ });
statusFilterButtons.addEventListener('click', (e) => { /* ... */ });
searchInput.addEventListener('input', () => { /* ... */ });
prevPageBtn.addEventListener('click', () => { /* ... */ });
nextPageBtn.addEventListener('click', () => { /* ... */ });
closeModalBtn.addEventListener('click', () => { /* ... */ });
