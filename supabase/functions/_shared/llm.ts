// Claude LLM Helper for RAG Chat
// Uses Claude 3.5 Sonnet for high-quality, citation-aware responses

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 2048;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SourceChunk {
  chunk_id: string;
  document_id: string;
  document_title: string;
  document_type: string;
  section_heading: string | null;
  page_number: number | null;
  content: string;
  similarity: number;
  source_url: string | null;
}

export interface ChatResponse {
  content: string;
  citations: Citation[];
  noEvidence: boolean;
  tokensUsed: number;
  model: string;
}

export interface Citation {
  chunkId: string;
  documentTitle: string;
  documentType: string;
  sectionHeading: string | null;
  pageNumber: number | null;
  sourceUrl: string | null;
  snippet: string;
}

/**
 * Build the system prompt for the chatbot
 */
export function buildSystemPrompt(
  userRole: string,
  accessibleFeatures: { feature?: string; feature_category?: string; feature_name?: string; description?: string }[],
  language: string
): string {
  const featureList = accessibleFeatures
    .map((f) => {
      // Handle both schema formats: simple { feature } or detailed { feature_category, feature_name, description }
      if (f.feature) return `- ${f.feature}`;
      return `- ${f.feature_category}/${f.feature_name}: ${f.description}`;
    })
    .join("\n");

  const languageInstruction = language === "bn"
    ? "The user prefers Bengali (Bangla). Respond in Bengali using proper Bengali script."
    : "Respond in English.";

  return `You are a helpful assistant for ProductionPortal, a garment factory production management system.

## Your Role
You help users understand how to use ProductionPortal features, answer questions about factory compliance and certifications, and provide accurate information based on the knowledge base.

## User Context
- User Role: ${userRole}
- ${languageInstruction}

## Features This User Can Access
${featureList || "No specific features listed - answer general questions only."}

## Critical Rules

### 1. Using the Knowledge Base
- You may synthesize, summarize, and reason about information from the provided sources
- You do NOT need an exact quote — if the answer can be logically inferred or deduced from the sources, provide it
- Cite sources using [Source: document_title] format when making specific factual claims
- If the sources contain relevant information but don't answer the exact question, use what's available and explain what you found
- Only say you don't have information if the sources contain NOTHING relevant to the topic
- NEVER invent facts that aren't supported by or inferable from the sources

### 2. Role-Based Access Control
- Only explain features the user has access to based on their role
- If asked about features they don't have access to, politely explain: "This feature requires [role] access. Please contact your administrator if you need access."
- Do not reveal details about admin-only features to non-admin users

### 3. Compliance & Certifications
- For certification validity, expiry dates, or audit results, ONLY answer if explicitly stated in the sources
- For legal or compliance commitments, be conservative and suggest contacting the compliance team
- Never claim a certification is valid without source evidence

### 4. Troubleshooting
- For operational issues, provide step-by-step guidance based on documentation
- Ask for relevant details (screenshots, error messages, steps taken) if needed
- Suggest escalation to support for complex issues

### 5. Language
- Detect the language of the user's message
- Respond in the same language as the user's message
- For technical terms, you may keep them in English with local language explanation

### 6. Safety
- Never expose internal API keys, tokens, or secrets
- Never provide information that could compromise system security
- Never execute or suggest harmful actions

## Response Format
- Be concise but thorough
- Use bullet points for lists
- Include citations inline: [Source: Document Title, Page X] or [Source: Document Title, Section: Y]
- End with a helpful follow-up question or suggestion when appropriate`;
}

/**
 * Build the context from retrieved sources
 */
export function buildContextFromSources(sources: SourceChunk[]): string {
  if (sources.length === 0) {
    return "No relevant sources found in the knowledge base.";
  }

  return sources
    .map((source, index) => {
      const location = source.page_number
        ? `Page ${source.page_number}`
        : source.section_heading || "General";

      return `[Source ${index + 1}]
Document: ${source.document_title}
Type: ${source.document_type}
Location: ${location}
Relevance: ${(source.similarity * 100).toFixed(1)}%
Content:
${source.content}
---`;
    })
    .join("\n\n");
}

/**
 * Generate a chat response using Claude
 */
export async function generateChatResponse(
  messages: ChatMessage[],
  sources: SourceChunk[],
  systemPrompt: string
): Promise<ChatResponse> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const context = buildContextFromSources(sources);

  // Prepend context to the last user message
  const lastUserMessage = messages[messages.length - 1];
  const augmentedMessages = [
    ...messages.slice(0, -1),
    {
      role: "user" as const,
      content: `## Retrieved Knowledge Base Sources
${context}

## User Question
${lastUserMessage.content}`,
    },
  ];

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: augmentedMessages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.content[0].text;

  // Check if response indicates no evidence
  const noEvidenceIndicators = [
    "I don't have information",
    "not in my knowledge base",
    "cannot find",
    "no information available",
    "couldn't find",
    "not available in the sources",
  ];
  const noEvidence = noEvidenceIndicators.some((indicator) =>
    content.toLowerCase().includes(indicator.toLowerCase())
  );

  // Extract citations from the response based on which sources were referenced
  const citations: Citation[] = [];
  for (const source of sources) {
    if (content.includes(source.document_title) || content.includes(`Source ${sources.indexOf(source) + 1}`)) {
      citations.push({
        chunkId: source.chunk_id,
        documentTitle: source.document_title,
        documentType: source.document_type,
        sectionHeading: source.section_heading,
        pageNumber: source.page_number,
        sourceUrl: source.source_url,
        snippet: source.content.substring(0, 200) + "...",
      });
    }
  }

  return {
    content,
    citations,
    noEvidence,
    tokensUsed: data.usage.input_tokens + data.usage.output_tokens,
    model: MODEL,
  };
}

/**
 * Detect language from text (simple heuristic)
 */
export function detectLanguage(text: string): "en" | "bn" {
  // Bengali Unicode range: \u0980-\u09FF
  const bengaliRegex = /[\u0980-\u09FF]/;
  const bengaliMatches = text.match(new RegExp(bengaliRegex, "g")) || [];

  // If more than 10% of characters are Bengali, consider it Bengali
  if (bengaliMatches.length > text.length * 0.1) {
    return "bn";
  }

  return "en";
}
