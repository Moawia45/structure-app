/**
 * Groq AI API Service — ONLY for sketch/image recognition
 * Model: meta-llama/llama-4-scout-17b-16e-instruct
 * All calculations are done locally — no API needed for math
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

/**
 * Analyze a structural sketch image using Groq AI
 * @param {string} base64Image - Base64 encoded image data
 * @param {string} apiKey - Groq API key
 * @returns {Object} Parsed structure data (nodes, elements, loads)
 */
export async function analyzeSketch(base64Image, apiKey) {
  if (!apiKey) {
    throw new Error('Groq API key is required for sketch analysis. Please enter your API key in settings.');
  }

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are a structural engineering expert. Analyze this sketch of a beam, frame, or truss structure.

Extract and return ONLY a valid JSON object with this exact structure:
{
  "structure_type": "beam" or "frame" or "truss",
  "nodes": [
    {"id": 1, "x": 0, "y": 0, "support": "fixed|pin|roller|free"},
    ...
  ],
  "elements": [
    {"id": 1, "i": 1, "j": 2, "E": 29000, "I": 100, "A": 5},
    ...
  ],
  "loads": [
    {"id": 1, "type": "point_load|UDL|triangular_load|moment", "element_id": 1, "magnitude": 10, "direction": "down|up|left|right", "a": 5, "b": 10},
    ...
  ]
}

Rules:
- Support types: fixed, pin, roller, free
- Load types: point_load, UDL, triangular_load, moment
- For point loads on elements: set element_id and "a" (distance from near end)
- For nodal loads: set "node_id" instead of "element_id"
- For UDL: set "a" (start) and "b" (end) within element
- Use reasonable default values for E (29000 ksi), I (100 in⁴), A (5 in²)
- Estimate coordinates from the sketch proportions
- Return ONLY raw JSON, no explanation, no markdown`
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 2000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Groq API error: ${response.status} — ${errorData.error?.message || response.statusText}`
    );
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No response from AI model. Please try again.');
  }

  // Parse JSON from response (handle markdown code blocks)
  let jsonStr = content.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    const parsed = JSON.parse(jsonStr);
    validateParsedStructure(parsed);
    return parsed;
  } catch (e) {
    throw new Error(`Failed to parse AI response as JSON: ${e.message}\n\nRaw response: ${content.substring(0, 200)}`);
  }
}

/**
 * Validate the parsed structure data
 */
function validateParsedStructure(data) {
  if (!data.nodes || !Array.isArray(data.nodes) || data.nodes.length < 2) {
    throw new Error('AI response must contain at least 2 nodes.');
  }
  if (!data.elements || !Array.isArray(data.elements) || data.elements.length < 1) {
    throw new Error('AI response must contain at least 1 element.');
  }

  // Validate node references in elements
  const nodeIds = new Set(data.nodes.map(n => n.id));
  data.elements.forEach(el => {
    if (!nodeIds.has(el.i) || !nodeIds.has(el.j)) {
      throw new Error(`Element ${el.id} references non-existent node (i=${el.i}, j=${el.j})`);
    }
  });
}

/**
 * Convert a File to base64
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Conversational AI to ask questions about a structural diagram
 * @param {string} base64Image - Base64 encoded image data
 * @param {string} question - User question
 * @param {string} apiKey - Groq API key
 * @returns {string} AI Response
 */
export async function askAboutDiagram(base64Image, question, apiKey) {
  if (!apiKey) {
    throw new Error('Groq API key is required. Please enter your API key in settings.');
  }

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are a structural engineering assistant. Look at the provided structural diagram and answer the following question: ${question}`
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Groq API error: ${response.status} — ${errorData.error?.message || response.statusText}`
    );
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No response from AI model. Please try again.');
  }

  return content;
}

