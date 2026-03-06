import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzeSpendingTrends(claims: any[]) {
  const prompt = `Analyze the following reimbursement claims and provide a strategic summary for the CEO. 
  Focus on identifying high-spend areas, potential optimizations, and any unusual patterns.
  
  Claims Data: ${JSON.stringify(claims)}
  
  Provide the response in a professional, highly structured Markdown format:
  - Use clear headings (###)
  - Use bullet points for key findings
  - Use bold text for emphasis
  - Add spacing between paragraphs
  - Keep it concise and to the point. No conversational filler.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Failed to generate AI insights.";
  }
}

export async function suggestCategory(reason: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Based on this reimbursement reason: "${reason}", suggest the most appropriate category from this list: Marketing, Operations, Travel, Food & Beverage, Office Supplies, Miscellaneous. Return ONLY the category name.`,
    });
    return response.text?.trim();
  } catch (error) {
    return "Miscellaneous";
  }
}
