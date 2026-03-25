const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4.1-mini';

function getOpenAiApiKey() {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_OPENAI_API_KEY is not set. Please configure it in your environment variables.');
  }
  return apiKey;
}

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

function buildJsonSchema(config: ExtractionConfig) {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const col of config.columns) {
    properties[col.name] = {
      type: col.type,
      description: col.description,
    };
    required.push(col.name);
  }

  return {
    type: 'array',
    items: {
      type: 'object',
      properties,
      required,
      additionalProperties: false,
    },
  };
}

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

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getOpenAiApiKey()}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert data extraction assistant. Extract data exactly as requested. Do not hallucinate. If data is missing, return null or empty string.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
          ],
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'extracted_rows',
          schema: buildJsonSchema(config),
          strict: true,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API request failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;

  if (!text) return [];

  try {
    return JSON.parse(text) as ExtractedRow[];
  } catch (e) {
    console.error('Failed to parse JSON', text);
    return [];
  }
}
