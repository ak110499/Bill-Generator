import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ColumnConfig {
  name: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
}

export interface ExtractionConfig {
  columns: ColumnConfig[];
  additionalInstructions: string;
}

export type ExtractedRow = Record<string, any>;

export const DEFAULT_CONFIG: ExtractionConfig = {
  columns: [
    { name: 'grNo', type: 'string', description: 'GR Number' },
    { name: 'date', type: 'string', description: 'Date in DD/MM/YYYY format' },
    { name: 'vehicleNo', type: 'string', description: 'Vehicle Number (e.g., HR69E1046)' },
    { name: 'stationTo', type: 'string', description: 'Destination Station (e.g., KOSLI, REWARI)' },
    { name: 'deliveryDate', type: 'string', description: 'Delivery Date in DD/MM/YYYY format' },
    { name: 'consigneeName', type: 'string', description: 'Consignee Name (e.g., RELIANCE RETAIL)' },
    { name: 'invoiceNo', type: 'string', description: 'Invoice Number (e.g., 10-digit number)' },
    { name: 'quantity', type: 'number', description: 'Quantity (standalone number)' }
  ],
  additionalInstructions: `1. Multi-Entry Rows: Some rows list multiple GR numbers (e.g., 10747140, 10747142). You MUST create a separate JSON object for EVERY individual GR number, repeating the date, vehicle info, and other shared details for each.
2. Vehicle No & Station To: In the source, these might be visually merged or wrapped. Separate the alphanumeric vehicle codes into "vehicleNo" and the destination names into "stationTo".
3. Consignee & Invoice: Split the "Consignee Name" from the "Invoice No". Put them in "consigneeName" and "invoiceNo" respectively.
4. Quantity: This should always be a standalone number.
5. Formatting: Standardize all dates to DD/MM/YYYY format.
6. Ignore Footer: Ensure no data from the "Scanned with OKEN Scanner" footer is included.`
};

export async function processPage(base64Image: string, config: ExtractionConfig = DEFAULT_CONFIG): Promise<ExtractedRow[]> {
  const columnsPrompt = config.columns
    .map(c => `- ${c.name} (${c.type}): ${c.description}`)
    .join('\n');

  const prompt = `
You are an expert data extraction assistant. I am providing an image of a document (likely a logistics/transportation log or similar table).
Extract all the relevant data from the tables and return a JSON array of objects. Each object should represent a single row.

Columns to extract:
${columnsPrompt}

Additional Instructions:
${config.additionalInstructions}

Return ONLY the JSON array.
  `;

  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const col of config.columns) {
    let type = Type.STRING;
    if (col.type === 'number') type = Type.NUMBER;
    else if (col.type === 'boolean') type = Type.BOOLEAN;

    properties[col.name] = { type, description: col.description };
    required.push(col.name);
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image,
          },
        },
        { text: prompt },
      ],
    },
    config: {
      systemInstruction: "You are an expert data extraction assistant. Your task is to extract data from the provided image exactly as requested. You must strictly adhere to the provided JSON schema and instructions. Do not hallucinate data. If a field is missing, leave it empty or null. Be highly accurate.",
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties,
          required,
        },
      },
      temperature: 0,
    },
  });

  const text = response.text;
  if (!text) return [];
  try {
    return JSON.parse(text) as ExtractedRow[];
  } catch (e) {
    console.error('Failed to parse JSON', text);
    return [];
  }
}
