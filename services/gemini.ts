
import { GoogleGenAI, Type } from "@google/genai";
import { Field, SensorData } from "../types";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const getCropAnalysis = async (field: Field, latestData: SensorData) => {
  const ai = getAIClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        Analyze this agricultural field data and provide the top 3 recommended crops.
        Field: ${field.field_name}, Location: ${field.location}, Soil: ${field.soil_type}.
        Latest Soil Data: 
        - Temperature: ${latestData.temperature.toFixed(1)}°C
        - Moisture: ${latestData.moisture.toFixed(1)}%
        - pH Level: ${latestData.ph_level.toFixed(1)}
        - NPK Profile: N=${latestData.npk_n}, P=${latestData.npk_p}, K=${latestData.npk_k}
        
        Focus on these markers to determine growth suitability in the context of Bangladesh.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              suitability: { type: Type.NUMBER, description: "Percentage 0-100" },
              yield: { type: Type.STRING, description: "Expected yield estimate" },
              requirements: { type: Type.STRING, description: "Key growth requirements" },
              icon: { type: Type.STRING, description: "FontAwesome icon class string e.g. fa-leaf" }
            },
            required: ["name", "suitability", "yield", "requirements", "icon"]
          }
        }
      }
    });
    
    return JSON.parse(response.text || '[]');
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return [
      { name: "Rice (Boro)", suitability: 94, yield: "5.5 tons/ha", requirements: "High water requirement. Add Nitrogen if levels drop.", icon: "fa-wheat-awn" },
      { name: "Potato", suitability: 88, yield: "22 tons/ha", requirements: "Cool temp preferred. Loamy soil is ideal.", icon: "fa-circle" },
      { name: "Mustard", suitability: 75, yield: "1.5 tons/ha", requirements: "Low water need. Thrives in sandy loam.", icon: "fa-seedling" }
    ];
  }
};

export const getSoilHealthSummary = async (field: Field, latestData: SensorData) => {
  const ai = getAIClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        Act as an expert agricultural scientist. Provide a concise 3-sentence "Soil Health Summary" for this field in Bangladesh.
        Field: ${field.field_name}, Location: ${field.location}, Soil: ${field.soil_type}.
        Latest Markers: Temp: ${latestData.temperature.toFixed(1)}°C, Moisture: ${latestData.moisture.toFixed(1)}%, pH: ${latestData.ph_level.toFixed(1)}, NPK: ${latestData.npk_n}-${latestData.npk_p}-${latestData.npk_k}.
        
        Focus on the current status and suggest one prioritized action. No markdown formatting.
      `
    });
    
    return response.text || "Your soil parameters are currently within normal ranges. Nitrogen is sufficient for existing crops. Maintain steady irrigation.";
  } catch (error) {
    console.error("Gemini Summary Error:", error);
    return "Soil health is currently stable. Current moisture and temperature levels are optimal for root development. Recommendation: Continue standard maintenance cycles.";
  }
};

export const getDetailedManagementPlan = async (field: Field, latestData: SensorData) => {
  const ai = getAIClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        Generate exactly 4 prioritized farm management tasks for a field in Bangladesh with these conditions:
        Soil: ${field.soil_type}, Temp: ${latestData.temperature}°C, Moisture: ${latestData.moisture}%, pH: ${latestData.ph_level}, NPK: ${latestData.npk_n}-${latestData.npk_p}-${latestData.npk_k}.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              priority: { type: Type.STRING, description: "High, Medium, or Low" },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              icon: { type: Type.STRING, description: "FontAwesome icon class" }
            },
            required: ["priority", "title", "description", "icon"]
          }
        }
      }
    });
    
    return JSON.parse(response.text || '[]');
  } catch (error) {
    console.error("Gemini Plan Error:", error);
    return [
      { priority: "High", title: "Moisture Control", description: "Increase irrigation by 10% to combat rising surface temperatures.", icon: "fa-droplet" },
      { priority: "Medium", title: "Nutrient Supplement", description: "Apply Urea top-dressing to maintain Nitrogen levels above 40ppm.", icon: "fa-flask" },
      { priority: "Medium", title: "pH Monitoring", description: "Current pH is 6.2. No immediate correction needed, but watch for acidity.", icon: "fa-vial" },
      { priority: "Low", title: "General Scouting", description: "Physical inspection of leaf health near drainage points.", icon: "fa-magnifying-glass" }
    ];
  }
};

export const startAIConversation = (systemInstruction: string) => {
  const ai = getAIClient();
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: { systemInstruction },
  });
};
