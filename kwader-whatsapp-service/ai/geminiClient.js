/**
 * ============================================================
 * KWADER AI Engine - Gemini Flash Ultra-Light Client
 * ============================================================
 * Uses Node.js native fetch — zero external dependencies,
 * zero bloat, and fraction-of-a-cent / free-tier execution.
 */

const CANDIDATE_MODELS = [
    'gemini-flash-lite-latest',
    'gemini-3.5-flash-lite',
    'gemini-flash-latest',
    'gemini-3.5-flash'
];

const DEFAULT_GEMINI_KEY = Buffer.from('QVEuQWI4Uk42STRBbFI0RFlmSS1oMUtib2hqVG1hbW91YU9pb3NaV1BLeXB0TGZzc01KSWc=', 'base64').toString('utf8');
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || DEFAULT_GEMINI_KEY;

/**
 * Call Gemini Flash API with optional Tools (Function Calling) and automatic multi-model fallback
 * @param {Object} params
 * @param {string} params.systemInstruction
 * @param {Array<{role: string, parts: Array<{text: string}>}>} params.contents
 * @param {Array<Object>} [params.tools]
 * @param {string} [params.apiKey]
 * @param {string} [params.modelName]
 * @returns {Promise<{text: string, functionCalls: Array<Object>, tokensUsed: number}>}
 */
async function callGemini({ systemInstruction, contents, tools = [], apiKey, modelName }) {
    const key = apiKey || process.env.GEMINI_API_KEY || DEFAULT_GEMINI_KEY;
    if (!key) {
        throw new Error('GEMINI_API_KEY is not configured.');
    }

    const requestedModel = modelName || process.env.GEMINI_MODEL || 'gemini-flash-latest';
    const modelsToTry = [requestedModel, ...CANDIDATE_MODELS.filter(m => m !== requestedModel)];

    let lastError = null;

    for (const model of modelsToTry) {
        try {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

            const requestBody = {
                systemInstruction: systemInstruction ? {
                    parts: [{ text: systemInstruction }]
                } : undefined,
                contents: contents,
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2500,
                    topP: 0.9,
                }
            };

            if (tools && tools.length > 0) {
                requestBody.tools = [{
                    functionDeclarations: tools
                }];
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Gemini API error [${response.status}] on ${model}: ${errText}`);
            }

            const data = await response.json();
            const candidate = data.candidates?.[0];
            const parts = candidate?.content?.parts || [];

            let textResponse = '';
            const functionCalls = [];

            for (const part of parts) {
                if (part.text) {
                    textResponse += part.text;
                }
                if (part.functionCall) {
                    functionCalls.push(part.functionCall);
                }
            }

            const tokensUsed = data.usageMetadata?.totalTokenCount || 0;

            return {
                text: textResponse.trim(),
                functionCalls,
                tokensUsed
            };
        } catch (err) {
            console.warn(`⚠️ [GeminiClient] Model ${model} failed, trying next candidate. Error: ${err.message}`);
            lastError = err;
            // Continue loop to try next model in CANDIDATE_MODELS
        }
    }

    throw lastError || new Error('All Gemini candidate models failed.');
}

module.exports = {
    callGemini,
    GEMINI_MODEL
};
