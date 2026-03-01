/**
 * NeuroCart CRE Workflow — AI Quality Verification Orchestration
 * ==============================================================
 * Chainlink Runtime Environment (CRE) Workflow
 * Track: CRE & AI — Chainlink Convergence Hackathon 2026
 *
 * This workflow serves as the orchestration layer for NeuroCart's
 * trustless AI quality verification system.
 *
 * Flow:
 *   [TRIGGER] Cron every 1 minute
 *       ↓
 *   [EVM READ] JobEscrow.getVerifyingJobIds() → pending job IDs
 *       ↓
 *   [EVM READ] JobEscrow.jobs(jobId) → resultData + jobDescription
 *       ↓
 *   [HTTP] Claude API → quality score 0-100
 *       ↓
 *   [EVM WRITE] NeuroCartFunctions.receiveCREScore(jobId, score)
 *       → finalizeVerification() → release/refund escrow
 *
 * Why CRE over Chainlink Functions alone:
 *   - CRE is the orchestration layer: reads chain state, calls LLM,
 *     writes result — as a composable, multi-step DON workflow
 *   - Functions handles single HTTP calls; CRE handles full workflows
 *   - CRE enables autonomous AI agent orchestration at scale
 */

import { cre, Runner } from "@chainlink/cre-sdk";
import { z } from "zod";

// ─── Configuration Schema ────────────────────────────────────────────────────
// Validated at runtime. Secrets (anthropicApiKey) injected via CRE secrets manager.

const Config = z.object({
  /** Cron schedule for verification polling */
  schedule: z.string().default("*/1 * * * *"),

  /** JobEscrow contract address on Arbitrum Sepolia */
  jobEscrowAddress: z.string().startsWith("0x"),

  /** NeuroCartFunctions contract address */
  functionsAddress: z.string().startsWith("0x"),

  /** Arbitrum Sepolia chain ID */
  chainId: z.number().int().positive().default(421614),

  /** CCIP chain selector for Arbitrum Sepolia */
  chainSelector: z.string().default("3478487238524512106"),

  /** Quality threshold for payment release (matches contract: 80) */
  qualityThreshold: z.number().int().min(0).max(100).default(80),

  /** Max jobs to process per cron run (prevent gas spikes) */
  maxJobsPerRun: z.number().int().positive().max(10).default(5),

  /** Claude model for quality scoring */
  anthropicModel: z.string().default("claude-haiku-4-5-20251001"),

  /** Anthropic API key — injected via CRE secrets, never in config.json */
  anthropicApiKey: z.string(),
});

type WorkflowConfig = z.infer<typeof Config>;

// ─── Type Definitions ────────────────────────────────────────────────────────

interface JobData {
  jobId: bigint;
  resultData: string;
  jobDescription: string;
  jobType: string;
  status: number;
}

interface VerificationResult {
  jobId: string;
  score: number;
  passed: boolean;
  txHash?: string;
}

// ─── Step 1: Read VERIFYING jobs from JobEscrow ──────────────────────────────

async function getVerifyingJobs(
  evmClient: ReturnType<typeof cre.newEVMClient>,
  config: WorkflowConfig
): Promise<bigint[]> {
  const result = await evmClient
    .read({
      address: config.jobEscrowAddress as `0x${string}`,
      // getVerifyingJobIds() → uint256[]
      fn: "getVerifyingJobIds()(uint256[])",
      args: [],
    })
    .result();

  if (!result || !Array.isArray(result)) return [];
  return (result as bigint[]).slice(0, config.maxJobsPerRun);
}

// ─── Step 2: Read job details from JobEscrow ─────────────────────────────────

async function getJobDetails(
  evmClient: ReturnType<typeof cre.newEVMClient>,
  config: WorkflowConfig,
  jobId: bigint
): Promise<JobData | null> {
  try {
    // jobs(uint256) returns the full Job struct (14 fields):
    // jobId, clientAgent, providerAgent, registryAgentId, payment, paymentToken,
    // resultData(6), jobDescription(7), jobType(8), status(9), createdAt, deadline,
    // verificationRequestId, qualityScore
    const jobArr = await evmClient
      .read({
        address: config.jobEscrowAddress as `0x${string}`,
        fn: "jobs(uint256)(uint256,address,address,uint256,uint256,uint8,string,string,string,uint8,uint256,uint256,bytes32,uint8)",
        args: [jobId],
      })
      .result();

    if (!jobArr || !Array.isArray(jobArr)) return null;

    const resultData = jobArr[6] as string;
    const jobDescription = jobArr[7] as string;
    const jobType = jobArr[8] as string;
    const status = Number(jobArr[9]);

    if (!resultData || !jobDescription) return null;

    return { jobId, resultData, jobDescription, jobType, status };
  } catch {
    return null;
  }
}

