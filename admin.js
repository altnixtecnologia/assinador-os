// Configuração do Supabase
const SUPABASE_URL = 'https://nlefwzyyhspyqcicfouc.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sZWZ3enl5aHNweXFjaWNmb3VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMzAyMzMsImV4cCI6MjA3NTgwNjIzM30.CpKg1MKbcTtEUfmGDzcXPvZoTQH3dygUL61yYYiLPyQ';
const SITE_BASE_URL = 'https://altnixtecnologia.github.io/assinador-os';
const supabase = self.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    const ITENS_PER_PAGE = 50;
    let totalDocuments = 0;
    let currentStatusFilter = 'todos';
    let currentSearchTerm = '';
    let debounceTimer;
    let docIdParaExcluir = null;

    // --- Funções ---
    function resetPreparationView() {
        preparationView.style.display = 'none';
        consultationView.style.display = 'none';
        uploadInitialView.style.display = 'block';
        osFileInput.value = '';
        pdfDoc = null;
        currentFile = null;
        rects = { tecnico: null, cliente: null };
        pdfPreviewWrapper.innerHTML = '';
    }

    async function handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file || file.type !== "application/pdf") return;
        currentFile = file;
        uploadInitialView.style.display = 'none';
        consultationView.style.display = 'none';
        preparationView.style.display = 'block';
        actionsContainer.classList.add('hidden');
        feedbackMessage.textContent = '';
        clienteNomeInput.value = '';
        clienteTelefoneInput.value = '';
        clienteEmailInput.value = '';
        await processarArquivoPDF(file);
        const fileReader = new FileReader();
        fileReader.onload = async function() {
            const pdfBytes = new Uint8Array(this.result);
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js`;
            pdfDoc = await pdfjsLib.getDocument(pdfBytes).promise;
            await renderPdfPreview();
        };
        fileReader.readAsArrayBuffer(file);
        instructionText.textContent = "1/2: Desenhe a área para a assinatura do TÉCNICO.";
        currentDrawingFor = 'tecnico';
    }

    async function renderPdfPreview() {
        if (!pdfDoc) return;
        pdfPreviewWrapper.innerHTML = '';
        const containerWidth = pdfPreviewWrapper.clientWidth;
        let totalHeight = 0;
        pageDimensions = [];
        const bgCanvas = document.createElement('canvas');
        bgCanvas.id = 'pdf-background-canvas';
        const drawCanvas = document.createElement('canvas');
        drawCanvas.id = 'pdf-drawing-canvas';
        pdfPreviewWrapper.appendChild(bgCanvas);
        pdfPreviewWrapper.appendChild(drawCanvas);
        const bgCtx = bgCanvas.getContext('2d');
        const pages = [];
        for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            pages.push(page);
            const viewport = page.getViewport({ scale: 1.0 });
            const scaledHeight = (containerWidth / viewport.width) * viewport.height;
            pageDimensions.push({ num: i, width: viewport.width, height: viewport.height, scaledHeight: scaledHeight, rotation: page.rotate });
            totalHeight += scaledHeight;
        }
        bgCanvas.width = drawCanvas.width = containerWidth;
        bgCanvas.height = drawCanvas.height = totalHeight;
        drawCanvas.style.position = 'absolute';
        drawCanvas.style.top = '0';
        drawCanvas.style.left = '0';
        drawCanvas.style.cursor = 'crosshair';
        let currentY = 0;
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const scaledViewport = page.getViewport({ scale: containerWidth / page.getViewport({ scale: 1.0 }).width });
            const renderContext = {
                canvasContext: bgCtx,
                transform: [1, 0, 0, 1, 0, currentY],
                viewport: scaledViewport
            };
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
        drawRect(tempRect, color);
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
        drawRect(rects.tecnico, 'rgba(255, 0, 0, 0.4)', 'Técnico');
        drawRect(rects.cliente, 'rgba(0, 0, 255, 0.4)', 'Cliente');
    }
    
    function getMousePos(canvas, evt) {
        const rect = canvas.getBoundingClientRect();
        return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
    }
    
    function drawRect(rect, color, label = '') {
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

    async function processarArquivoPDF(file) {
        showFeedback('Lendo dados do PDF...', 'info');
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
                const nomeRegex = /Cliente\s*([\s\S]*?)\s*(?:\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})/i;
                const osRegex = /Ordem de serviço N°\s*(\d+)/i;
                const foneRegex = /(?:Celular|Telefone|Fone):\s*([()\d\s-]+)/i;
                const emailRegex = /(?:Email|E-mail):\s*([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
                const nomeMatch = fullText.match(nomeRegex);
                const osMatch = fullText.match(osRegex);
                const foneMatch = fullText.match(foneRegex);
                const emailMatch = fullText.match(emailRegex);
                let statusOS = null;
                const palavrasChave = ["Concluído", "Entregue", "Garantia", "Não autorizou"];
                for (const palavra of palavrasChave) {
                    if (fullText.toLowerCase().includes(palavra.toLowerCase())) {
                        statusOS = palavra;
                        break;
                    }
                }
                if (nomeMatch && nomeMatch[1]) clienteNomeInput.value = nomeMatch[1].trim();
                if (foneMatch && foneMatch[1]) clienteTelefoneInput.value = foneMatch[1].trim().replace(/\D/g, '');
                if (emailMatch && emailMatch[1]) clienteEmailInput.value = emailMatch[1].trim();
                uploadForm.dataset.extractedOs = osMatch ? osMatch[1].trim() : '';
                uploadForm.dataset.extractedStatusOs = statusOS || '';
                showFeedback('Dados extraídos! Prossiga com a marcação.', 'success');
            } catch (error) {
                console.error("Erro ao processar o PDF no cliente:", error);
                showFeedback('Não foi possível ler os dados.', 'error');
            }
        };
        reader.readAsArrayBuffer(file);
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

    function showFeedback(message, type) {
        const colorClasses = {
            success: 'text-green-600',
            error: 'text-red-600',
            info: 'text-blue-600'
        };
        feedbackMessage.textContent = message;
        feedbackMessage.className = `mt-4 text-center text-sm ${colorClasses[type] || 'text-gray-600'}`;
    }

    // --- Lógica de Consulta ---
    async function carregarDocumentos() {
        listLoadingFeedback.style.display = 'block';
        listLoadingFeedback.textContent = "Carregando documentos...";
        documentList.innerHTML = '';
        const from = currentPage * ITENS_PER_PAGE;
        const to = from + ITENS_PER_PAGE - 1;
        let query = supabase
            .from('documentos')
            .select(`id, created_at, status, cliente_email, nome_cliente, n_os, status_os, caminho_arquivo_storage, caminho_arquivo_assinado, assinaturas ( nome_signatario, cpf_cnpj_signatario, email_signatario, assinado_em, imagem_assinatura_base64 )`, { count: 'exact' })
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
                        <p class="text-sm text-gray-500 truncate">${doc.nome_cliente ? `Cliente: ${doc.nome_cliente}` : (assinatura ? `Assinado por: ${assinatura.nome_signatario}` : '')}</p>
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
            await supabase.from('assinaturas').delete().eq('documento_id', docIdParaExcluir);
            await supabase.from('documentos').delete().eq('id', docIdParaExcluir);
            alert('Documento excluído com sucesso!');
            fecharModalExclusao();
            carregarDocumentos();
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

    // --- Event Listeners ---
    osFileInput.addEventListener('change', handleFileSelect);
    cancelPreparationBtn.addEventListener('click', resetPreparationView);
    showConsultationBtn.addEventListener('click', () => {
        uploadInitialView.style.display = 'none';
        preparationView.style.display = 'none';
        consultationView.style.display = 'block';
        carregarDocumentos();
    });
    backToInitialViewBtn.addEventListener('click', resetPreparationView);
    
    uploadForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!rects.tecnico || !rects.cliente) {
            alert("Por favor, defina as áreas de assinatura para o técnico e para o cliente.");
            return;
        }
        
        const canvasWidth = document.getElementById('pdf-background-canvas').width;
        
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
            const scale = pageDim.width / canvasWidth;
            return {
                page: pageNum, 
                x: rect.x * scale,
                y: pageDim.height - ((rect.y - yOffset) * scale) - (rect.height * scale),
                width: rect.width * scale,
                height: rect.height * scale
            };
        };

        const tecnicoCoords = convertCoords(rects.tecnico);
        const clienteCoords = convertCoords(rects.cliente);
        const nomeCliente = clienteNomeInput.value || null;
        const telefoneCliente = clienteTelefoneInput.value || null;
        const emailCliente = clienteEmailInput.value || null;
        const n_os = uploadForm.dataset.extractedOs || null;
        const status_os = uploadForm.dataset.extractedStatusOs || null;
        
        setLoading(true);
        try {
            const fileName = `${Date.now()}-${sanitizarNomeArquivo(currentFile.name)}`;
            const { data: uploadData, error: uploadError } = await supabase.storage.from('documentos').upload(fileName, currentFile);
            if(uploadError) throw uploadError;
            const { data: insertData, error: insertError } = await supabase.from('documentos').insert({ 
                caminho_arquivo_storage: uploadData.path, 
                nome_cliente: nomeCliente,
                telefone_cliente: telefoneCliente,
                cliente_email: emailCliente,
                n_os: n_os,
                status_os: status_os,
                tecnico_assinatura_coords: tecnicoCoords,
                cliente_assinatura_coords: clienteCoords
            }).select('id').single();
            if(insertError) throw insertError;
            const documentoId = insertData.id;
            const linkDeAssinatura = `${SITE_BASE_URL}/assinar.html?id=${documentoId}`;
            linkInput.value = linkDeAssinatura;
            actionsContainer.classList.remove('hidden');
            whatsappContainer.style.display = telefoneCliente ? 'block' : 'none';
            showFeedback('Link gerado!', 'success');
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

    window.addEventListener('resize', renderPdfPreview);

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
            abrirExclusaoModal(docId);
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
    
    deleteCheckbox.addEventListener('change', () => {
        confirmDeleteBtn.disabled = !deleteCheckbox.checked;
        confirmDeleteBtn.classList.toggle('btn-disabled', !deleteCheckbox.checked);
    });
    
    cancelDeleteBtn.addEventListener('click', fecharModalExclusao);
    
    confirmDeleteBtn.addEventListener('click', executarExclusao);
});
