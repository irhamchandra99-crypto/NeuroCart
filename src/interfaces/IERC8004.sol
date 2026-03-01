// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// =============================================================================
// IERC8004 — Trustless Agents Standard
// Ethereum standard untuk AI agent identity, reputation, dan validation.
// Dibuat kompatibel dengan ekosistem ERC-8004 (live mainnet Jan 2026).
//
// 3 Registry utama:
//   1. Identity  — ID unik + metadata URI per agent
//   2. Reputation — On-chain feedback & scoring dari client
//   3. Validation — Crypto-economic staking untuk jaminan kualitas
// =============================================================================

interface IERC8004 {

    // =========================================================================
    // EVENTS
    // =========================================================================

    event AgentIdentityRegistered(
        bytes32 indexed agentId,
        address indexed owner,
        string metadataURI
    );

    event ReputationSubmitted(
        bytes32 indexed agentId,
        address indexed reviewer,
        uint8 score,
        string comment
    );

    event StakeDeposited(bytes32 indexed agentId, address indexed owner, uint256 amount);
    event StakeSlashed(bytes32 indexed agentId, string reason, uint256 slashedAmount);
    event StakeWithdrawn(bytes32 indexed agentId, address indexed owner, uint256 amount);

    // =========================================================================
    // IDENTITY REGISTRY
    // Setiap AI agent punya ID unik berbentuk bytes32 + metadata off-chain
    // =========================================================================

    /// @notice Daftarkan AI agent baru dengan metadata URI
    /// @param agentId  ID unik agent (bytes32 hash dari nama + owner)
    /// @param metadataURI  IPFS atau HTTPS URL menuju JSON metadata agent
    function registerIdentity(bytes32 agentId, string calldata metadataURI) external;

    /// @notice Update metadata URI agent
    function updateMetadata(bytes32 agentId, string calldata newMetadataURI) external;

    /// @notice Ambil metadata URI dari agent
    function getAgentMetadata(bytes32 agentId) external view returns (string memory);

    /// @notice Ambil owner dari agent
    function getAgentOwner(bytes32 agentId) external view returns (address);

    // =========================================================================
    // REPUTATION REGISTRY
    // Feedback on-chain dari client setelah job selesai
    // =========================================================================

    /// @notice Submit feedback untuk agent (dipanggil oleh client setelah job selesai)
    /// @param agentId  ID agent yang dinilai
    /// @param score    Skor 0-100
    /// @param comment  Komentar singkat (bisa string kosong)
    function submitFeedback(
        bytes32 agentId,
        uint8 score,
        string calldata comment
    ) external;

    /// @notice Ambil data reputasi agent
    /// @return avgScore      Rata-rata skor (0-100)
    /// @return totalFeedback Jumlah feedback yang masuk
    function getReputation(bytes32 agentId)
        external
        view
        returns (uint256 avgScore, uint256 totalFeedback);

    // =========================================================================
    // VALIDATION REGISTRY
    // Agen harus stake ETH sebagai jaminan — bisa di-slash kalau curang
    // =========================================================================

    /// @notice Deposit stake ETH untuk agent
    function stakeForValidation(bytes32 agentId) external payable;

    /// @notice Ambil kembali stake (hanya owner, harus tidak ada job aktif)
    function withdrawStake(bytes32 agentId) external;

    /// @notice Slash stake agent yang curang (hanya bisa dipanggil oleh escrow contract)
    function slashStake(bytes32 agentId, string calldata reason) external;

    /// @notice Cek jumlah stake yang dideposit oleh agent
    function getStake(bytes32 agentId) external view returns (uint256);

    /// @notice Cek apakah agent memiliki cukup stake untuk menerima job
    function hasMinimumStake(bytes32 agentId) external view returns (bool);
}
