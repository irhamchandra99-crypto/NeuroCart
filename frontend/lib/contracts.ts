// Contract addresses — update after deployment
// Create frontend/.env.local:
//   NEXT_PUBLIC_REGISTRY_ADDRESS=0x...
//   NEXT_PUBLIC_ESCROW_ADDRESS=0x...

export const REGISTRY_ADDRESS = (
  process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || ""
) as `0x${string}` | "";

export const ESCROW_ADDRESS = (
  process.env.NEXT_PUBLIC_ESCROW_ADDRESS || ""
) as `0x${string}` | "";

export const HAS_CONTRACTS = !!REGISTRY_ADDRESS && !!ESCROW_ADDRESS;

// ======================================================
// AgentRegistry ABI (minimal — functions we need)
// agents() returns 11 fields (string[] skills excluded from getter)
// ======================================================
export const AGENT_REGISTRY_ABI = [
  {
    name: "agentCount",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "agents",
    type: "function",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "owner",           type: "address"  },
      { name: "name",            type: "string"   },
      { name: "endpoint",        type: "string"   },
      { name: "metadataURI",     type: "string"   },
      { name: "isActive",        type: "bool"     },
      { name: "priceUSDCents",   type: "uint256"  },
      { name: "reputationTotal", type: "uint256"  },
      { name: "totalFeedback",   type: "uint256"  },
      { name: "stakeAmount",     type: "uint256"  },
      { name: "totalJobs",       type: "uint256"  },
      { name: "activeJobs",      type: "uint256"  },
    ],
    stateMutability: "view",
  },
  {
    name: "getAgentSkills",
    type: "function",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "string[]" }],
    stateMutability: "view",
  },
  {
    name: "getRequiredETH",
    type: "function",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// ======================================================
// JobEscrow ABI (minimal — functions we need)
// jobs() returns all 14 fields (no string[] in Job struct)
// ======================================================
export const JOB_ESCROW_ABI = [
  {
    name: "jobCount",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "jobs",
    type: "function",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "id",                     type: "uint256"  },
      { name: "client",                 type: "address"  },
      { name: "provider",               type: "address"  },
      { name: "registryAgentId",        type: "uint256"  },
      { name: "payment",                type: "uint256"  },
      { name: "paymentToken",           type: "uint8"    },
      { name: "resultData",             type: "string"   },
      { name: "description",            type: "string"   },
      { name: "jobType",                type: "string"   },
      { name: "status",                 type: "uint8"    },
      { name: "verificationRequestId",  type: "bytes32"  },
      { name: "deadline",               type: "uint256"  },
      { name: "createdAt",              type: "uint256"  },
      { name: "qualityScore",           type: "uint8"    },
    ],
    stateMutability: "view",
  },
  {
    name: "createJob",
    type: "function",
    inputs: [
      { name: "agentId",          type: "uint256" },
      { name: "deadlineSeconds",  type: "uint256" },
      { name: "description",      type: "string"  },
      { name: "jobType",          type: "string"  },
    ],
    outputs: [],
    stateMutability: "payable",
  },
] as const;
