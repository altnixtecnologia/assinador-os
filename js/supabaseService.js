// js/supabaseService.js
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = self.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- FUNÇÕES DO PAINEL ADMIN ---

export async function getDocuments(page, itemsPerPage, filter, searchTerm) {
    const from = page * itemsPerPage;
    const to = from + itemsPerPage - 1;

    let query = supabase
        .from('documentos')
        .select(`
            id, created_at, status, cliente_email, nome_cliente, n_os, status_os, 
            caminho_arquivo_storage, caminho_arquivo_assinado, 
            assinaturas ( nome_signatario, cpf_cnpj_signatario, email_signatario, assinado_em, imagem_assinatura_base64 )
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

    if (filter !== 'todos') {
        query = query.eq('status', filter);
    }
    if (searchTerm) {
        query = query.or(`caminho_arquivo_storage.ilike.%${searchTerm}%,cliente_email.ilike.%${searchTerm}%,nome_cliente.ilike.%${searchTerm}%,n_os.ilike.%${searchTerm}%,status_os.ilike.%${searchTerm}%,assinaturas.nome_signatario.ilike.%${searchTerm}%`);
    }

    return await query;
}

export async function uploadFile(fileName, file) {
    const { data, error } = await supabase.storage.from('documentos').upload(fileName, file);
    if (error) throw error;
    return data;
}

export async function createDocumentRecord(documentData) {
    const { data, error } = await supabase.from('documentos').insert(documentData).select('id').single();
    if (error) throw error;
    return data;
}

export async function deleteDocument(docId) {
    const { error: signError } = await supabase.from('assinaturas').delete().eq('documento_id', docId);
    if (signError) throw signError;

    const { error: docError } = await supabase.from('documentos').delete().eq('id', docId);
    if (docError) throw docError;
}

export function getPublicUrl(path) {
    const { data } = supabase.storage.from('documentos').getPublicUrl(path);
    return data.publicUrl;
}


// --- FUNÇÕES DA PÁGINA DE ASSINATURA ---

/**
 * Verifica se um documento já possui uma assinatura.
 */
export async function checkIfSigned(docId) {
    // ATUALIZADO AQUI: Forma mais robusta de verificar, evitando o erro 406.
    const { data, error } = await supabase
        .from('assinaturas')
        .select('id')
        .eq('documento_id', docId);

    if (error) {
        console.error("Erro em checkIfSigned:", error);
        return false;
    }
    // Retorna true se o array de dados tiver pelo menos um item.
    return data && data.length > 0;
}

/**
 * Inicia o fluxo de login com o Google.
 */
export async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.href
        }
    });
    if (error) throw error;
}

/**
 * Busca os dados de um documento específico para assinatura.
 */
export async function getDocumentForSigning(docId) {
    const { data, error } = await supabase.from('documentos').select('caminho_arquivo_storage').eq('id', docId).single();
    if (error) throw error;
    return data;
}

/**
 * Submete os dados da assinatura para a Edge Function 'salvar-assinatura'.
 */
export async function submitSignature(signatureData) {
    const { data, error } = await supabase.functions.invoke('salvar-assinatura', {
        body: signatureData,
    });
    if (error) throw error;
    return data;
}
