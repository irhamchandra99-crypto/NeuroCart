// =============================================================================
// verify-quality.js — Chainlink Functions DON Source Code
//
// File ini dijalankan oleh Chainlink DON (Decentralized Oracle Network)
// di environment terisolasi (sandbox) pada setiap node.
//
// Input (args):
//   args[0] = result    — hasil pekerjaan AI agent (string)
//   args[1] = jobType   — tipe task: "summarization", "translation", dll
//
// Output:
//   uint256 — skor kualitas 0-100
//   Jika skor >= 80: payment direlease ke agent
//   Jika skor < 80 : ETH/USDC direfund ke client + stake agent di-slash
//
// Secrets (diset via Chainlink Functions UI, tidak ada di kode):
//   secrets.CLAUDE_API_KEY — Anthropic API key
//
// Deploy source ini:
//   1. Buka https://functions.chain.link
//   2. Buat subscription, fund dengan LINK
//   3. Panggil NeuroCartFunctions.setSource() dengan isi file ini
// =============================================================================

const agentResult = args[0];
const jobType = args[1] || "general";

// Batas panjang karakter agar tidak melebihi limit DON
const MAX_RESULT_LENGTH = 2000;
const truncatedResult = agentResult.length > MAX_RESULT_LENGTH
  ? agentResult.substring(0, MAX_RESULT_LENGTH) + "..."
  : agentResult;

// Buat prompt yang sesuai dengan tipe job
const prompts = {
  summarization: `You are a quality evaluator for AI-generated summaries.
Rate the quality of this summary from 0 to 100 based on:
- Coherence and clarity (25 points)
- Completeness of key information (25 points)
- Conciseness (25 points)
- Grammar and language quality (25 points)

Output ONLY a single integer number from 0 to 100. No explanation.

Summary to evaluate:
${truncatedResult}`,

  translation: `You are a quality evaluator for AI-generated translations.
Rate the quality of this translation from 0 to 100 based on:
- Accuracy of meaning (30 points)
- Natural language flow (25 points)
- Grammar correctness (25 points)
- Cultural appropriateness (20 points)

Output ONLY a single integer number from 0 to 100. No explanation.

Translation to evaluate:
${truncatedResult}`,

  transcription: `You are a quality evaluator for AI-generated transcriptions.
Rate the quality of this transcription from 0 to 100 based on:
- Completeness (30 points)
- Accuracy (30 points)
- Proper formatting (20 points)
- Readability (20 points)

Output ONLY a single integer number from 0 to 100. No explanation.

Transcription to evaluate:
${truncatedResult}`,

  general: `You are an AI output quality evaluator.
Rate the quality of this AI-generated output from 0 to 100 based on:
- Relevance and usefulness (30 points)
- Accuracy and correctness (30 points)
- Clarity and coherence (20 points)
- Completeness (20 points)

Output ONLY a single integer number from 0 to 100. No explanation.

Output to evaluate:
${truncatedResult}`
};

const prompt = prompts[jobType] || prompts.general;

// Panggil Anthropic Claude API untuk evaluasi kualitas
const response = await Functions.makeHttpRequest({
  url: "https://api.anthropic.com/v1/messages",
  method: "POST",
  headers: {
    "x-api-key": secrets.CLAUDE_API_KEY,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json"
  },
  data: {
    model: "claude-haiku-4-5-20251001",
    max_tokens: 10,
    messages: [
      {
        role: "user",
        content: prompt
      }
    ]
  },
  timeout: 9000  // 9 detik (DON timeout 10 detik)
});

// Handle error dari API
if (response.error) {
  throw new Error(`Claude API error: ${response.error}`);
}

if (!response.data || !response.data.content || !response.data.content[0]) {
  throw new Error("Response tidak valid dari Claude API");
}

// Parse skor dari response
const scoreText = response.data.content[0].text.trim();
const score = parseInt(scoreText, 10);

// Validasi skor
if (isNaN(score) || score < 0 || score > 100) {
  // Jika parsing gagal, gunakan score rendah (safe default)
  console.log(`Warning: Score parsing gagal dari "${scoreText}", default ke 0`);
  return Functions.encodeUint256(0);
}

console.log(`Job type: ${jobType} | Score: ${score}/100`);

// Return skor sebagai uint256 (yang akan di-decode oleh fulfillRequest)
return Functions.encodeUint256(score);
