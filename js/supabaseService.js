// js/supabaseService.js
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

/**
 * Módulo de serviço para todas as interações com o Supabase.
 * Centraliza a lógica de banco de dados, autenticação, storage e functions.
 */

// Cria e exporta o cliente Supabase para ser usado em toda a aplicação
export const supabase = self.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- FUNÇÕES DO PAINEL ADMIN ---

/**
 * Busca uma lista paginada de documentos com filtros e busca.
 * @param {number} page - A página atual.
 * @param {number} itemsPerPage - Itens por página.
 * @param {string} filter - O filtro de status ('todos', 'assinado', 'pendente').
 * @param {string} searchTerm - O termo de busca.
 * @returns {Promise<{data: any[], error: any, count: number}>}
 */
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

/**
 * Faz upload de um arquivo para o Supabase Storage.
 * @param {string} fileName - O nome do arquivo a ser salvo.
 * @param {File} file - O objeto do arquivo.
 * @returns {Promise<any>}
 */
export async function uploadFile(fileName, file) {
    const { data, error } = await supabase.storage.from('documentos').upload(fileName, file);
    if (error) throw error;
    return data;
}

/**
 * Cria um novo registro de documento no banco de dados.
 * @param {object} documentData - Os metadados do documento.
 * @returns {Promise<any>}
 */
export async function createDocumentRecord(documentData) {
    const { data, error } = await supabase.from('documentos').insert(documentData).select('id').single();
    if (error) throw error;
    return data;
}

/**
 * Exclui um documento e suas assinaturas associadas.
 * @param {string} docId - O ID do documento a ser excluído.
 */
export async function deleteDocument(docId) {
    // Exclui primeiro as assinaturas (chave estrangeira)
    const { error: signError } = await supabase.from('assinaturas').delete().eq('documento_id', docId);
    if (signError) throw signError;

    // Depois exclui o documento principal
    const { error: docError } = await supabase.from('documentos').delete().eq('id', docId);
    if (docError) throw docError;
}

/**
 * Obtém a URL pública de um arquivo no Storage.
 * @param {string} path - O caminho do arquivo no bucket.
 * @returns {string}
 */
export function getPublicUrl(path) {
    const { data } = supabase.storage.from('documentos').getPublicUrl(path);
    return data.publicUrl;
}

// --- FUNÇÕES DA PÁGINA DE ASSINATURA ---

/**
 * Verifica se um documento já possui uma assinatura.
 * @param {string} docId - O ID do documento.
 * @returns {Promise<boolean>}
 */
export async function checkIfSigned(docId) {
    const { data, error } = await supabase.from('assinaturas').select('id').eq('documento_id', docId).single();
    return !!data; // Retorna true se encontrar, false se não
}

/**
 * Inicia o fluxo de login com o Google.
 */
export async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.href // Redireciona de volta para a mesma página
        }
    });
    if (error) throw error;
}

/**
 * Busca os dados de um documento específico para assinatura.
 * @param {string} docId - O ID do documento.
 * @returns {Promise<any>}
 */
export async function getDocumentForSigning(docId) {
    const { data, error } = await supabase.from('documentos').select('caminho_arquivo_storage').eq('id', docId).single();
    if (error) throw error;
    return data;
}

/**
 * Salva os dados da assinatura no banco de dados.
 * @param {object} signatureData - Os dados da assinatura.
 */
export async function saveSignature(signatureData) {
    const { error } = await supabase.from('assinaturas').insert(signatureData);
    if (error) throw error;
}

/**
 * Atualiza o status de um documento (ex: para 'assinado').
 * @param {string} docId - O ID do documento.
 * @param {string} status - O novo status.
 */
export async function updateDocumentStatus(docId, status) {
    const { error } = await supabase.from('documentos').update({ status }).eq('id', docId);
    if (error) throw error;
}

/**
 * Invoca uma Edge Function do Supabase.
 * @param {string} functionName - O nome da função.
 * @param {object} body - O corpo da requisição.
 * @returns {Promise<any>}
 */
export async function invokeEdgeFunction(functionName, body) {
    const { data, error } = await supabase.functions.invoke(functionName, { body });
    if (error) throw error;
    return data;
}
