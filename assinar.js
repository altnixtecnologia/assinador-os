<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Assinatura de Documento</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        #signature-pad-container { touch-action: none; }
        .signature-pad { border: 2px dashed #ccc; border-radius: 0.5rem; cursor: crosshair; }
        .loader { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body class="bg-gray-100">

    <div id="loading-view" class="flex flex-col items-center justify-center min-h-screen">
        <div class="loader"></div>
        <p class="mt-4 text-gray-600">Carregando documento...</p>
    </div>

    <div id="main-content" class="container mx-auto p-4 max-w-4xl hidden">
        
        <div id="login-step" class="text-center bg-white p-8 rounded-lg shadow-lg">
            <h1 class="text-2xl font-bold text-gray-800 mb-4">Assinatura de Ordem de Serviço</h1>
            <p class="text-gray-600 mb-6">Para sua segurança, digite seu e-mail abaixo. Você receberá um link de acesso para continuar.</p>
            <form id="magic-link-form" class="flex flex-col max-w-sm mx-auto">
                <input type="email" id="email-input" class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="seuemail@exemplo.com" required>
                <button type="submit" class="mt-4 bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition duration-300">
                    Enviar Link de Acesso
                </button>
            </form>
            <p id="login-feedback" class="text-gray-600 mt-4 text-sm"></p>
        </div>

        <div id="signing-step" class="hidden">
            <div class="bg-white p-6 rounded-lg shadow-md mb-6">
                <h1 class="text-xl font-bold text-gray-800">Documento para Assinatura</h1>
                <p class="text-sm text-gray-500">Revise a Ordem de Serviço abaixo.</p>
                <div id="pdf-viewer" class="mt-4 border rounded-lg overflow-hidden" style="height: 600px;"></div>
            </div>
            <div class="bg-white p-6 rounded-lg shadow-md">
                <h2 class="text-xl font-bold text-gray-800 mb-4">Confirmação de Dados e Assinatura</h2>
                <form id="signature-form" class="space-y-4">
                    <div>
                        <label for="user-name" class="block text-sm font-medium text-gray-700">Nome Completo</label>
                        <input type="text" id="user-name" class="mt-1 block w-full bg-gray-100 p-2 border border-gray-300 rounded-md" readonly>
                    </div>
                    <div>
                        <label for="user-email" class="block text-sm font-medium text-gray-700">E-mail</label>
                        <input type="email" id="user-email" class="mt-1 block w-full bg-gray-100 p-2 border border-gray-300 rounded-md" readonly>
                    </div>
                    <div>
                        <label for="user-cpf" class="block text-sm font-medium text-gray-700">CPF/CNPJ (Obrigatório)</label>
                        <input type="text" id="user-cpf" class="mt-1 block w-full p-2 border border-gray-300 rounded-md" placeholder="Digite seu CPF ou CNPJ" required>
                    </div>
                    <div id="signature-pad-container">
                        <label class="block text-sm font-medium text-gray-700">Assine no campo abaixo</label>
                        <canvas id="signature-pad" class="signature-pad w-full h-48 mt-1"></canvas>
                        <div class="text-right mt-2"><button type="button" id="clear-signature-btn" class="text-sm text-blue-600 hover:underline">Limpar</button></div>
                    </div>
                    <button type="submit" id="submit-signature-btn" class="w-full bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700 transition duration-300">Assinar e Finalizar</button>
                </form>
            </div>
        </div>

        <div id="success-step" class="hidden text-center bg-white p-8 rounded-lg shadow-lg">
             <h1 class="text-2xl font-bold text-green-600 mb-4">Documento Assinado com Sucesso!</h1>
             <p class="text-gray-600">Obrigado! Uma cópia do documento assinado foi registrada. Você pode fechar esta janela.</p>
        </div>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/signature_pad@4.0.0/dist/signature_pad.umd.min.js"></script>
    <script src="assinar.js"></script>
</body>
</html>
