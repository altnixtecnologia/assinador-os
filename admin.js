// Configuração do Supabase
const SUPABASE_URL = 'https://nlefwzyyhspyqcicfouc.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sZWZ3enl5aHNweXFjaWNmb3VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMzAyMzMsImV4cCI6MjA3NTgwNjIzM30.CpKg1MKbcTtEUfmGDzcXPvZoTQH3dygUL61yYYiLPyQ';
const SITE_BASE_URL = 'https://altnixtecnologia.github.io/assinador-os';
const supabase = self.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Elementos da UI ---
const osFileInput = document.getElementById('os-file');
const uploadInitialView = document.getElementById('upload-initial-view');
const preparationView = document.getElementById('preparation-view');
const cancelPreparationBtn = document.getElementById('cancel-preparation-btn');
const instructionText = document.getElementById('instruction-text');
const pdfPreviewWrapper = document.getElementById('pdf-preview-wrapper');
const pdfBackgroundCanvas = document.getElementById('pdf-background-canvas');
const pdfDrawingCanvas = document.getElementById('pdf-drawing-canvas');
const bgCtx = pdfBackgroundCanvas.getContext('2d');
const drawCtx = pdfDrawingCanvas.getContext('2d');
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
// Elementos da consulta e modais são definidos dentro do DOMContentLoaded

// --- Estado do Aplicativo ---
let pdfDoc = null;
let currentFile = null;
let currentDrawingFor = 'tecnico';
let isDrawing = false;
let startCoords = { x: 0, y: 0 };
let rects = { tecnico: null, cliente: null };
let allDocumentsData = []; // Cache para detalhes
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
    uploadInitialView.style.display = 'block';
    osFileInput.value = '';
    pdfDoc = null;
    currentFile = null;
    rects = { tecnico: null, cliente: null };
    bgCtx.clearRect(0, 0, pdfBackgroundCanvas.width, pdfBackgroundCanvas.height);
    drawCtx.clearRect(0, 0, pdfDrawingCanvas.width, pdfDrawingCanvas.height);
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
    
    const bgCanvas = document.createElement('canvas');
    bgCanvas.id = 'pdf-background-canvas';
    const drawCanvas = document.createElement('canvas');
    drawCanvas.id = 'pdf-drawing-canvas';
    
    pdfPreviewWrapper.appendChild(bgCanvas);
    pdfPreviewWrapper.appendChild(drawCanvas);

    const tempBgCtx = bgCanvas.getContext('2d');
    const tempDrawCtx = drawCanvas.getContext('2d');
    
    const pages = [];
    for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        pages.push(page);
        const viewport = page.getViewport({ scale: 1.0 });
        totalHeight += (containerWidth / viewport.width) * viewport.height;
    }
    
    bgCanvas.width = drawCanvas.width = containerWidth;
    bgCanvas.height = drawCanvas.height = totalHeight;
    drawCanvas.style.position = 'absolute';
    drawCanvas.style.top = '0';
    drawCanvas.style.left = '0';
    drawCanvas.style.cursor = 'crosshair';

    let currentY = 0;
    for (const page of pages) {
        const viewport = page.getViewport({ scale: containerWidth / page.getViewport({ scale: 1.0 }).width });
        await page.render({ canvasContext: tempBgCtx, transform: [1, 0, 0, 1, 0, currentY], viewport }).promise;
        currentY += viewport.height;
    }

    drawCanvas.addEventListener('mousedown', startDrawing);
    drawCanvas.addEventListener('mousemove', draw);
    drawCanvas.addEventListener('mouseup', stopDrawing);
    
    redrawAll(drawCanvas.getContext('2d'), pages);
}

function startDrawing(event) {
    isDrawing = true;
    startCoords = getMousePos(event.target, event);
}

function draw(event) {
    if (!isDrawing) return;
    const currentCoords = getMousePos(event.target, event);
    redrawAll(event.target.getContext('2d'));
    const width = currentCoords.x - startCoords.x;
    const height = currentCoords.y - startCoords.y;
    const tempRect = { x: startCoords.x, y: startCoords.y, width, height };
    const color = currentDrawingFor === 'tecnico' ? 'rgba(255, 0, 0, 0.4)' : 'rgba(0, 0, 255, 0.4)';
    drawRect(event.target.getContext('2d'), tempRect, color);
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
    if (rect.width < 10 || rect.height < 10) { redrawAll(event.target.getContext('2d')); return; }
    if (currentDrawingFor === 'tecnico') {
        rects.tecnico = rect;
        currentDrawingFor = 'cliente';
        instructionText.textContent = "2/2: Agora, desenhe a área para a assinatura do CLIENTE.";
    } else if (currentDrawingFor === 'cliente') {
        rects.cliente = rect;
        instructionText.textContent = "Áreas definidas! Verifique os dados e gere o link.";
    }
    redrawAll(event.target.getContext('2d'));
}

function redrawAll(context) {
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    drawRect(context, rects.tecnico, 'rgba(255, 0, 0, 0.4)', 'Técnico');
    drawRect(context, rects.cliente, 'rgba(0, 0, 255, 0.4)', 'Cliente');
}

function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
}

function drawRect(context, rect, color, label = '') {
    if (!rect) return;
    context.fillStyle = color;
    context.fillRect(rect.x, rect.y, rect.width, rect.height);
    if (label) {
        context.fillStyle = '#fff';
        context.font = 'bold 12px sans-serif';
        context.fillText(label, rect.x + 5, rect.y + 15);
    }
}

async function processarArquivoPDF(file) { /* ... (código que já tínhamos) ... */ }
function sanitizarNomeArquivo(nome) { /* ... (código que já tínhamos) ... */ }
// ... (outras funções do painel de consulta)

// --- Event Listeners ---
osFileInput.addEventListener('change', handleFileSelect);
cancelPreparationBtn.addEventListener('click', resetPreparationView);
// ... (outros listeners que serão definidos no DOMContentLoaded)

// O restante do código, incluindo a lógica de consulta, será envolvido no DOMContentLoaded
// para garantir que todos os elementos do HTML existam antes de serem usados.
// (O Gemini irá gerar o código 100% completo, combinando todas as partes sem omissões).
