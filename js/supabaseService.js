// js/supabaseService.js
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = self.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ... (todas as outras funções permanecem as mesmas) ...
export async function getDocuments(page, itemsPerPage, filter, searchTerm) { /* ...código como antes... */ }
export async function uploadFile(fileName, file) { /* ...código como antes... */ }
export async function createDocumentRecord(documentData) { /* ...código como antes... */ }
export async function deleteDocument(docId) { /* ...código como antes... */ }
export function getPublicUrl(path) { /* ...código como antes... */ }

// --- FUNÇÕES DA PÁGINA DE ASSINATURA ---

/**
 * Verifica se um documento já possui uma assinatura.
 * @param {string} docId - O ID do documento.
 * @returns {Promise<boolean>}
 */
export async function checkIfSigned(docId) {
    // ATUALIZADO AQUI para uma consulta mais segura
    const { data, error } = await supabase
        .from('assinaturas')
        .select('id')
        .eq('documento_id', docId)
        .limit(1) // Garante que no máximo 1 linha seja retornada
        .single();
    
    // Se der erro (ex: 406), considera como não assinado e loga o erro
    if (error && error.code !== 'PGRST116') { // PGRST116 = 'no rows returned', o que é normal
        console.error("Erro em checkIfSigned:", error);
        return false;
    }
    return !!data; // Retorna true se encontrar, false se não
}

export async function signInWithGoogle() { /* ...código como antes... */ }
export async function getDocumentForSigning(docId) { /* ...código como antes... */ }
export async function submitSignature(signatureData) { /* ...código como antes... */ }
