const { downloadMediaMessage } = require('@whiskeysockets/baileys');

async function processVoiceNote(msg, sock, GROQ_API_KEY, companyContext = "") {
    try {
        console.log('[AudioProcessor] Downloading PTT audio buffer...');
        const buffer = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            { 
                logger: console,
                reuploadRequest: sock.updateMediaMessage
            }
        );

        if (!buffer) {
            console.warn('[AudioProcessor] Failed to download media buffer.');
            return null;
        }

        console.log(`[AudioProcessor] Audio downloaded, size: ${buffer.length} bytes. Transcribing via Groq Whisper...`);

        // Convert Buffer to a Blob for native FormData
        const blob = new Blob([buffer], { type: 'audio/ogg' });
        const formData = new FormData();
        
        // Append as a file
        formData.append('file', blob, 'voicenote.ogg');
        formData.append('model', 'whisper-large-v3-turbo');
        
        // Smart Context Prompting to reduce misheard words
        const promptContext = `تسجيل صوتي לعميل. ${companyContext} مصطلحات محتملة: كوادر، مبيعات، اشتراك، باقة، أسعار، سيستم، النظام.`;
        formData.append('prompt', promptContext);
        
        // Specify response format
        formData.append('response_format', 'json');
        formData.append('language', 'ar');

        const startTime = Date.now();
        const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: formData
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Groq STT Error ${res.status}: ${errText}`);
        }

        const data = await res.json();
        const elapsed = Date.now() - startTime;
        
        let transcribedText = data.text ? data.text.trim() : "";
        
        // --- Whisper Hallucination Filter ---
        const lowerText = transcribedText.toLowerCase();
        const hallucinations = [
            "صوتي اللعنة", 
            "ترجمة نانسي", 
            "نانسي قنقر", 
            "jónsson", 
            "subtitles by", 
            "amara.org",
            "ترجمة حصريات",
            "مترجم:",
            "أشترك بالقناة",
            "لا تنسوا الاشتراك",
            "لايك واشتراك",
            "صوتي اللعنة والفعل"
        ];
        
        const isHallucinated = hallucinations.some(h => lowerText.includes(h.toLowerCase()));
        
        // If it's a known hallucination, or very short generic noise text like just "شكرا." on silence
        if (isHallucinated || (transcribedText.length < 15 && transcribedText.includes("ترجمة"))) {
            console.warn(`[AudioProcessor] ⚠️ Whisper hallucination detected & blocked: "${transcribedText}"`);
            transcribedText = "";
        }

        console.log(`[AudioProcessor] 🎤 Transcribed in ${elapsed}ms: "${transcribedText}"`);
        
        return transcribedText;

    } catch (err) {
        console.error('[AudioProcessor] Error transcribing voice note:', err.message);
        return null;
    }
}

module.exports = { processVoiceNote };
