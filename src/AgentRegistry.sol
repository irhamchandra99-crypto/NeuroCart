// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// =============================================================================
// AgentRegistry v2.0 — ERC-8004 Compliant
//
// Upgrade dari v1:
//   ✅ Implement IERC8004 (Identity + Reputation + Validation)
//   ✅ Staking 0.01 ETH saat register (Validation Registry)
//   ✅ USD pricing via Chainlink Data Feeds (ETH/USD)
//   ✅ ERC-8004 bytes32 agentId + metadataURI
//   ✅ On-chain reputation feedback system
//   ✅ Slash mechanism untuk agent curang
// =============================================================================

import {IERC8004} from "./interfaces/IERC8004.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract AgentRegistry is IERC8004 {

    // =========================================================================
    // CONSTANTS
    // =========================================================================

    /// @notice Minimum stake yang harus didepositkan agent saat register
    uint256 public constant MINIMUM_STAKE = 0.01 ether;

    /// @notice Skor reputasi awal (netral)
    uint256 public constant INITIAL_REPUTATION = 50;

    // =========================================================================
    // DATA STRUCTURES
    // =========================================================================

    struct Agent {
        // Identity
        address owner;
        string name;
        string[] skills;
        string endpoint;        // URL HTTP endpoint agent (untuk x402)
        string metadataURI;     // IPFS / HTTPS link ke JSON metadata (ERC-8004)
        bool isActive;

        // Pricing — disimpan dalam USD cents (contoh: 200 = $2.00)
        // Dibayar dalam ETH menggunakan kurs real-time dari Chainlink
        uint256 priceUSDCents;

        // Reputation (ERC-8004 Reputation Registry)
        uint256 reputationTotal;   // akumulasi semua skor feedback
        uint256 totalFeedback;     // jumlah feedback yang masuk

        // Validation (ERC-8004 Validation Registry)
        uint256 stakeAmount;       // ETH yang di-stake (dalam wei)
        uint256 totalJobs;         // total job selesai
        uint256 activeJobs;        // job yang sedang berjalan (untuk cek slash)
    }

    // =========================================================================
    // STATE VARIABLES
    // =========================================================================

    /// @notice Mapping dari uint256 agentId (legacy) ke Agent struct
    mapping(uint256 => Agent) public agents;

    /// @notice Mapping dari ERC-8004 bytes32 agentId ke uint256 agentId (legacy)
    mapping(bytes32 => uint256) public erc8004ToLegacyId;

    /// @notice Mapping dari uint256 agentId ke ERC-8004 bytes32 agentId
    mapping(uint256 => bytes32) public legacyToErc8004Id;

    /// @notice Mapping dari owner wallet ke list agentId miliknya
    mapping(address => uint256[]) public ownerToAgentIds;

    /// @notice Counter ID agent (mulai dari 0)
    uint256 public agentCount = 0;

    /// @notice Chainlink ETH/USD Price Feed (Arbitrum Sepolia)
    /// @dev Verify address di: https://docs.chain.link/data-feeds/price-feeds/addresses?network=arbitrum
    AggregatorV3Interface public immutable priceFeed;

    /// @notice Address escrow contract — satu-satunya yang boleh slash stake
    address public escrowContract;

    /// @notice Owner dari platform ini
    address public platformOwner;

    // =========================================================================
    // EVENTS (tambahan dari IERC8004)
    // =========================================================================

    event AgentRegistered(uint256 indexed agentId, bytes32 indexed erc8004Id, address indexed owner, string name);
    event AgentUpdated(uint256 indexed agentId);
    event AgentDeactivated(uint256 indexed agentId);
    event ActiveJobsUpdated(uint256 indexed agentId, uint256 activeJobs);

    // =========================================================================
    // MODIFIERS
    // =========================================================================

    modifier onlyAgentOwner(uint256 agentId) {
        require(agents[agentId].owner == msg.sender, "Bukan owner agent ini");
        _;
    }

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

    /// @param _priceFeedAddress  Alamat Chainlink ETH/USD Price Feed
    ///        Arbitrum Sepolia: 0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165
    ///        Verify: https://docs.chain.link/data-feeds/price-feeds/addresses?network=arbitrum
    constructor(address _priceFeedAddress) {
        priceFeed = AggregatorV3Interface(_priceFeedAddress);
        platformOwner = msg.sender;
    }

    // =========================================================================
    // SETUP FUNCTIONS
    // =========================================================================

    function setEscrowContract(address _escrow) external onlyPlatformOwner {
        escrowContract = _escrow;
    }

    // =========================================================================
    // FUNGSI UTAMA: REGISTER AGENT
    // =========================================================================

    /// @notice Daftarkan AI agent ke marketplace
    /// @dev Wajib kirim minimum 0.01 ETH sebagai stake (ERC-8004 Validation)
    /// @param name          Nama agent, contoh: "SummarizerBot"
    /// @param skills        List skill, contoh: ["summarization", "nlp"]
    /// @param priceUSDCents Harga per call dalam USD cents (100 = $1.00)
    /// @param endpoint      URL HTTP endpoint agent (x402-enabled)
    /// @param metadataURI   IPFS/HTTPS link ke JSON metadata (ERC-8004)
    function registerAgent(
        string memory name,
        string[] memory skills,
        uint256 priceUSDCents,
        string memory endpoint,
        string memory metadataURI
    ) external payable returns (uint256 legacyId, bytes32 erc8004Id) {
        require(bytes(name).length > 0, "Nama tidak boleh kosong");
        require(skills.length > 0, "Minimal 1 skill");
        require(priceUSDCents > 0, "Harga harus lebih dari 0");
        require(msg.value >= MINIMUM_STAKE, "Stake minimum 0.01 ETH diperlukan");

        // Generate ERC-8004 bytes32 agent ID
        erc8004Id = keccak256(abi.encodePacked(msg.sender, name, block.timestamp));
        legacyId = agentCount;

        // Simpan agent
        agents[legacyId] = Agent({
            owner: msg.sender,
            name: name,
            skills: skills,
            endpoint: endpoint,
            metadataURI: metadataURI,
            isActive: true,
            priceUSDCents: priceUSDCents,
            reputationTotal: INITIAL_REPUTATION * 1,  // seed awal
            totalFeedback: 1,
            stakeAmount: msg.value,
            totalJobs: 0,
            activeJobs: 0
        });

        // Mapping dua arah ERC-8004 ID <-> legacy ID
        erc8004ToLegacyId[erc8004Id] = legacyId;
        legacyToErc8004Id[legacyId] = erc8004Id;
        ownerToAgentIds[msg.sender].push(legacyId);

        agentCount++;

        emit AgentRegistered(legacyId, erc8004Id, msg.sender, name);
        emit AgentIdentityRegistered(erc8004Id, msg.sender, metadataURI);
        emit StakeDeposited(erc8004Id, msg.sender, msg.value);

        return (legacyId, erc8004Id);
    }

    // =========================================================================
    // FUNGSI UPDATE & DEACTIVATE
    // =========================================================================

    function updateAgent(
        uint256 agentId,
        uint256 newPriceUSDCents,
        string memory newEndpoint,
        string memory newMetadataURI
    ) external onlyAgentOwner(agentId) {
        require(newPriceUSDCents > 0, "Harga harus lebih dari 0");
        agents[agentId].priceUSDCents = newPriceUSDCents;
        agents[agentId].endpoint = newEndpoint;
        agents[agentId].metadataURI = newMetadataURI;
        emit AgentUpdated(agentId);
    }

    function deactivateAgent(uint256 agentId) external onlyAgentOwner(agentId) {
        require(agents[agentId].activeJobs == 0, "Ada job aktif, tidak bisa deactivate");
        agents[agentId].isActive = false;
        emit AgentDeactivated(agentId);
    }

    // =========================================================================
    // ERC-8004: IDENTITY REGISTRY
    // =========================================================================

    function registerIdentity(bytes32 agentId, string calldata metadataURI) external override {
        uint256 legacyId = erc8004ToLegacyId[agentId];
        require(agents[legacyId].owner == msg.sender, "Bukan owner agent ini");
        agents[legacyId].metadataURI = metadataURI;
        emit AgentIdentityRegistered(agentId, msg.sender, metadataURI);
    }

    function updateMetadata(bytes32 agentId, string calldata newMetadataURI) external override {
        uint256 legacyId = erc8004ToLegacyId[agentId];
        require(agents[legacyId].owner == msg.sender, "Bukan owner agent ini");
        agents[legacyId].metadataURI = newMetadataURI;
    }

    function getAgentMetadata(bytes32 agentId) external view override returns (string memory) {
        return agents[erc8004ToLegacyId[agentId]].metadataURI;
    }

    function getAgentOwner(bytes32 agentId) external view override returns (address) {
        return agents[erc8004ToLegacyId[agentId]].owner;
    }

    // =========================================================================
    // ERC-8004: REPUTATION REGISTRY
    // =========================================================================

    /// @notice Submit feedback — hanya bisa dipanggil oleh escrow setelah job selesai
    function submitFeedback(
        bytes32 agentId,
        uint8 score,
        string calldata comment
    ) external override onlyEscrow {
        require(score <= 100, "Skor maksimal 100");
        uint256 legacyId = erc8004ToLegacyId[agentId];

        agents[legacyId].reputationTotal += score;
        agents[legacyId].totalFeedback += 1;

        if (agents[legacyId].totalFeedback > 1) {
            agents[legacyId].totalJobs += 1;
        }

        emit ReputationSubmitted(agentId, msg.sender, score, comment);
    }

    /// @notice Ambil reputasi agent
    function getReputation(bytes32 agentId)
        external
        view
        override
        returns (uint256 avgScore, uint256 totalFeedback)
    {
        uint256 legacyId = erc8004ToLegacyId[agentId];
        Agent storage agent = agents[legacyId];
        if (agent.totalFeedback == 0) return (0, 0);
        return (agent.reputationTotal / agent.totalFeedback, agent.totalFeedback);
    }

    // =========================================================================
    // ERC-8004: VALIDATION REGISTRY (STAKING)
    // =========================================================================

    function stakeForValidation(bytes32 agentId) external payable override {
        uint256 legacyId = erc8004ToLegacyId[agentId];
        require(agents[legacyId].owner == msg.sender, "Bukan owner agent ini");
        require(msg.value > 0, "Stake harus lebih dari 0");
        agents[legacyId].stakeAmount += msg.value;
        emit StakeDeposited(agentId, msg.sender, msg.value);
    }

    function withdrawStake(bytes32 agentId) external override {
        uint256 legacyId = erc8004ToLegacyId[agentId];
        Agent storage agent = agents[legacyId];
        require(agent.owner == msg.sender, "Bukan owner agent ini");
        require(agent.activeJobs == 0, "Ada job aktif");
        require(agent.stakeAmount > 0, "Tidak ada stake");

        uint256 amount = agent.stakeAmount;
        agent.stakeAmount = 0;
        agent.isActive = false;

        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Gagal transfer stake");
        emit StakeWithdrawn(agentId, msg.sender, amount);
    }

    /// @notice Slash stake agent yang curang — hanya bisa dipanggil escrow
    function slashStake(bytes32 agentId, string calldata reason) external override onlyEscrow {
        uint256 legacyId = erc8004ToLegacyId[agentId];
        Agent storage agent = agents[legacyId];
        require(agent.stakeAmount > 0, "Tidak ada stake untuk di-slash");

        uint256 slashAmount = agent.stakeAmount;
        agent.stakeAmount = 0;
        agent.isActive = false;

        // Kirim stake yang di-slash ke platform owner
        (bool sent, ) = payable(platformOwner).call{value: slashAmount}("");
        require(sent, "Gagal transfer slash");

        emit StakeSlashed(agentId, reason, slashAmount);
    }

    function getStake(bytes32 agentId) external view override returns (uint256) {
        return agents[erc8004ToLegacyId[agentId]].stakeAmount;
    }

    function hasMinimumStake(bytes32 agentId) external view override returns (bool) {
        return agents[erc8004ToLegacyId[agentId]].stakeAmount >= MINIMUM_STAKE;
    }

    // =========================================================================
    // CHAINLINK DATA FEEDS — DYNAMIC USD PRICING
    // =========================================================================

    /// @notice Ambil harga ETH/USD terkini dari Chainlink
    function getLatestETHPrice() public view returns (uint256) {
        (, int256 price, , , ) = priceFeed.latestRoundData();
        require(price > 0, "Harga tidak valid dari oracle");
        // Price feed mengembalikan harga dengan 8 desimal
        return uint256(price);
    }

    /// @notice Hitung berapa ETH yang dibutuhkan untuk bayar agent (dalam priceUSDCents)
    /// @param agentId  Legacy uint256 agent ID
    /// @return ethAmount  Jumlah ETH dalam wei yang harus dibayar
    function getRequiredETH(uint256 agentId) public view returns (uint256 ethAmount) {
        uint256 priceUSDCents = agents[agentId].priceUSDCents;
        uint256 ethUSDPrice = getLatestETHPrice(); // 8 desimal

        // Formula: ethAmount = (priceUSDCents * 1e18) / (ethUSDPrice / 100 * 100)
        // Sederhananya: ethAmount = priceUSDCents * 1e16 / ethUSDPrice
        // priceUSDCents = 200 berarti $2.00
        // ethUSDPrice mis. 300000000000 = $3000.00000000
        ethAmount = (priceUSDCents * 1e16) / (ethUSDPrice / 1e2);
    }

    // =========================================================================
    // FUNGSI UNTUK ESCROW CONTRACT
    // =========================================================================

    function incrementActiveJobs(uint256 agentId) external onlyEscrow {
        agents[agentId].activeJobs += 1;
        emit ActiveJobsUpdated(agentId, agents[agentId].activeJobs);
    }

    function decrementActiveJobs(uint256 agentId) external onlyEscrow {
        if (agents[agentId].activeJobs > 0) {
            agents[agentId].activeJobs -= 1;
        }
        emit ActiveJobsUpdated(agentId, agents[agentId].activeJobs);
    }

    // =========================================================================
    // VIEW HELPERS
    // =========================================================================

    function getAgentsByOwner(address owner) external view returns (uint256[] memory) {
        return ownerToAgentIds[owner];
    }

    function getAgentSkills(uint256 agentId) external view returns (string[] memory) {
        return agents[agentId].skills;
    }

    function getAgentReputation(uint256 agentId) external view returns (uint256 avgScore) {
        Agent storage agent = agents[agentId];
        if (agent.totalFeedback == 0) return 0;
        return agent.reputationTotal / agent.totalFeedback;
    }

    /// @notice Helper untuk JobEscrow — cek apakah agent aktif
    function isAgentActive(uint256 agentId) external view returns (bool) {
        return agents[agentId].isActive;
    }

    /// @notice Helper untuk JobEscrow — ambil owner address agent
    function getAgentOwnerAddr(uint256 agentId) external view returns (address) {
        return agents[agentId].owner;
    }

    /// @notice Helper — ambil priceUSDCents agent
    function getAgentPrice(uint256 agentId) external view returns (uint256) {
        return agents[agentId].priceUSDCents;
    }
}
