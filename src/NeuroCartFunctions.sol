// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// =============================================================================
// NeuroCartFunctions.sol — Chainlink Functions Consumer
//
// Contract ini bertugas:
//   1. Menerima request verifikasi dari JobEscrow
//   2. Mengirim request ke Chainlink DON (Decentralized Oracle Network)
//   3. DON memanggil AI quality verification API (Claude/GPT)
//   4. Menerima skor kualitas (0-100) via callback fulfillRequest()
//   5. Meneruskan hasil ke JobEscrow untuk finalisasi payment
//
// Flow:
//   JobEscrow.submitResult() → NeuroCartFunctions.requestVerification()
//   → Chainlink DON → verify-quality.js → Claude API
//   → NeuroCartFunctions.fulfillRequest() → JobEscrow.finalizeVerification()
// =============================================================================

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";

interface IJobEscrowFinalize {
    function finalizeVerification(uint256 jobId, bool passed, uint8 score) external;
}

contract NeuroCartFunctions is FunctionsClient {
    using FunctionsRequest for FunctionsRequest.Request;

    // =========================================================================
    // CHAINLINK CONFIG
    // =========================================================================

    /// @notice Chainlink Functions Subscription ID
    /// @dev Buat subscription di https://functions.chain.link
    uint64 public subscriptionId;

    /// @notice DON ID untuk Arbitrum Sepolia
    /// @dev Verify di https://docs.chain.link/chainlink-functions/supported-networks
    bytes32 public donId;

    /// @notice Gas limit untuk callback fulfillRequest()
    uint32 public constant CALLBACK_GAS_LIMIT = 300_000;

    /// @notice Skor minimum untuk payment direlease (dari 0-100)
    uint8 public constant QUALITY_THRESHOLD = 80;

    // =========================================================================
    // STATE VARIABLES
    // =========================================================================

    /// @notice Source code JavaScript yang dijalankan di DON
    string public verifyQualitySource;

    /// @notice Mapping requestId → jobId (agar kita tahu job mana yang sedang diverifikasi)
    mapping(bytes32 => uint256) public requestToJobId;

    /// @notice Mapping requestId → sudah diproses atau belum
    mapping(bytes32 => bool) public requestProcessed;

    /// @notice Address dari JobEscrow contract (hanya dia yang boleh request verifikasi)
    address public escrowContract;

    /// @notice Platform owner
    address public platformOwner;

    /// @notice CRE workflow address (alternative verification path)
    address public creWorkflow;

    // =========================================================================
    // EVENTS
    // =========================================================================

    event VerificationRequested(bytes32 indexed requestId, uint256 indexed jobId);
    event VerificationFulfilled(bytes32 indexed requestId, uint256 indexed jobId, uint8 score, bool passed);
    event VerificationFailed(bytes32 indexed requestId, uint256 indexed jobId, bytes error);
    event SourceUpdated();

    // =========================================================================
    // MODIFIERS
    // =========================================================================

    modifier onlyEscrow() {
        require(msg.sender == escrowContract, "Hanya escrow contract");
        _;
    }

    modifier onlyPlatformOwner() {
        require(msg.sender == platformOwner, "Hanya platform owner");
        _;
    }

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    /// @param router          Alamat Chainlink Functions Router
    ///        Arbitrum Sepolia: 0x234a5fb5Bd614a7AA2d0a4B64F7A37B43f97917
    ///        Verify: https://docs.chain.link/chainlink-functions/supported-networks
    /// @param _subscriptionId ID subscription dari https://functions.chain.link
    /// @param _donId          DON ID (bytes32): fun-arbitrum-sepolia-1
    ///        hex: 0x66756e2d617262697472756d2d7365706f6c69612d3100000000000000000000
    constructor(
        address router,
        uint64 _subscriptionId,
        bytes32 _donId
    ) FunctionsClient(router) {
        subscriptionId = _subscriptionId;
        donId = _donId;
        platformOwner = msg.sender;
    }

    // =========================================================================
    // SETUP FUNCTIONS
    // =========================================================================

    function setEscrowContract(address _escrow) external onlyPlatformOwner {
        escrowContract = _escrow;
    }

    function setSubscriptionId(uint64 _subscriptionId) external onlyPlatformOwner {
        subscriptionId = _subscriptionId;
    }

    /// @notice Upload source code JS yang akan dijalankan DON
    /// @dev Source code ada di chainlink/verify-quality.js
    function setSource(string calldata _source) external onlyPlatformOwner {
        verifyQualitySource = _source;
        emit SourceUpdated();
    }

    // =========================================================================
    // FUNGSI UTAMA: REQUEST VERIFIKASI
    // =========================================================================

    /// @notice Kirim request verifikasi ke Chainlink DON
    /// @param jobId      ID job di JobEscrow
    /// @param result     Hasil pekerjaan agent (string, akan dikirim ke DON)
    /// @param jobType    Tipe task: "summarization", "translation", dll
    /// @return requestId ID request dari Chainlink (untuk tracking)
    function requestVerification(
        uint256 jobId,
        string calldata result,
        string calldata jobType
    ) external onlyEscrow returns (bytes32 requestId) {
        require(bytes(verifyQualitySource).length > 0, "Source belum diset");

        // Build Chainlink Functions request
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(verifyQualitySource);

        // Kirim args ke DON (hasil agent + tipe job)
        string[] memory args = new string[](2);
        args[0] = result;
        args[1] = jobType;
        req.setArgs(args);

        // Kirim request ke Chainlink DON
        // _sendRequest mengirim ke router dan mengembalikan requestId unik
        requestId = _sendRequest(
            req.encodeCBOR(),
            subscriptionId,
            CALLBACK_GAS_LIMIT,
            donId
        );

        // Simpan mapping requestId → jobId
        requestToJobId[requestId] = jobId;

        emit VerificationRequested(requestId, jobId);
        return requestId;
    }

    // =========================================================================
    // CALLBACK: TERIMA HASIL DARI DON
    // =========================================================================

    /// @notice Dipanggil otomatis oleh Chainlink DON setelah verifikasi selesai
    /// @param requestId ID request yang sudah selesai
    /// @param response  Data response (skor dalam bytes)
    /// @param err       Error jika ada (bytes kosong = tidak ada error)
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        require(!requestProcessed[requestId], "Request sudah diproses");
        requestProcessed[requestId] = true;

        uint256 jobId = requestToJobId[requestId];

        // Jika ada error dari DON
        if (err.length > 0) {
            // Jika gagal verifikasi, refund ke client (safe default)
            IJobEscrowFinalize(escrowContract).finalizeVerification(jobId, false, 0);
            emit VerificationFailed(requestId, jobId, err);
            return;
        }

        // Parse skor dari response bytes (DON mengembalikan uint256 yang di-encode)
        uint256 scoreRaw = abi.decode(response, (uint256));
        uint8 score = uint8(scoreRaw > 100 ? 100 : scoreRaw);

        // Cek apakah skor memenuhi threshold
        bool passed = score >= QUALITY_THRESHOLD;

        // Beritahu JobEscrow untuk finalisasi
        IJobEscrowFinalize(escrowContract).finalizeVerification(jobId, passed, score);

        emit VerificationFulfilled(requestId, jobId, score, passed);
    }

    // =========================================================================
    // VIEW HELPERS
    // =========================================================================

    function getRequestJobId(bytes32 requestId) external view returns (uint256) {
        return requestToJobId[requestId];
    }

    // =========================================================================
    // CRE WORKFLOW INTEGRATION
    // =========================================================================

    /// @notice Set authorized CRE workflow address
    function setCREWorkflow(address _cre) external onlyPlatformOwner {
        creWorkflow = _cre;
    }

    /// @notice Called by CRE workflow to submit a quality score directly
    /// @dev Alternative verification path: CRE orchestrates Claude API call off-chain
    ///      and submits the verified score here, which then settles the escrow
    /// @param jobId  The job to finalize
    /// @param score  Quality score 0-100 from Claude API (via CRE DON)
    function receiveCREScore(uint256 jobId, uint8 score) external {
        require(msg.sender == creWorkflow, "Only authorized CRE workflow");
        require(escrowContract != address(0), "Escrow not set");

        bool passed = score >= QUALITY_THRESHOLD;
        IJobEscrowFinalize(escrowContract).finalizeVerification(jobId, passed, score);

        emit VerificationFulfilled(bytes32(jobId), jobId, score, passed);
    }
}
