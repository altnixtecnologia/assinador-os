// Configuração do Supabase
const SUPABASE_URL = 'https://nlefwzyyhspyqcicfouc.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sZWZ3enl5aHNweXFjaWNmb3VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMzAyMzMsImV4cCI6MjA3NTgwNjIzM30.CpKg1MKbcTtEUfmGDzcXPvZoTQH3dygUL61yYYiLPyQ';
const SITE_BASE_URL = 'https://altnixtecnologia.github.io/assinador-os';
const supabase = self.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos da UI ---
    const osFileInput = document.getElementById('os-file');
    const uploadInitialView = document.getElementById('upload-initial-view');
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
    const consultationSection = document.getElementById('consultation-section');

    // --- Estado do Aplicativo ---
    let pdfDoc = null;
    let currentFile = null;
    let currentDrawingFor = 'tecnico';
    let isDrawing = false;
    let startCoords = { x: 0, y: 0 };
    let rects = { tecnico: null, cliente: null };
    let pageDimensions = [];
    
    // --- Funções da Ferramenta de Marcação ---
    
    function resetPreparationView() {
        preparationView.style.display = 'none';
        uploadInitialView.style.display = 'block';
        osFileInput.value = '';
        pdfDoc = null;
        currentFile = null;
        rects = { tecnico: null, cliente: null };
        pdfPreviewWrapper.innerHTML = ''; // Limpa os canvases
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
            pageDimensions.push({ width: viewport.width, height: viewport.height, scaledHeight: scaledHeight, rotation: page.rotate });
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
        const drawCanvas = document.getElementById('pdf-drawing-canvas');
        isDrawing = true;
        startCoords = getMousePos(drawCanvas, event);
    }

    function draw(event) {
        if (!isDrawing) return;
        const drawCanvas = document.getElementById('pdf-drawing-canvas');
        const currentCoords = getMousePos(drawCanvas, event);
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
        const drawCanvas = document.getElementById('pdf-drawing-canvas');
        const endCoords = getMousePos(drawCanvas, event);
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
    
    function setLoading(isLoading) { /* ...código sem alteração... */ }
    function showFeedback(message, type) { /* ...código sem alteração... */ }
    
    // --- Event Listeners ---
    osFileInput.addEventListener('change', handleFileSelect);
    cancelPreparationBtn.addEventListener('click', resetPreparationView);
    uploadForm.addEventListener('submit', async (event) => { /* ... (código que já tínhamos)... */ });
    // (outros listeners seriam definidos aqui)
});
