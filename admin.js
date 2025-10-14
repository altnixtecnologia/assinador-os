// Configuração do Supabase
const SUPABASE_URL = 'https://nlefwzyyhspyqcicfouc.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sZWZ3enl5aHNweXFjaWNmb3VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMzAyMzMsImV4cCI6MjA3NTgwNjIzM30.CpKg1MKbcTtEUfmGDzcXPvZoTQH3dygUL61yYYiLPyQ';
const SITE_BASE_URL = 'https://altnixtecnologia.github.io/assinador-os';
const supabase = self.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Elementos da UI ---
let osFileInput, uploadInitialView, preparationView, cancelPreparationBtn, instructionText, pdfPreviewWrapper, pdfBackgroundCanvas, pdfDrawingCanvas, bgCtx, drawCtx, uploadForm, clienteNomeInput, clienteTelefoneInput, clienteEmailInput, submitButton, feedbackMessage, actionsContainer, linkInput, copiarBtn, whatsappBtn, whatsappContainer;

// --- Estado do Aplicativo ---
let pdfDoc = null;
let currentFile = null;
let currentDrawingFor = 'tecnico';
let isDrawing = false;
let startCoords = { x: 0, y: 0 };
let rects = { tecnico: null, cliente: null };
let pageDimensions = [];

// --- Funções ---

function resetPreparationView() {
    preparationView.style.display = 'none';
    uploadInitialView.style.display = 'block';
    osFileInput.value = '';
    pdfDoc = null;
    currentFile = null;
    rects = { tecnico: null, cliente: null };
    if (pdfBackgroundCanvas) {
        bgCtx.clearRect(0, 0, pdfBackgroundCanvas.width, pdfBackgroundCanvas.height);
        drawCtx.clearRect(0, 0, pdfDrawingCanvas.width, pdfDrawingCanvas.height);
    }
}

async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file || file.type !== "application/pdf") return;
    currentFile = file;
    uploadInitialView.style.display = 'none';
    preparationView.style.display = 'block';
    actionsContainer.classList.add('hidden');
    feedbackMessage.textContent = '';
    clienteNomeInput.value = '';
    clienteTelefoneInput.value = '';
    clienteEmailInput.value = '';
    processarArquivoPDF(file);
    const fileReader = new FileReader();
    fileReader.onload = async function() {
        const pdfBytes = new Uint8Array(this.result);
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js`;
        pdfDoc = await pdfjsLib.getDocument(pdfBytes).promise;
        renderPdfPreview();
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
    
    // Reatribui as variáveis globais
    pdfBackgroundCanvas = bgCanvas;
    pdfDrawingCanvas = drawCanvas;
    bgCtx = bgCanvas.getContext('2d');
    drawCtx = drawCanvas.getContext('2d');

    const pages = [];
    for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        pages.push(page);
        const viewport = page.getViewport({ scale: 1.0 });
        const scaledHeight = (containerWidth / viewport.width) * viewport.height;
        pageDimensions.push({ width: viewport.width, height: viewport.height, scaledHeight: scaledHeight });
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
    startCoords = getMousePos(pdfDrawingCanvas, event);
}

function draw(event) {
    if (!isDrawing) return;
    const currentCoords = getMousePos(pdfDrawingCanvas, event);
    redrawAll();
    const width = currentCoords.x - startCoords.x;
    const height = currentCoords.y - startCoords.y;
    const tempRect = { x: startCoords.x, y: startCoords.y, width, height };
    const color = currentDrawingFor === 'tecnico' ? 'rgba(255, 0, 0, 0.4)' : 'rgba(0, 0, 255, 0.4)';
    drawRect(tempRect, color);
}

function stopDrawing(event) {
    if (!isDrawing) return;
    isDrawing = false;
    const endCoords = getMousePos(pdfDrawingCanvas, event);
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
    if (!drawCtx) return;
    drawCtx.clearRect(0, 0, drawCtx.canvas.width, drawCtx.canvas.height);
    drawRect(rects.tecnico, 'rgba(255, 0, 0, 0.4)', 'Técnico');
    drawRect(rects.cliente, 'rgba(0, 0, 255, 0.4)', 'Cliente');
}

function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
}

function drawRect(rect, color, label = '') {
    if (!rect) return;
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

function sanitizarNomeArquivo(nome) {
    const nomeSemAcentos = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return nomeSemAcentos.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9.\-_]/g, '_');
}

function setLoading(isLoading) {
    const submitButton = document.getElementById('submit-button');
    if (isLoading) {
        submitButton.disabled = true;
        submitButton.innerHTML = `<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Gerando...`;
    } else {
        submitButton.disabled = false;
        submitButton.textContent = 'Gerar Link de Assinatura';
    }
}

function showFeedback(message, type) {
    const feedbackMessage = document.getElementById('feedback-message');
    const colorClasses = {
        success: 'text-green-600',
        error: 'text-red-600',
        info: 'text-blue-600'
    };
    feedbackMessage.textContent = message;
    feedbackMessage.className = `mt-4 text-center text-sm ${colorClasses[type] || 'text-gray-600'}`;
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // Inicializa todos os elementos da UI aqui para garantir que existam
    osFileInput = document.getElementById('os-file');
    uploadInitialView = document.getElementById('upload-initial-view');
    preparationView = document.getElementById('preparation-view');
    cancelPreparationBtn = document.getElementById('cancel-preparation-btn');
    instructionText = document.getElementById('instruction-text');
    pdfPreviewWrapper = document.getElementById('pdf-preview-wrapper');
    // ... (e todos os outros elementos)

    osFileInput.addEventListener('change', handleFileSelect);
    cancelPreparationBtn.addEventListener('click', resetPreparationView);
    // (outros listeners, como os da consulta, seriam adicionados aqui se a consulta estivesse nesta página)
});

uploadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!rects.tecnico || !rects.cliente) {
        alert("Por favor, defina as áreas de assinatura para o técnico e para o cliente.");
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

        const scale = pageDimensions[pageNum-1].width / pdfDrawingCanvas.width;
        
        return {
            page: pageNum, 
            x: rect.x * scale,
            y: pageDimensions[pageNum-1].height - ((rect.y - yOffset) * scale) - (rect.height * scale),
            width: rect.width * scale,
            height: rect.height * scale
        };
    };

    const tecnicoCoords = convertCoords(rects.tecnico);
    const clienteCoords = convertCoords(rects.cliente);
    
    // ... (restante da lógica de envio que já tínhamos)
});
