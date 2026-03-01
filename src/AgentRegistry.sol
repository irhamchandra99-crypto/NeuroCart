// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract AgentRegistry {

    // ===== DATA STRUCTURES =====

    // Struct = bundel data, mirip class di Java/Python
    struct Agent {
        address owner;        // wallet address si pemilik agent
        string name;          // nama agent, contoh: "TranscriberBot"
        string[] skills;      // list skill, contoh: ["transcription", "ocr"]
        uint256 pricePerCall; // harga per panggilan (dalam wei)
        string endpoint;      // URL API agent (off-chain)
        bool isActive;        // agent aktif atau tidak
        uint256 reputation;   // skor reputasi (0-100)
        uint256 totalJobs;    // total job yang pernah selesai
    }

    // ===== STATE VARIABLES =====

    // Mapping = seperti HashMap di Java / dict di Python
    mapping(uint256 => Agent) public agents;   // id => Agent
    mapping(address => uint256[]) public ownerToAgentIds; // wallet => list id agent miliknya

    uint256 public agentCount = 0; // counter id, mulai dari 0

    // ===== EVENTS =====
    // Event = notifikasi ke dunia luar bahwa sesuatu terjadi
    event AgentRegistered(uint256 indexed agentId, address indexed owner, string name);
    event AgentUpdated(uint256 indexed agentId);
    event AgentDeactivated(uint256 indexed agentId);

    // ===== MODIFIERS =====
    // Modifier = "penjaga" fungsi, mirip decorator di Python
    modifier onlyAgentOwner(uint256 agentId) {
        _onlyAgentOwner(agentId);
        _;
    }

    function _onlyAgentOwner(uint256 agentId) internal view{
        require(agents[agentId].owner == msg.sender, "Bukan owner agent ini");
    }

    // ===== FUNCTIONS =====

    // Daftarkan agent baru
    function registerAgent(
        string memory name,
        string[] memory skills,
        uint256 pricePerCall,
        string memory endpoint
    ) external returns (uint256) {
        
        // Validasi input tidak boleh kosong
        require(bytes(name).length > 0, "Nama tidak boleh kosong");
        require(skills.length > 0, "Minimal 1 skill");
        require(pricePerCall > 0, "Harga harus lebih dari 0");

        uint256 newId = agentCount;

        // Simpan data agent ke mapping
        agents[newId] = Agent({
            owner: msg.sender,
            name: name,
            skills: skills,
            pricePerCall: pricePerCall,
            endpoint: endpoint,
            isActive: true,
            reputation: 50,   // mulai dari 50 (netral)
            totalJobs: 0
        });

        // Catat bahwa wallet ini punya agent dengan id ini
        ownerToAgentIds[msg.sender].push(newId);

        agentCount++;

        // Emit event biar bisa didengar dari luar
        emit AgentRegistered(newId, msg.sender, name);

        return newId;
    }

    // Update endpoint atau harga agent
    function updateAgent(
        uint256 agentId,
        uint256 newPrice,
        string memory newEndpoint
    ) external onlyAgentOwner(agentId) {
        agents[agentId].pricePerCall = newPrice;
        agents[agentId].endpoint = newEndpoint;
        emit AgentUpdated(agentId);
    }

    // Nonaktifkan agent
    function deactivateAgent(uint256 agentId) external onlyAgentOwner(agentId) {
        agents[agentId].isActive = false;
        emit AgentDeactivated(agentId);
    }

    // Ambil list agent ID milik satu wallet
    function getAgentsByOwner(address owner) external view returns (uint256[] memory) {
        return ownerToAgentIds[owner];
    }

    // Ambil skills dari satu agent
    function getAgentSkills(uint256 agentId) external view returns (string[] memory) {
        return agents[agentId].skills;
    }
}