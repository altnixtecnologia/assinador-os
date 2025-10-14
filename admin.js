// Configuração do Supabase
const SUPABASE_URL = 'https://nlefwzyyhspyqcicfouc.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sZWZ3enl5aHNweXFjaWNmb3VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMzAyMzMsImV4cCI6MjA3NTgwNjIzM30.CpKg1MKbcTtEUfmGDzcXPvZoTQH3dygUL61yYYiLPyQ';
const SITE_BASE_URL = 'https://altnixtecnologia.github.io/assinador-os';
const supabase = self.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Elementos da UI ---
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
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js`;

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

            // --- LÓGICA DE EXTRAÇÃO ATUALIZADA (CPF/CNPJ) ---
            const osRegex = /Ordem de serviço N°\s*(\d+)/i;
            const foneRegex = /(?:Celular|Telefone|Fone):\s*([+\d\s()-]+)/i;
            const cnpjRegex = /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/;
            const cpfRegex = /(\d{3}\.\d{3}\.\d{3}-\d{2})/;

            const osMatch = fullText.match(osRegex);
            const foneMatch = fullText.match(foneRegex);
            
            let idMatch = fullText.match(cnpjRegex); // Tenta achar CNPJ primeiro
            if (!idMatch) {
                idMatch = fullText.match(cpfRegex); // Se não achar, tenta achar CPF
            }

            // Extração de nome mais inteligente
            let nomeCliente = null;
            const clienteIndex = fullText.toLowerCase().indexOf('cliente');
            if (clienteIndex > -1 && idMatch) {
                const textoIntermediario = fullText.substring(clienteIndex + 7, idMatch.index);
                nomeCliente = textoIntermediario.replace(/\n/g, ' ').trim();
            }

            let statusOS = null;
            const palavrasChave = ["Concluído", "Entregue", "Garantia", "Não autorizou"];
            for (const palavra of palavrasChave) {
                if (fullText.toLowerCase().includes(palavra.toLowerCase())) {
                    statusOS = palavra;
                    break;
                }
            }
            
            if (nomeCliente) clienteNomeInput.value = nomeCliente;
            if (foneMatch) clienteTelefoneInput.value = foneMatch[1].trim().replace(/\D/g, '');
            
            uploadForm.dataset.extractedOs = osMatch ? osMatch[1].trim() : '';
            uploadForm.dataset.extractedStatusOs = statusOS || '';

            showFeedback('Dados extraídos! Verifique e prossiga.', 'success');
        } catch (error) {
            console.error("Erro ao processar o PDF no cliente:", error);
            showFeedback('Não foi possível ler os dados. Preencha manualmente.', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
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
    let query = supabase
        .from('documentos')
        .select(`
            id, created_at, status, cliente_email, nome_cliente, n_os, status_os,
            caminho_arquivo_storage, caminho_arquivo_assinado,
            assinaturas ( nome_signatario, cpf_cnpj_signatario, email_signatario, assinado_em, imagem_assinatura_base64 )
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);
    if (currentStatusFilter !== 'todos') {
        query = query.eq('status', currentStatusFilter);
    }
    if (currentSearchTerm) {
        query = query.or(`caminho_arquivo_storage.ilike.%${currentSearchTerm}%,cliente_email.ilike.%${currentSearchTerm}%,nome_cliente.ilike.%${currentSearchTerm}%,n_os.ilike.%${currentSearchTerm}%,status_os.ilike.%${currentSearchTerm}%,assinaturas.nome_signatario.ilike.%${currentSearchTerm}%`);
    }
    const { data, error, count } = await query;
    listLoadingFeedback.style.display = 'none';
    if (error) {
        documentList.innerHTML = `<p class="text-center text-red-500 py-8">Erro ao carregar docs: ${error.message}</p>`;
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
        const statusAssinaturaClass = doc.status === 'assinado' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
        const statusAssinaturaText = doc.status === 'assinado' ? 'Assinado ✅' : 'Pendente ⏳';
        const dataEnvio = new Date(doc.created_at).toLocaleDateString('pt-BR');
        const nomeArquivoOriginal = doc.caminho_arquivo_storage.split('-').slice(1).join('-') || doc.caminho_arquivo_storage;

        card.innerHTML = `
            <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div class="flex-grow min-w-0">
                    <p class="font-bold text-gray-800 break-all">${nomeArquivoOriginal}</p>
                    <p class="text-sm text-gray-500 truncate">
                        ${doc.nome_cliente ? `Cliente: ${doc.nome_cliente}` : (assinatura ? `Assinado por: ${assinatura.nome_signatario}` : '')}
                    </p>
                    ${doc.n_os ? `<p class="text-sm text-gray-500 font-semibold">OS N°: ${doc.n_os}</p>` : ''}
                </div>
                <div class="flex-shrink-0 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div class="flex flex-col items-start sm:items-end text-right">
                        <span class="text-xs font-medium px-2.5 py-1 rounded-full ${statusAssinaturaClass}" title="Status da Assinatura">${statusAssinaturaText}</span>
                        ${doc.status_os ? `<span class="text-xs font-semibold mt-1 text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full" title="Status do Serviço">${doc.status_os}</span>` : ''}
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

async function excluirDocumento(docId) {
    if (!confirm('Você tem certeza que deseja excluir este documento e sua assinatura? Esta ação não pode ser desfeita.')) return;
    try {
        await supabase.from('assinaturas').delete().eq('documento_id', docId);
        await supabase.from('documentos').delete().eq('id', docId);
        alert('Documento excluído com sucesso!');
        carregarDocumentos();
    } catch (error) {
        alert(`Erro ao excluir o documento: ${error.message}`);
    }
}

function atualizarControlesPaginacao() {
    const totalPages = Math.ceil(totalDocuments / ITENS_PER_PAGE);
    pageInfo.textContent = totalDocuments > 0 ? `Página ${currentPage + 1} de ${totalPages || 1}` : 'Nenhum resultado';
    prevPageBtn.disabled = currentPage === 0;
    prevPageBtn.classList.toggle('btn-disabled', currentPage === 0);
    nextPageBtn.disabled = (currentPage + 1) >= totalPages;
    nextPageBtn.classList.toggle('btn-disabled', (currentPage + 1) >= totalPages);
}

function abrirModalDetalhes(doc) {
    const assinatura = doc.assinaturas[0];
    modalContent.innerHTML = `
        <h4 class="font-bold">Documento</h4>
        <p><strong>Nome Original:</strong> ${doc.caminho_arquivo_storage.split('-').slice(1).join('-')}</p>
        <p><strong>Enviado em:</strong> ${new Date(doc.created_at).toLocaleString('pt-BR')}</p>
        <p><strong>Nº da O.S.:</strong> ${doc.n_os || 'Não informado'}</p>
        <p><strong>Status do Serviço:</strong> ${doc.status_os || 'Não informado'}</p>
        <p><strong>Cliente (manual):</strong> ${doc.nome_cliente || 'Não informado'}</p>
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
    const colorClasses = {
        success: 'text-green-600',
        error: 'text-red-600',
        info: 'text-blue-600'
    };
    feedbackMessage.textContent = message;
    feedbackMessage.className = `mt-4 text-center text-sm ${colorClasses[type] || 'text-gray-600'}`;
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', carregarDocumentos);

osFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file && file.type === "application/pdf") {
        processarArquivoPDF(file);
    }
});

uploadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const file = osFileInput.files[0];
    const nomeCliente = clienteNomeInput.value || null;
    const telefoneCliente = clienteTelefoneInput.value || null;
    const emailCliente = clienteEmailInput.value || null;
    const n_os = uploadForm.dataset.extractedOs || null;
    const status_os = uploadForm.dataset.extractedStatusOs || null;

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
            telefone_cliente: telefoneCliente,
            cliente_email: emailCliente,
            n_os: n_os,
            status_os: status_os
        }).select('id').single();
        if(insertError) throw insertError;

        const documentoId = insertData.id;
        const linkDeAssinatura = `${SITE_BASE_URL}/assinar.html?id=${documentoId}`;
        linkInput.value = linkDeAssinatura;
        actionsContainer.classList.remove('hidden');
        whatsappContainer.style.display = telefoneCliente ? 'block' : 'none';
        showFeedback('Link gerado!', 'success');
        
        uploadForm.reset();
        uploadForm.dataset.extractedOs = '';
        uploadForm.dataset.extractedStatusOs = '';

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

whatsappBtn.addEventListener('click', () => {
    const telefone = clienteTelefoneInput.value.replace(/\D/g, '');
    const linkAssinatura = linkInput.value;
    const mensagem = encodeURIComponent(`Olá! Por favor, assine a Ordem de Serviço acessando o link: ${linkAssinatura}`);
    window.open(`https://wa.me/${telefone}?text=${mensagem}`, '_blank');
});

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
        excluirDocumento(docId);
    }
});

statusFilterButtons.addEventListener('click', (e) => {
    const target = e.target;
    if (target.tagName === 'BUTTON') {
        currentPage = 0;
        currentStatusFilter = target.dataset.status;
        statusFilterButtons.querySelectorAll('button').forEach(btn => {
            btn.classList.remove('bg-blue-600', 'text-white');
        });
        target.classList.add('bg-blue-600', 'text-white');
        carregarDocumentos();
    }
});

searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        currentPage = 0;
        currentSearchTerm = searchInput.value;
        carregarDocumentos();
    }, 500);
});

prevPageBtn.addEventListener('click', () => {
    if (currentPage > 0) {
        currentPage--;
        carregarDocumentos();
    }
});

nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(totalDocuments / ITENS_PER_PAGE);
    if (currentPage + 1 < totalPages) {
        currentPage++;
        carregarDocumentos();
    }
});

closeModalBtn.addEventListener('click', () => {
    detailsModal.classList.remove('active');
});
