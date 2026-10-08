const { downloadMediaMessage } = require('@whiskeysockets/baileys');

async function processImageMessage(msg, sock, GROQ_API_KEY, companyContext = "") {
    try {
        console.log('[ImageProcessor] Downloading image buffer...');
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
            console.warn('[ImageProcessor] Failed to download media buffer.');
            return null;
        }

        const base64Image = buffer.toString('base64');
        const mimeType = msg.message?.imageMessage?.mimetype || 'image/jpeg';
        const caption = msg.message?.imageMessage?.caption || '';

        console.log(`[ImageProcessor] Image downloaded, size: ${buffer.length} bytes. Parsing via Groq Vision...`);

        // Smart Context Prompting
        const promptContext = `أنت مساعد ذكي للنظام. هذه صورة أرسلها عميل. 
وصف الشركة: ${companyContext}
رسالة العميل المرفقة مع الصورة: "${caption}"
مهمتك:
1. قم بوصف كافة التفاصيل الدقيقة التي تراها في الصورة (مثل الألوان، الماركات، الأسعار، الموديلات، الأرقام، النصوص المكتوبة، وأي رموز بارزة).
2. استخرج أي نصوص بشكل حرفي (خاصة الفواتير، المنتجات، أو رسائل الخطأ التقنية).
3. اكتب الوصف لزميلك (مستشار المبيعات) ليفهم الصورة بنسبة 100% دون أن يراها، حتى لو سأله العميل عن تفاصيل دقيقة لاحقاً.`;

        const payload = {
            model: "llama-3.2-11b-vision-preview",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: promptContext },
                        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } }
                    ]
                }
            ],
            temperature: 0.2
        };

        const startTime = Date.now();
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Groq Vision Error ${res.status}: ${errText}`);
        }

        const data = await res.json();
        const elapsed = Date.now() - startTime;
        
        const visionText = data.choices[0]?.message?.content?.trim() || "";
        console.log(`[ImageProcessor] 👁️ Parsed in ${elapsed}ms: "${visionText}"`);
        
        let finalText = `[أرسل العميل صورة. التحليل الدقيق للصورة: ${visionText}]`;
        if (caption) {
            finalText = caption + "\n\n" + finalText;
        }

        return finalText;

    } catch (err) {
        console.error('[ImageProcessor] Error parsing image:', err.message);
        return null;
    }
}

module.exports = { processImageMessage };
