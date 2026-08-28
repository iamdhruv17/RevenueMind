export interface MessageGenerationInput {
  customerName: string;
  preferredLanguage: string;
  actionType: string;
  predictedReason: string;
  amountAtRisk: number;
  cost: number;
  sourceType: string;
}

export async function generateRecoveryMessage(input: MessageGenerationInput): Promise<string> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set.");
    }

    const systemPrompt = `You are a helpful, empathetic customer success agent for an online business.
Your goal is to write a short 2-3 sentence recovery message for a customer.
Rules:
- Tone: warm and non-pushy, never sounding like spam.
- Language/Style:
  - 'en' = plain English
  - 'hi' = Hindi (Devanagari script)
  - 'hinglish' = Hindi written in Roman script mixed naturally with English, the way Indian customers actually text.
- Match language to the provided preferredLanguage: "${input.preferredLanguage}".
- Tailor content to the actionType:
  - 'retry': mention a technical/payment issue, invite them to retry with their order still held.
  - 'reminder': a gentle nudge about a pending payment, no pressure.
  - 'discount_5' / 'discount_10': mention the specific discount percentage (5% or 10%) as a limited-time offer to complete their order.
  - 'waiver': mention the late fee has been waived and invite them to complete payment of the principal amount.
- Reference the amount (₹${input.amountAtRisk}) where natural.
- Output ONLY valid JSON in the format: {"message": "your generated message here"}
- Do not include markdown code fences or any other text.`;

    const userPrompt = `Generate a message for:
Customer Name: ${input.customerName}
Action Type: ${input.actionType}
Predicted Reason: ${input.predictedReason}
Amount At Risk: ₹${input.amountAtRisk}
Cost (Discount/Waiver amount): ₹${input.cost}
Source Type: ${input.sourceType}
Preferred Language: ${input.preferredLanguage}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: systemPrompt + "\n\n" + userPrompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API returned status ${response.status}`);
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
      throw new Error("No text content returned from Gemini API");
    }

    let parsed;
    try {
      parsed = JSON.parse(textContent);
    } catch (err) {
      // Try stripping markdown fences just in case responseMimeType failed
      const stripped = textContent.replace(/^\s*```(json)?\s*/i, '').replace(/\s*```\s*$/, '');
      parsed = JSON.parse(stripped);
    }

    if (!parsed.message) {
      throw new Error("JSON response missing 'message' field");
    }

    return parsed.message;
  } catch (error) {
    console.error("Message generation failed:", error);
    
    // Safe generic fallback message based on language
    if (input.preferredLanguage === 'hi') {
      return `नमस्ते ${input.customerName}, आपका ₹${input.amountAtRisk} का भुगतान बाकी है। कृपया इसे जल्द से जल्द पूरा करें।`;
    } else if (input.preferredLanguage === 'hinglish') {
      return `Hi ${input.customerName}, aapka ₹${input.amountAtRisk} ka payment pending hai. Please complete it soon.`;
    } else {
      return `Hi ${input.customerName}, your payment of ₹${input.amountAtRisk} is pending. Please complete it at your earliest convenience.`;
    }
  }
}
