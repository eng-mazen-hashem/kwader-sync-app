export const getSystemPrompt = (data, company) => {
    // The Edge Function (ai-assistant) already builds a comprehensive system prompt 
    // including country, currency, timezone, and strict rules. 
    // We return empty here to save thousands of tokens on every request.
    return "";
};
