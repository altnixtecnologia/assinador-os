// Configuração do Cliente Supabase (com suas credenciais)
const SUPABASE_URL = 'https://nlefwzyyhspyqcicfouc.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sZWZ3enl5aHNweXFjaWNmb3VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMzAyMzMsImV4cCI6MjA3NTgwNjIzM30.CpKg1MKbcTtEUfmGDzcXPvZoTQH3dygUL61yYYiLPyQ';

const supabase = self.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Selecionar os elementos do HTML
const uploadForm = document.getElementById('upload-form');
const osFileInput = document.getElementById('os-file');
const clienteEmailInput = document.getElementById('cliente-email');
const submitButton = document.getElementById('submit-button');
const feedbackMessage = document.getElementById('feedback-message');
const linkContainer = document.getElementById('link-gerado-container');
const linkInput = document.getElementById('link-gerado-input');
const copiarBtn = document.getElementById('copiar-link-btn');

uploadForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const file = osFileInput.files[0];
    const email = clienteEmailInput.value || null;

    if (!file) {
        showFeedback('Por favor, selecione um arquivo PDF.', 'error');
        return;
    }
    
    linkContainer.classList.add('hidden');
    setLoading(true);

    try {
        const fileName = `${Date.now()}-${file.name}`;

        const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('documentos')
            .upload(fileName, file);

        if (uploadError) throw uploadError;
        
        const { data: insertData, error: insertError } = await supabase
            .from('documentos')
            .insert({
                caminho_arquivo_storage: uploadData.path,
                cliente_email: email
            })
            .select('id')
            .single();

        if (insertError) throw insertError;

        const documentoId = insertData.id;
        // ATENÇÃO: O nome 'assinar.html' é a página que criaremos para o cliente.
        const linkDeAssinatura = `${window.location.origin}/assinar.html?id=${documentoId}`;
        
        linkInput.value = linkDeAssinatura;
        linkContainer.classList.remove('hidden');
        showFeedback('Link gerado! Copie e envie para seu cliente via WhatsApp.', 'success');
        uploadForm.reset();

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
    setTimeout(() => {
        copiarBtn.textContent = 'Copiar';
    }, 2000);
});

function setLoading(isLoading) {
    if (isLoading) {
        submitButton.disabled = true;
        submitButton.innerHTML = `
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Gerando...`;
        feedbackMessage.textContent = '';
    } else {
        submitButton.disabled = false;
        submitButton.textContent = 'Gerar Link de Assinatura';
    }
}

function showFeedback(message, type) {
    feedbackMessage.textContent = message;
    if (type === 'success') {
        feedbackMessage.className = 'mt-4 text-center text-sm text-green-600';
    } else {
        feedbackMessage.className = 'mt-4 text-center text-sm text-red-600';
    }
}
