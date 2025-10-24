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
    const fetchFromUrlBtn = document.getElementById('fetch-from-url-btn');
    const osUrlInput = document.getElementById('os-url');
    const skipTecnicoCheckbox = document.getElementById('skip-tecnico-checkbox');

    // --- Estado do Aplicativo ---
    let pdfDoc = null;
    let currentFile = null;
    let currentStoragePath = null;
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

    function showFeedback(message, type = 'info') {
        const colorClasses = { success: 'text-green-600', error: 'text-red-600', info: 'text-blue-600' };
        feedbackMessage.textContent = message;
        feedbackMessage.className = `mt-4 text-center text-sm ${colorClasses[type] || 'text-gray-600'}`;
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
        preparationView.style.display = 'none';
        consultationView.style.display = 'none';
        uploadInitialView.style.display = 'block';
        osFileInput.value = '';
        osUrlInput.value = '';
        pdfDoc = null;
        currentFile = null;
        currentStoragePath = null;
        rects = { tecnico: null, cliente: null };
        pdfPreviewWrapper.innerHTML = '';
        showFeedback('', 'info');
        actionsContainer.classList.add('hidden');
        if (skipTecnicoCheckbox) skipTecnicoCheckbox.checked = false;
    }

    async function preparePdfForSigning(pdfSource) {
        uploadInitialView.style.display = 'none';
        consultationView.style.display = 'none';
        preparationView.style.display = 'block';

        showFeedback('Carregando e extraindo dados do PDF...', 'info');

        try {
            pdfDoc = await pdfjsLib.getDocument(pdfSource).promise;

            let fileForExtraction;
            if (typeof pdfSource === 'string') {
                const response = await fetch(pdfSource);
                const blob = await response.blob();
                const tempFileName = currentStoragePath ? currentStoragePath.split('/').pop() : 'documento_url.pdf';
                fileForExtraction = new File([blob], tempFileName, { type: "application/pdf" });
            } else {
                fileForExtraction = pdfSource;
            }
            currentFile = fileForExtraction;

            extractedDataFromPdf = await extractDataFromPdf(currentFile);
            clienteNomeInput.value = extractedDataFromPdf.nome;
            clienteTelefoneInput.value = extractedDataFromPdf.telefone;
            clienteEmailInput.value = extractedDataFromPdf.email;
            showFeedback('Dados extraídos! Prossiga com a marcação das assinaturas.', 'success');

            await renderPdfPreview();
            updateInstructionText();

        } catch (error) {
            showFeedback('Não foi possível carregar ou ler os dados do PDF.', 'error');
            console.error(error);
            resetPreparationView();
        }
    }

    function updateInstructionText() {
        if (skipTecnicoCheckbox && skipTecnicoCheckbox.checked) {
            instructionText.textContent = "Área do Técnico pulada. Desenhe a área para a assinatura do CLIENTE.";
            currentDrawingFor = 'cliente';
        } else {
            instructionText.textContent = "1/2: Desenhe a área para a assinatura do TÉCNICO.";
            currentDrawingFor = 'tecnico';
        }
    }

    async function renderPdfPreview() {
        if (!pdfDoc) return;
        pdfPreviewWrapper.innerHTML = '';
        pageDimensions = [];
        const containerWidth = pdfPreviewWrapper.clientWidth;

        const drawCanvas = document.createElement('canvas');
        drawCanvas.id = 'pdf-drawing-canvas';
        drawCanvas.style.position = 'absolute';
        drawCanvas.style.top = '0';
        drawCanvas.style.left = '0';
        drawCanvas.style.zIndex = '10';
        pdfPreviewWrapper.appendChild(drawCanvas);

        let totalHeight = 0;
        for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: 1.0 });
            const scale = containerWidth / viewport.width;
            const scaledViewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            canvas.height = scaledViewport.height;
            canvas.width = scaledViewport.width;
            canvas.style.display = 'block';
            pdfPreviewWrapper.appendChild(canvas);

            pageDimensions.push({ num: i, width: viewport.width, height: viewport.height, scaledHeight: scaledViewport.height });
            totalHeight += scaledViewport.height;

            await page.render({ canvasContext: canvas.getContext('2d'), viewport: scaledViewport }).promise;
        }

        drawCanvas.width = containerWidth;
        drawCanvas.height = totalHeight;

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
                actionsHtml = `<button class="download-btn text-sm text-blue-600 hover:underline" data-path="${doc.caminho_arquivo_storage}">Original</button>
                               ${doc.caminho_arquivo_assinado ? `<button class="download-btn text-sm text-green-600 hover:underline" data-path="${doc.caminho_arquivo_assinado}">Assinado</button>` : ''}`;
            } else {
                statusHtml = `<span class="text-xs font-medium px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-800">Pendente ⏳</span>`;
                actionsHtml = `<button class="download-btn text-sm text-blue-600 hover:underline" data-path="${doc.caminho_arquivo_storage}">Original</button>
                               <button class="copy-link-btn text-sm text-purple-600 hover:underline" data-doc-id="${doc.id}">Copiar Link</button>`;
            }
            card.innerHTML = `<div class="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
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
                                    <div class="flex gap-2 flex-wrap">${actionsHtml}
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
            fecharModalExclusao();
            await carregarDocumentos();
        } catch (error) {
            alert(`Erro ao excluir o documento: ${error.message}`);
        } finally {
            confirmDeleteBtn.disabled = false;
            confirmDeleteBtn.textContent = 'Confirmar Exclusão';
        }
    }

    function fecharModalExclusao() {
        docIdParaExcluir = null;
        deleteConfirmModal.classList.remove('active');
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
    cancelPreparationBtn.addEventListener('click', resetPreparationView);
    showConsultationBtn.addEventListener('click', () => {
        uploadInitialView.style.display = 'none';
        preparationView.style.display = 'none';
        consultationView.style.display = 'block';
        carregarDocumentos();
    });
    backToInitialViewBtn.addEventListener('click', resetPreparationView);
    refreshListBtn.addEventListener('click', carregarDocumentos);

    fetchFromUrlBtn.addEventListener('click', async () => {
        const url = osUrlInput.value.trim();
        if (!url) {
            alert('Por favor, insira uma URL válida.');
            return;
        }

        fetchFromUrlBtn.disabled = true;
        fetchFromUrlBtn.textContent = 'Buscando...';

        try {
            const { data, error } = await db.supabase.functions.invoke('url-to-pdf', {
                body: { url: url },
            });

            if (error) throw error;
            if (!data || !data.storagePath) throw new Error("A resposta da função não continha um caminho de arquivo válido.");

            currentStoragePath = data.storagePath;
            const publicUrl = db.getPublicUrl(data.storagePath);
            await preparePdfForSigning(publicUrl);

        } catch (err) {
            alert(`Erro ao buscar o documento: ${err.message}`);
            console.error(err);
            resetPreparationView(); // Volta para a tela inicial em caso de erro
        } finally {
            fetchFromUrlBtn.disabled = false;
            fetchFromUrlBtn.textContent = 'Buscar';
        }
    });

    osFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            currentStoragePath = null;
            preparePdfForSigning(file);
        }
    });

    uploadForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        // Verifica se temos um caminho do storage OU um arquivo local pronto para upload
        if (!currentStoragePath && !currentFile) {
            showFeedback("Nenhum documento PDF foi carregado ou gerado.", "error");
            return;
        }

        if ((!skipTecnicoCheckbox.checked && !rects.tecnico) || !rects.cliente) {
            showFeedback("Defina todas as áreas de assinatura necessárias.", "error");
            return;
        }

        const convertCoords = (rect) => {
            if (!rect) return null;
            let yOffset = 0;
            let pageNum = 0;
            for(let i=0; i<pageDimensions.length; i++){
                // Verifica se o ponto Y do retângulo está dentro da altura acumulada das páginas
                if(rect.y < yOffset + pageDimensions[i].scaledHeight){
                    pageNum = i + 1;
                    break;
                }
                yOffset += pageDimensions[i].scaledHeight;
            }
            if(pageNum === 0 && pageDimensions.length > 0) pageNum = pageDimensions.length;
            if(pageNum === 0) pageNum = 1;

            const pageDim = pageDimensions[pageNum-1];
            const canvasWidth = pdfPreviewWrapper.clientWidth;
            const scale = pageDim.width / canvasWidth;

            // *** A ALTERAÇÃO ESTÁ AQUI ***
            return {
                page: pageNum,
                x: rect.x * scale,
                y: pageDim.height - ((rect.y - yOffset) * scale) - (rect.height * scale) - 30, // Ajuste: Adiciona 30 pixels de espaçamento para baixo
                width: rect.width * scale,
                height: rect.height * scale
            };
        };

        setLoading(true);
        try {
            let finalStoragePath;
            // Se currentStoragePath existe, significa que o arquivo já está no Storage (veio da URL)
            if (currentStoragePath) {
                finalStoragePath = currentStoragePath;
            } 
            // Senão, se currentFile existe, significa que foi um upload manual, então fazemos o upload
            else if (currentFile) {
                const fileName = `${Date.now()}-${sanitizarNomeArquivo(currentFile.name)}`;
                const uploadData = await db.uploadFile(fileName, currentFile);
                finalStoragePath = uploadData.path;
            } else {
                throw new Error("Nenhum arquivo para processar.");
            }
            
            const documentRecord = {
                caminho_arquivo_storage: finalStoragePath,
                nome_cliente: clienteNomeInput.value || null,
                telefone_cliente: clienteTelefoneInput.value || null,
                cliente_email: clienteEmailInput.value || null,
                n_os: extractedDataFromPdf.n_os || null,
                status_os: extractedDataFromPdf.status_os || null,
                tecnico_assinatura_coords: skipTecnicoCheckbox.checked ? null : convertCoords(rects.tecnico),
                cliente_assinatura_coords: convertCoords(rects.cliente)
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
            showFeedback(`Erro ao salvar os dados: ${error.message}`, 'error');
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
            window.open(db.getPublicUrl(target.dataset.path), '_blank');
        }
        if (target.classList.contains('copy-link-btn')) {
            const docId = target.dataset.docId;
            const link = `${SITE_BASE_URL}/assinar.html?id=${docId}`;
            navigator.clipboard.writeText(link);
            target.textContent = 'Copiado!';
            setTimeout(() => { target.textContent = 'Copiar Link'; }, 2000);
        }
        if (target.classList.contains('excluir-btn')) {
            abrirExclusaoModal(target.dataset.docId);
        }
    });
    
    statusFilterButtons.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (target) {
            currentPage = 0;
            currentStatusFilter = target.dataset.status;
            statusFilterButtons.querySelectorAll('button').forEach(btn => {
                btn.classList.remove('bg-blue-600', 'text-white');
                btn.classList.add('bg-white', 'text-gray-700', 'hover:bg-gray-50');
            });
            target.classList.remove('bg-white', 'text-gray-700', 'hover:bg-gray-50');
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

    if (skipTecnicoCheckbox) {
        skipTecnicoCheckbox.addEventListener('change', () => {
            rects = { tecnico: null, cliente: null };
            redrawAll();
            updateInstructionText();
        });
    }
});
