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

// --- Estado do Aplicativo ---
let pdfPage = null;
let currentFile = null;
let currentDrawingFor = 'tecnico';
let isDrawing = false;
let startCoords = { x: 0, y: 0 };
let rects = { tecnico: null, cliente: null };

// --- Funções ---

function resetPreparationView() {
    preparationView.style.display = 'none';
    uploadInitialView.style.display = 'block';
    osFileInput.value = '';
    pdfPage = null;
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
        const pdfDoc = await pdfjsLib.getDocument(pdfBytes).promise;
        pdfPage = await pdfDoc.getPage(1);
        renderPdfPreview();
    };
    fileReader.readAsArrayBuffer(file);
    
    instructionText.textContent = "1/2: Desenhe a área para a assinatura do TÉCNICO.";
    currentDrawingFor = 'tecnico';
}

async function renderPdfPreview() {
    if (!pdfPage) return;

    const rotation = pdfPage.rotate;
    const containerWidth = pdfBackgroundCanvas.parentElement.clientWidth;
    const viewport = pdfPage.getViewport({ scale: 1.0 });
    const scale = containerWidth / viewport.width;
    const scaledViewport = pdfPage.getViewport({ scale, rotation });

    pdfBackgroundCanvas.width = pdfDrawingCanvas.width = scaledViewport.width;
    pdfBackgroundCanvas.height = pdfDrawingCanvas.height = scaledViewport.height;

    bgCtx.clearRect(0, 0, scaledViewport.width, scaledViewport.height);
    await pdfPage.render({ canvasContext: bgCtx, viewport: scaledViewport }).promise;
    
    redrawAll();
}

function startDrawing(event) {
    isDrawing = true;
    startCoords = getMousePos(pdfDrawingCanvas, event);
}

function draw(event) {
    if (!isDrawing) return;
    const currentCoords = getMousePos(pdfDrawingCanvas, event);
    
    drawCtx.clearRect(0, 0, pdfDrawingCanvas.width, pdfDrawingCanvas.height);
    drawRect(rects.tecnico, 'rgba(255, 0, 0, 0.4)', 'Técnico');
    drawRect(rects.cliente, 'rgba(0, 0, 255, 0.4)', 'Cliente');

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
    drawCtx.clearRect(0, 0, pdfDrawingCanvas.width, pdfDrawingCanvas.height);
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

async function processarArquivoPDF(file) { /* ... (código que já tínhamos) ... */ }
function sanitizarNomeArquivo(nome) { /* ... (código que já tínhamos) ... */ }
function setLoading(isLoading) { /* ... (código que já tínhamos) ... */ }
function showFeedback(message, type) { /* ... (código que já tínhamos) ... */ }

// --- Event Listeners ---
osFileInput.addEventListener('change', handleFileSelect);
cancelPreparationBtn.addEventListener('click', resetPreparationView);
pdfDrawingCanvas.addEventListener('mousedown', startDrawing);
pdfDrawingCanvas.addEventListener('mousemove', draw);
pdfDrawingCanvas.addEventListener('mouseup', stopDrawing);
window.addEventListener('resize', renderPdfPreview); // Recalcula o PDF ao redimensionar a janela

uploadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!rects.tecnico || !rects.cliente) {
        alert("Por favor, defina as áreas de assinatura para o técnico e para o cliente.");
        return;
    }
    const unscaledViewport = pdfPage.getViewport({scale: 1.0});
    const scaledViewport = pdfPage.getViewport({scale: pdfBackgroundCanvas.width / unscaledViewport.width});

    const convertCoords = (rect) => {
        if (!rect) return null;
        const scaleX = unscaledViewport.width / scaledViewport.width;
        const scaleY = unscaledViewport.height / scaledViewport.height;
        let x = rect.x * scaleX;
        let y = rect.y * scaleY;
        let width = rect.width * scaleX;
        let height = rect.height * scaleY;

        // Ajusta para a rotação
        if(pdfPage.rotate === 90){
            y = rect.x * scaleY;
            x = unscaledViewport.height - (rect.y * scaleX) - (rect.height * scaleX);
            width = rect.height * scaleX;
            height = rect.width * scaleY;
        } // Adicionar lógica para outras rotações se necessário
        
        return {
            page: 1, 
            x: x,
            y: unscaledViewport.height - y - height,
            width: width,
            height: height
        };
    };

    const tecnicoCoords = convertCoords(rects.tecnico);
    const clienteCoords = convertCoords(rects.cliente);
    const nomeCliente = clienteNomeInput.value || null;
    const telefoneCliente = clienteTelefoneInput.value || null;
    const emailCliente = clienteEmailInput.value || null;
    
    // ... (restante da lógica de envio que já tínhamos)
});

// (O restante do código de consulta e seus listeners não fazem parte deste arquivo)