// ─── Step 3: Score quality via Claude API ────────────────────────────────────

async function scoreWithClaude(
  httpClient: ReturnType<typeof cre.newHTTPClient>,
  config: WorkflowConfig,
  job: JobData
): Promise<number> {
  const prompt = [
    "Score this AI summarization quality from 0 to 100.",
    "Return ONLY a number, nothing else.",
    "",
    `Original task: ${job.jobDescription.slice(0, 500)}`,
    "",
    `AI output: ${job.resultData.slice(0, 1000)}`,
  ].join("\n");

  const response = await httpClient
    .fetch({
      url: "https://api.anthropic.com/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.anthropicModel,
        max_tokens: 10,
        messages: [{ role: "user", content: prompt }],
      }),
    })
    .result();

  if (!response || response.statusCode !== 200) {
    throw new Error(`Claude API error: status ${response?.statusCode}`);
  }

  const body = JSON.parse(response.body ?? "{}");
  const scoreText = body?.content?.[0]?.text?.trim() ?? "0";
  const score = parseInt(scoreText, 10);

  if (isNaN(score) || score < 0 || score > 100) {
    throw new Error(`Invalid score from Claude: "${scoreText}"`);
  }

  return score;
}

// ─── Step 4: Submit score on-chain ───────────────────────────────────────────

async function submitScoreOnChain(
  evmClient: ReturnType<typeof cre.newEVMClient>,
  config: WorkflowConfig,
  jobId: bigint,
  score: number
): Promise<string> {
  // NeuroCartFunctions.receiveCREScore(jobId, score)
  // → checks score >= QUALITY_THRESHOLD (80)
  // → calls JobEscrow.finalizeVerification(jobId, passed, score)
  // → releases ETH to provider OR refunds client + slashes stake
  const txResult = await evmClient
    .write({
      address: config.functionsAddress as `0x${string}`,
      fn: "receiveCREScore(uint256,uint8)",
      args: [jobId, BigInt(score)],
    })
    .result();

  return (txResult as { hash?: string })?.hash ?? "0x";
}

// ─── Main Workflow Handler ────────────────────────────────────────────────────

const onCronTrigger = cre.handler(
  { type: "cron" },
  async (
    _trigger: unknown,
    runtime: Parameters<Parameters<typeof cre.handler>[1]>[1],
    config: WorkflowConfig
  ) => {
    const evmClient = cre.newEVMClient(runtime, { chainId: config.chainId });
    const httpClient = cre.newHTTPClient(runtime);

    // ── Step 1: Find VERIFYING jobs ───────────────────────────────────────
    const verifyingIds = await getVerifyingJobs(evmClient, config);

    if (verifyingIds.length === 0) {
      return { status: "idle", verified: 0, timestamp: new Date().toISOString() };
    }

    // ── Step 2–4: Process each job ────────────────────────────────────────
    const results: VerificationResult[] = [];

    for (const jobId of verifyingIds) {
      try {
        // Read job details from chain
        const job = await getJobDetails(evmClient, config, jobId);
        if (!job) continue;

        // Score with Claude API (off-chain, via CRE HTTP capability)
        const score = await scoreWithClaude(httpClient, config, job);
        const passed = score >= config.qualityThreshold;

        // Write score back on-chain (via CRE EVM write capability)
        const txHash = await submitScoreOnChain(evmClient, config, jobId, score);

        results.push({
          jobId: jobId.toString(),
          score,
          passed,
          txHash,
        });
      } catch (err) {
        // Log error but continue processing other jobs
        results.push({
          jobId: jobId.toString(),
          score: 0,
          passed: false,
          txHash: undefined,
        });
      }
    }

    const verified = results.filter((r) => r.txHash).length;

    return {
      status: "success",
      verified,
      results,
      timestamp: new Date().toISOString(),
    };
  }
);

// ─── Workflow Initialization ─────────────────────────────────────────────────

function initWorkflow(config: WorkflowConfig) {
  const cronTrigger = cre.triggers.cron({ schedule: config.schedule });
  return cronTrigger.on(onCronTrigger);
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

async function main() {
  const runner = Runner.newRunner<WorkflowConfig>(Config);
  await runner.run(initWorkflow);
}

main().catch(console.error);
