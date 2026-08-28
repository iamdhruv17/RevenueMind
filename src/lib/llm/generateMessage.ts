export interface MessageGenerationInput {
  customerName: string;
  preferredLanguage: string;
  actionType: string;
  predictedReason: string;
  amountAtRisk: number;
  cost: number;
  sourceType: string;
}

const FALLBACK_TEMPLATES: Record<string, Record<string, (name: string, amt: number, cost: number) => string>> = {
  reminder: {
    en: (name, amt) => `Hi ${name}, this is a gentle reminder regarding your pending payment of ₹${amt}. Please complete it at your earliest convenience.`,
    hi: (name, amt) => `नमस्ते ${name}, आपके ₹${amt} के बकाया भुगतान का यह एक अनुस्मारक है। कृपया इसे जल्द से जल्द पूरा करें।`,
    hinglish: (name, amt) => `Hi ${name}, aapke ₹${amt} ke pending payment ka ek gentle reminder hai. Please ise complete kar lein.`,
  },
  retry: {
    en: (name, amt) => `Hi ${name}, we encountered a temporary issue processing your payment of ₹${amt}. Your order is held—please retry to complete your purchase.`,
    hi: (name, amt) => `नमस्ते ${name}, आपके ₹${amt} के भुगतान में तकनीकी समस्या आई थी। आपका ऑर्डर सुरक्षित है—कृपया पुनः प्रयास करें।`,
    hinglish: (name, amt) => `Hi ${name}, aapke ₹${amt} ke payment me technical issue aaya tha. Order reserved hai—please retry karke complete karein.`,
  },
  discount_5: {
    en: (name, amt) => `Hi ${name}, we've added a special 5% discount to your pending order of ₹${amt}. Complete your checkout today!`,
    hi: (name, amt) => `नमस्ते ${name}, आपके ₹${amt} के ऑर्डर पर 5% की विशेष छूट जोड़ी गई है। कृपया आज ही अपना चेकआउट पूरा करें!`,
    hinglish: (name, amt) => `Hi ${name}, aapke ₹${amt} ke order par 5% special discount add kiya gaya hai. Aaj hi apna checkout complete karein!`,
  },
  discount_10: {
    en: (name, amt) => `Hi ${name}, we've added a special 10% discount to your pending order of ₹${amt}. Complete your checkout today!`,
    hi: (name, amt) => `नमस्ते ${name}, आपके ₹${amt} के ऑर्डर पर 10% की विशेष छूट जोड़ी गई है। कृपया आज ही अपना चेकआउट पूरा करें!`,
    hinglish: (name, amt) => `Hi ${name}, aapke ₹${amt} ke order par 10% special discount add kiya gaya hai. Aaj hi apna checkout complete karein!`,
  },
  waiver: {
    en: (name, amt, cost) => `Hi ${name}, your late fee of ₹${cost} has been waived for your overdue invoice of ₹${amt}. Please complete payment of the principal amount.`,
    hi: (name, amt, cost) => `नमस्ते ${name}, आपके ₹${amt} के चालान पर ₹${cost} का विलंब शुल्क माफ कर दिया गया है। कृपया मूल राशि का भुगतान पूरा करें।`,
    hinglish: (name, amt, cost) => `Hi ${name}, aapke ₹${amt} ke overdue invoice par ₹${cost} ka late fee waive kar diya gaya hai. Please principal amount pay kar dein.`,
  },
};

export function getFallbackMessage(input: MessageGenerationInput): string {
  const lang = ['en', 'hi', 'hinglish'].includes(input.preferredLanguage) ? input.preferredLanguage : 'en';
  const action = FALLBACK_TEMPLATES[input.actionType] ? input.actionType : 'reminder';
  const templateFn = FALLBACK_TEMPLATES[action][lang] || FALLBACK_TEMPLATES[action]['en'];
  return templateFn(input.customerName, input.amountAtRisk, input.cost);
}

export async function generateRecoveryMessage(input: MessageGenerationInput): Promise<string> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set.");
    }

    const systemPrompt = `You are an empathetic, professional customer success agent for an online business.
Your goal is to write a short 2-3 sentence personalized recovery message for a customer.

Tone and Style:
- Warm, polite, and non-pushy. Never sound like spam or aggressive collections.
- Target language: "${input.preferredLanguage}"
  - 'en' = Natural, clear English.
  - 'hi' = Hindi in Devanagari script.
  - 'hinglish' = Hindi written in Roman script mixed naturally with English, the way Indian customers text.

Action-specific Guidelines:
- 'retry': Mention a payment or technical issue occurred during checkout/transaction, reassure them their order is held, and invite them to retry payment of ₹${input.amountAtRisk}.
- 'reminder': A gentle nudge about their pending payment of ₹${input.amountAtRisk}, without pressure.
- 'discount_5' / 'discount_10': Mention a limited-time 5% or 10% discount on their cart/order of ₹${input.amountAtRisk} to help them complete their purchase.
- 'waiver': Specifically for overdue invoices with late fees. Explain that we understand cash flow challenges and have waived the late fee of ₹${input.cost} as a courtesy. Invite them to clear the principal invoice amount of ₹${input.amountAtRisk}. Do NOT mention technical glitches or payment gateway errors for waivers.

Context Provided:
- Source Type: ${input.sourceType}
- Root Cause / Predicted Reason: ${input.predictedReason}
- Amount: ₹${input.amountAtRisk}
- Cost (Discount or Late Fee Waived): ₹${input.cost}

Output format:
- Output ONLY valid JSON in the format: {"message": "your message text here"}
- Do not include markdown code fences, headers, or any other text.`;

    const userPrompt = `Write a recovery message with:
Customer Name: ${input.customerName}
Action Type: ${input.actionType}
Source Type: ${input.sourceType}
Predicted Reason: ${input.predictedReason}
Amount At Risk: ₹${input.amountAtRisk}
Cost / Concession Amount: ₹${input.cost}
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
      const stripped = textContent.replace(/^\s*```(json)?\s*/i, '').replace(/\s*```\s*$/, '');
      parsed = JSON.parse(stripped);
    }

    if (!parsed.message) {
      throw new Error("JSON response missing 'message' field");
    }

    return parsed.message;
  } catch (error) {
    console.error("Message generation failed, using action-specific fallback:", error);
    return getFallbackMessage(input);
  }
}
