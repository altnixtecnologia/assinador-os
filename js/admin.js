// js/admin.js
import { SITE_BASE_URL, ITENS_PER_PAGE } from './config.js';
import * as db from './supabaseService.js';
import { setupPdfWorker, extractDataFromPdf } from './pdfHandler.js';

setupPdfWorker();

document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos da UI ---
    const osFileInput = document.getElementById('os-file');
    const uploadInitialView = document.getElementById('initial-view');
    const showConsultationBtn = document.getElementById('show-consultation-btn');
    const showLinkImportBtn = document.getElementById('show-link-import-btn');
    const linkImportView = document.getElementById('link-import-view');
    const linkImportForm = document.getElementById('link-import-form');
    const docUrlInput = document.getElementById('doc-url-input');
    const cancelLinkImportBtn = document.getElementById('cancel-link-import-btn');
    const linkImportSubmitBtn = document.getElementById('link-import-submit-btn');
    const importFeedback = document.getElementById('import-feedback');
    const pasteLinkBtn = document.getElementById('paste-link-btn');
    const clearLinkBtn = document.getElementById('clear-link-btn');
    const preparationView = document.getElementById('preparation-view');
    const cancelPreparationBtn = document.getElementById('cancel-preparation-btn');
    const instructionText = document.getElementById('instruction-text');
    const pdfPreviewWrapper = document.getElementById('pdf-preview-wrapper');
    const uploadForm = document.getElementById('upload-form');
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
    const consultationView = document.getElementById('consultation-view');
    const backToInitialViewBtn = document.getElementById('back-to-initial-view-btn');
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
    const deleteConfirmModal = document.getElementById('delete-confirm-modal');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const deleteCheckbox = document.getElementById('delete-checkbox');
    const navToNewBtn = document.getElementById('nav-to-new-btn');
    const navToConsultBtn = document.getElementById('nav-to-consult-btn');
    const refreshListBtn = document.getElementById('refresh-list-btn');
    
    // --- Estado do Aplicativo ---
    let pdfDoc = null;
    let currentFile = null;
    let currentDrawingFor = 'tecnico';
    let isDrawing = false;
    let startCoords = { x: 0, y: 0 };
    let rects = { tecnico: null, cliente: null };
    let pageDimensions = [];
    let allDocumentsData = [];
    let currentPage = 0;
    let totalDocuments = 0;
    let currentStatusFilter = 'todos';
    let currentSearchTerm = '';
    let debounceTimer;
    let docIdParaExcluir = null;
    let extractedDataFromPdf = {};
    let currentErpLink = null; 

    // --- Funções de UI e Lógica Principal ---
    function showInitialView() {
        linkImportView.classList.add('hidden');
        preparationView.style.display = 'none';
        consultationView.style.display = 'none';
        uploadInitialView.style.display = 'block';
    }

    async function startPreparationProcess(source, fileName = '', erpLink = null) {
        currentErpLink = erpLink;
        uploadInitialView.style.display = 'none';
        linkImportView.classList.add('hidden');
        consultationView.style.display = 'none';
        preparationView.style.display = 'block';
        showFeedback('Extraindo dados do PDF...', 'info');

        try {
            if (source instanceof File) {
                currentFile = source;
            } else { // É uma URL (path do storage)
                const publicUrl = db.getPublicUrl(source);
                const response = await fetch(publicUrl);
                if (!response.ok) throw new Error(`Falha ao buscar PDF da URL.`);
                const blob = await response.blob();
                currentFile = new File([blob], fileName || 'documento.pdf', { type: 'application/pdf' });
                currentFile.internalPath = source; 
            }
            
            extractedDataFromPdf = await extractDataFromPdf(currentFile);
            clienteNomeInput.value = extractedDataFromPdf.nome;
            clienteTelefoneInput.value = extractedDataFromPdf.telefone;
            clienteEmailInput.value = extractedDataFromPdf.email;
            showFeedback('Dados extraídos! Prossiga com a marcação das assinaturas.', 'success');

            const fileReader = new FileReader();
            fileReader.onload = async function() {
                const pdfBytes = new Uint8Array(this.result);
                pdfDoc = await pdfjsLib.getDocument(pdfBytes).promise;
                await renderPdfPreview();
            };
            fileReader.readAsArrayBuffer(currentFile);
            
            instructionText.textContent = "1/2: Desenhe a área para a assinatura do TÉCNICO.";
            currentDrawingFor = 'tecnico';

        } catch (error) {
            showFeedback(`Erro ao processar documento: ${error.message}`, 'error');
            setTimeout(showInitialView, 3000);
        }
    }

    function showFeedback(message, type = 'info', element = feedbackMessage) {
        const colorClasses = { success: 'text-green-600', error: 'text-red-600', info: 'text-blue-600' };
        element.textContent = message;
        element.className = `mt-4 text-center text-sm ${colorClasses[type] || 'text-gray-600'}`;
    }

    function setLoading(isLoading) {
        if (isLoading) {
            submitButton.disabled = true;
            submitButton.innerHTML = `<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Gerando...`;
        } else {
            submitButton.disabled = false;
            submitButton.textContent = 'Gerar Link de Assinatura';
        }
    }
    
    function resetPreparationView() {
        showInitialView();
        osFileInput.value = '';
        docUrlInput.value = '';
        pdfDoc = null;
        currentFile = null;
        rects = { tecnico: null, cliente: null };
        pdfPreviewWrapper.innerHTML = '';
        showFeedback('', 'info');
        actionsContainer.classList.add('hidden');
    }
    
    async function renderPdfPreview() {
        if (!pdfDoc) return;
        pdfPreviewWrapper.innerHTML = '';
        pageDimensions = [];
        const containerWidth = pdfPreviewWrapper.clientWidth;
        let totalHeight = 0;
        const pages = [];
        for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            pages.push(page);
            const viewport = page.getViewport({ scale: 1.0 });
            const scaledHeight = (containerWidth / viewport.width) * viewport.height;
            pageDimensions.push({ num: i, width: viewport.width, height: viewport.height, scaledHeight });
            totalHeight += scaledHeight;
        }
        const bgCanvas = document.createElement('canvas');
        bgCanvas.id = 'pdf-background-canvas';
        const drawCanvas = document.createElement('canvas');
        drawCanvas.id = 'pdf-drawing-canvas';
        pdfPreviewWrapper.appendChild(bgCanvas);
        pdfPreviewWrapper.appendChild(drawCanvas);
        bgCanvas.width = drawCanvas.width = containerWidth;
        bgCanvas.height = drawCanvas.height = totalHeight;
        drawCanvas.style.position = 'absolute';
        drawCanvas.style.top = '0';
        drawCanvas.style.left = '0';
        const bgCtx = bgCanvas.getContext('2d');
        let currentY = 0;
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const scaledViewport = page.getViewport({ scale: containerWidth / page.getViewport({ scale: 1.0 }).width });
            const renderContext = { canvasContext: bgCtx, transform: [1, 0, 0, 1, 0, currentY], viewport: scaledViewport };
            await page.render(renderContext).promise;
            currentY += scaledViewport.height;
        }
        drawCanvas.addEventListener('mousedown', startDrawing);
        drawCanvas.addEventListener('mousemove', draw);
        drawCanvas.addEventListener('mouseup', stopDrawing);
        redrawAll();
    }

    function startDrawing(event) {
        isDrawing = true;
        startCoords = getMousePos(event.target, event);
    }

    function draw(event) {
        if (!isDrawing) return;
        redrawAll();
        const currentCoords = getMousePos(event.target, event);
        const width = currentCoords.x - startCoords.x;
        const height = currentCoords.y - startCoords.y;
        const tempRect = { x: startCoords.x, y: startCoords.y, width, height };
        const color = currentDrawingFor === 'tecnico' ? 'rgba(255, 0, 0, 0.4)' : 'rgba(0, 0, 255, 0.4)';
        drawRectOnCanvas(tempRect, color);
    }

    function stopDrawing(event) {
        if (!isDrawing) return;
        isDrawing = false;
        const endCoords = getMousePos(event.target, event);
        const rect = {
            x: Math.min(startCoords.x, endCoords.x),
            y: Math.min(startCoords.y, endCoords.y),
            width: Math.abs(startCoords.x - endCoords.x),
            height: Math.abs(startCoords.y - endCoords.y)
        };
        if (rect.width < 10 || rect.height < 10) { redrawAll(); return; }
        if (currentDrawingFor === 'tecnico') {
            rects.tecnico = rect;
            currentDrawingFor = 'cliente';
            instructionText.textContent = "2/2: Agora, desenhe a área para a assinatura do CLIENTE.";
        } else if (currentDrawingFor === 'cliente') {
            rects.cliente = rect;
            instructionText.textContent = "Áreas definidas! Verifique os dados e gere o link.";
        }
        redrawAll();
    }

    function redrawAll() {
        const drawCanvas = document.getElementById('pdf-drawing-canvas');
        if (!drawCanvas) return;
        const drawCtx = drawCanvas.getContext('2d');
        drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
        drawRectOnCanvas(rects.tecnico, 'rgba(255, 0, 0, 0.4)', 'Técnico');
        drawRectOnCanvas(rects.cliente, 'rgba(0, 0, 255, 0.4)', 'Cliente');
    }

    function getMousePos(canvas, evt) {
        const rect = canvas.getBoundingClientRect();
        return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
    }

    function drawRectOnCanvas(rect, color, label = '') {
        const drawCanvas = document.getElementById('pdf-drawing-canvas');
        if (!drawCanvas || !rect) return;
        const drawCtx = drawCanvas.getContext('2d');
        drawCtx.fillStyle = color;
        drawCtx.fillRect(rect.x, rect.y, rect.width, rect.height);
        if (label) {
            drawCtx.fillStyle = '#fff';
            drawCtx.font = 'bold 12px sans-serif';
            drawCtx.fillText(label, rect.x + 5, rect.y + 15);
        }
    }
    
    async function carregarDocumentos() {
        listLoadingFeedback.style.display = 'block';
        listLoadingFeedback.textContent = "Carregando documentos...";
        documentList.innerHTML = '';
        try {
            const { data, error, count } = await db.getDocuments(currentPage, ITENS_PER_PAGE, currentStatusFilter, currentSearchTerm);
            if (error) throw error;
            allDocumentsData = data;
            totalDocuments = count;
            renderizarLista(data);
            atualizarControlesPaginacao();
        } catch (error) {
            documentList.innerHTML = `<p class="text-center text-red-500 py-8">Erro ao carregar documentos: ${error.message}</p>`;
        } finally {
            listLoadingFeedback.style.display = 'none';
        }
    }

    function renderizarLista(docs) {
        documentList.innerHTML = '';
        if (!docs || docs.length === 0) {
            documentList.innerHTML = '<p class="text-center text-gray-500 py-8">Nenhum documento encontrado.</p>';
            return;
        }
        docs.forEach(doc => {
            const card = document.createElement('div');
            card.className = 'border rounded-lg p-4 bg-gray-50 shadow-sm';
            const dataEnvio = new Date(doc.created_at).toLocaleDateString('pt-BR');
            const nomeArquivoOriginal = doc.caminho_arquivo_storage.split('-').slice(1).join('-') || doc.caminho_arquivo_storage;
            
            let statusHtml = '';
            let actionsHtml = '';

            if (doc.status === 'assinado') {
                statusHtml = `<span class="text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-800">Assinado ✅</span>`;
                const assinatura = doc.assinaturas && doc.assinaturas.length > 0 ? doc.assinaturas[0] : null;
                actionsHtml = `
                    <button class="download-btn text-sm text-blue-600 hover:underline" data-path="${doc.caminho_arquivo_storage}">Original</button>
                    ${doc.caminho_arquivo_assinado ? `<button class="download-btn text-sm text-green-600 hover:underline" data-path="${doc.caminho_arquivo_assinado}">Assinado</button>` : ''}
                    ${assinatura ? `<button class="ver-detalhes-btn text-sm text-gray-600 hover:underline" data-doc-id="${doc.id}">Detalhes</button>` : ''}
                `;
            } else { // Pendente
                statusHtml = `<span class="text-xs font-medium px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-800">Pendente ⏳</span>`;
                actionsHtml = `<button class="download-btn text-sm text-blue-600 hover:underline" data-path="${doc.caminho_arquivo_storage}">Original</button>`;
                actionsHtml += ` <button class="copy-link-btn text-sm text-purple-600 hover:underline" data-doc-id="${doc.id}">Copiar Link</button>`;
            }

            card.innerHTML = `
                <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div class="flex-grow min-w-0">
                        <p class="font-bold text-gray-800 break-all">${nomeArquivoOriginal}</p>
                        <p class="text-sm text-gray-500 truncate">${doc.nome_cliente ? `Cliente: ${doc.nome_cliente}` : ''}</p>
                        ${doc.n_os ? `<p class="text-sm text-gray-500 font-semibold">OS N°: ${doc.n_os}</p>` : ''}
                    </div>
                    <div class="flex-shrink-0 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div class="flex flex-col items-start sm:items-end text-right">
                            ${statusHtml}
                            ${doc.status_os ? `<span class="text-xs font-semibold mt-1 text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full" title="Status do Serviço">${doc.status_os}</span>` : ''}
                        </div>
                        <span class="text-sm text-gray-600">Enviado em: ${dataEnvio}</span>
                        <div class="flex gap-2 flex-wrap">
                            ${actionsHtml}
                            <button class="excluir-btn text-sm text-red-600 hover:underline" data-doc-id="${doc.id}">Excluir</button>
                        </div>
                    </div>
                </div>`;
            documentList.appendChild(card);
        });
    }
    
    function abrirExclusaoModal(docId) {
        docIdParaExcluir = docId;
        deleteCheckbox.checked = false;
        confirmDeleteBtn.disabled = true;
        confirmDeleteBtn.classList.add('btn-disabled');
        deleteConfirmModal.classList.add('active');
    }

    async function executarExclusao() {
        if (!docIdParaExcluir) return;
        confirmDeleteBtn.disabled = true;
        confirmDeleteBtn.textContent = 'Excluindo...';
        try {
            await db.deleteDocument(docIdParaExcluir);
            showFeedback('Documento excluído com sucesso!', 'success');
            fecharModalExclusao();
            await carregarDocumentos();
        } catch (error) {
            showFeedback(`Erro ao excluir o documento: ${error.message}`, 'error');
        } finally {
            confirmDeleteBtn.disabled = false;
            confirmDeleteBtn.textContent = 'Confirmar Exclusão';
        }
    }

    function fecharModalExclusao() {
        docIdParaExcluir = null;
        deleteConfirmModal.classList.remove('active');
    }

    function abrirModalDetalhes(doc) {
        const assinatura = doc.assinaturas && doc.assinaturas.length > 0 ? doc.assinaturas[0] : null;
        const erpLinkHtml = doc.erp_link 
            ? `<p><strong>Link do ERP:</strong> <a href="${doc.erp_link}" target="_blank" class="text-blue-600 hover:underline">Abrir no ERP</a></p>` 
            : '';
        modalContent.innerHTML = `
            <h4 class="font-bold">Documento</h4>
            <p><strong>Nome Original:</strong> ${doc.caminho_arquivo_storage.split('-').slice(1).join('-')}</p>
            ${erpLinkHtml}
            <p><strong>Enviado em:</strong> ${new Date(doc.created_at).toLocaleString('pt-BR')}</p>
            <p><strong>Nº da O.S.:</strong> ${doc.n_os || 'Não informado'}</p>
            <p><strong>Status do Serviço:</strong> ${doc.status_os || 'Não informado'}</p>
            <p><strong>Cliente:</strong> ${doc.nome_cliente || 'Não informado'}</p>
            ${assinatura ? `
            <hr class="my-4">
            <h4 class="font-bold">Dados da Assinatura</h4>
            <p><strong>Nome do Assinante:</strong> ${assinatura.nome_signatario || 'Não informado'}</p>
            <p><strong>Email:</strong> ${assinatura.email_signatario || 'Não informado'}</p>
            <p><strong>CPF/CNPJ:</strong> ${assinatura.cpf_cnpj_signatario || 'Não informado'}</p>
            <p><strong>Data da Assinatura:</strong> ${assinatura.data_hora_local || new Date(assinatura.assinado_em).toLocaleString('pt-BR')}</p>
            <p><strong>ID Google:</strong> ${assinatura.google_user_id || 'Não informado'}</p>
            <p><strong>Endereço IP:</strong> ${assinatura.ip_signatario || 'Não informado'}</p>
            <div>
                <p><strong>Assinatura Gráfica:</strong></p>
                <img src="${assinatura.imagem_assinatura_base64}" class="border mt-2 w-full max-w-sm" alt="Assinatura">
            </div>` : ''}
        `;
        detailsModal.classList.add('active');
    }

    function atualizarControlesPaginacao() {
        const totalPages = Math.ceil(totalDocuments / ITENS_PER_PAGE);
        pageInfo.textContent = totalDocuments > 0 ? `Página ${currentPage + 1} de ${totalPages || 1}` : 'Nenhum resultado';
        prevPageBtn.disabled = currentPage === 0;
        prevPageBtn.classList.toggle('btn-disabled', currentPage === 0);
        nextPageBtn.disabled = (currentPage + 1) >= totalPages;
        nextPageBtn.classList.toggle('btn-disabled', (currentPage + 1) >= totalPages);
    }
    
    function sanitizarNomeArquivo(nome) {
        const comAcentos = 'àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþßŕ';
        const semAcentos = 'aaaaaaaceeeeiiiionoooooouuuuybsr';
        let novoNome = nome.toLowerCase();
        for (let i = 0; i < comAcentos.length; i++) {
            novoNome = novoNome.replace(new RegExp(comAcentos.charAt(i), 'g'), semAcentos.charAt(i));
        }
        return novoNome
            .replace(/[^a-z0-9.\-_]/g, '-')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
    }

    // --- Event Listeners ---
    osFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) startPreparationProcess(file, file.name);
    });

    showLinkImportBtn.addEventListener('click', () => {
        uploadInitialView.style.display = 'none';
        linkImportView.classList.remove('hidden');
        docUrlInput.value = '';
        showFeedback('', 'info', importFeedback);
    });

    cancelLinkImportBtn.addEventListener('click', showInitialView);

    linkImportForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const url = docUrlInput.value;
        if (!url) return;
        linkImportSubmitBtn.disabled = true;
        linkImportSubmitBtn.textContent = 'Importando...';
        showFeedback('Buscando e salvando o PDF...', 'info', importFeedback);
        try {
            const { path, name, originalUrl } = await db.importFromUrl(url);
            await startPreparationProcess(path, name, originalUrl);
        } catch (error) {
            showFeedback(`Erro: ${error.message}`, 'error', importFeedback);
        } finally {
            linkImportSubmitBtn.disabled = false;
            linkImportSubmitBtn.textContent = 'Importar Documento';
        }
    });

    pasteLinkBtn.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            docUrlInput.value = text;
        } catch (err) {
            alert('Não foi possível ler a área de transferência. Verifique as permissões do navegador.');
        }
    });

    clearLinkBtn.addEventListener('click', () => {
        docUrlInput.value = '';
    });

    cancelPreparationBtn.addEventListener('click', resetPreparationView);
    showConsultationBtn.addEventListener('click', () => {
        uploadInitialView.style.display = 'none';
        linkImportView.classList.add('hidden');
        preparationView.style.display = 'none';
        consultationView.style.display = 'block';
        carregarDocumentos();
    });
    backToInitialViewBtn.addEventListener('click', showInitialView);
    refreshListBtn.addEventListener('click', carregarDocumentos);

    uploadForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!rects.tecnico || !rects.cliente) {
            showFeedback("Defina as áreas de assinatura para o técnico e cliente.", "error");
            return;
        }
        const convertCoords = (rect) => {
             if (!rect) return null;
             let yOffset = 0;
             let pageNum = 0;
             for(let i=0; i<pageDimensions.length; i++){
                 if(rect.y < yOffset + pageDimensions[i].scaledHeight){
                     pageNum = i + 1;
                     break;
                 }
                 yOffset += pageDimensions[i].scaledHeight;
             }
             if(pageNum === 0) pageNum = pageDimensions.length;
             const pageDim = pageDimensions[pageNum-1];
             const canvasWidth = document.getElementById('pdf-background-canvas').width;
             const scale = pageDim.width / canvasWidth;
             return { page: pageNum, x: rect.x * scale, y: pageDim.height - ((rect.y - yOffset) * scale) - (rect.height * scale), width: rect.width * scale, height: rect.height * scale };
        };

        setLoading(true);
        try {
            let storagePath;
            if (currentFile.internalPath) {
                storagePath = currentFile.internalPath;
            } else {
                storagePath = `${Date.now()}-${sanitizarNomeArquivo(currentFile.name)}`;
                await db.uploadFile(storagePath, currentFile);
            }
            
            const documentRecord = {
                caminho_arquivo_storage: storagePath,
                nome_cliente: clienteNomeInput.value || null,
                telefone_cliente: clienteTelefoneInput.value || null,
                cliente_email: clienteEmailInput.value || null,
                n_os: extractedDataFromPdf.n_os || null,
                status_os: extractedDataFromPdf.status_os || null,
                tecnico_assinatura_coords: convertCoords(rects.tecnico),
                cliente_assinatura_coords: convertCoords(rects.cliente),
                erp_link: currentErpLink,
            };

            const insertData = await db.createDocumentRecord(documentRecord);
            const linkDeAssinatura = `${SITE_BASE_URL}/assinar.html?id=${insertData.id}`;
            linkInput.value = linkDeAssinatura;

            await db.updateDocumentLink(insertData.id, linkDeAssinatura);
            
            actionsContainer.classList.remove('hidden');
            whatsappContainer.style.display = clienteTelefoneInput.value ? 'block' : 'none';
            showFeedback('Link gerado e salvo com sucesso!', 'success');

        } catch (error) {
            console.error('Erro no processo de envio:', error);
            showFeedback(`Erro: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    });

    copiarBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(linkInput.value);
        copiarBtn.textContent = 'Copiado!';
        setTimeout(() => { copiarBtn.textContent = 'Copiar'; }, 2000);
    });

    whatsappBtn.addEventListener('click', () => {
        const telefone = clienteTelefoneInput.value.replace(/\D/g, '');
        const telefoneCompleto = telefone.length > 11 ? telefone : `55${telefone}`;
        const mensagem = encodeURIComponent(`Olá! Por favor, assine a Ordem de Serviço acessando o link: ${linkInput.value}`);
        window.open(`https://wa.me/${telefoneCompleto}?text=${mensagem}`, '_blank');
    });

    documentList.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.classList.contains('download-btn')) {
            const path = target.dataset.path;
            const publicUrl = db.getPublicUrl(path);
            window.open(publicUrl, '_blank');
        }
        if (target.classList.contains('ver-detalhes-btn')) {
            const docId = target.dataset.docId;
            const doc = allDocumentsData.find(d => d.id.toString() === docId);
            if (doc) abrirModalDetalhes(doc);
        }
        if (target.classList.contains('excluir-btn')) {
            abrirExclusaoModal(target.dataset.docId);
        }
        if (target.classList.contains('copy-link-btn')) {
            const docId = target.dataset.docId;
            const link = `${SITE_BASE_URL}/assinar.html?id=${docId}`;
            navigator.clipboard.writeText(link);
            target.textContent = 'Copiado!';
            setTimeout(() => { target.textContent = 'Copiar Link'; }, 2000);
        }
    });
    
    statusFilterButtons.addEventListener('click', (e) => {
        const target = e.target;
        if (target.tagName === 'BUTTON') {
            currentPage = 0;
            currentStatusFilter = target.dataset.status;
            statusFilterButtons.querySelectorAll('button').forEach(btn => btn.classList.remove('bg-blue-600', 'text-white'));
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
    
    closeModalBtn.addEventListener('click', () => detailsModal.classList.remove('active'));
    deleteCheckbox.addEventListener('change', () => {
        confirmDeleteBtn.disabled = !deleteCheckbox.checked;
        confirmDeleteBtn.classList.toggle('btn-disabled', !deleteCheckbox.checked);
    });
    cancelDeleteBtn.addEventListener('click', fecharModalExclusao);
    confirmDeleteBtn.addEventListener('click', executarExclusao);

    navToNewBtn.addEventListener('click', resetPreparationView);
    navToConsultBtn.addEventListener('click', () => {
        uploadInitialView.style.display = 'none';
        preparationView.style.display = 'none';
        consultationView.style.display = 'block';
        carregarDocumentos();
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            detailsModal.classList.remove('active');
            deleteConfirmModal.classList.remove('active');
        }
    });
});
