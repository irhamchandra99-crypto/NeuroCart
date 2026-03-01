// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Import contract AgentRegistry biar bisa akses data agent
import {AgentRegistry} from "./AgentRegistry.sol";

contract JobEscrow {

    // ===== ENUM =====
    // Enum = tipe data dengan pilihan terbatas, mirip constants
    // Ini status sebuah job, urutannya penting (0,1,2,3)
    enum JobStatus {
        CREATED,    // 0 - job dibuat, uang terkunci
        ACCEPTED,   // 1 - agent B konfirmasi mau ngerjain
        COMPLETED,  // 2 - selesai, uang sudah release
        CANCELLED   // 3 - gagal/timeout, uang balik
    }

    // ===== STRUCT =====
    struct Job {
        uint256 jobId;
        address payable clientAgent;   // Agent A - yang bayar
        address payable providerAgent; // Agent B - yang ngerjain
        uint256 registryAgentId;       // ID agent B di AgentRegistry
        uint256 payment;               // jumlah ETH terkunci (dalam wei)
        bytes32 resultHash;            // hash hasil yang disepakati di awal
        bytes32 submittedHash;         // hash yang disubmit Agent B
        JobStatus status;
        uint256 createdAt;             // timestamp job dibuat
        uint256 deadline;              // batas waktu pengerjaan
        string jobDescription;         // deskripsi tugas
    }

    // ===== STATE VARIABLES =====
    AgentRegistry public registry;     // referensi ke contract AgentRegistry
    
    mapping(uint256 => Job) public jobs;
    uint256 public jobCount = 0;

    // Platform fee = 2% dari setiap transaksi (untuk project kita)
    uint256 public constant PLATFORM_FEE_PERCENT = 2;
    address public platformOwner;

    // ===== EVENTS =====
    event JobCreated(uint256 indexed jobId, address indexed client, uint256 indexed agentId, uint256 payment);
    event JobAccepted(uint256 indexed jobId, address indexed provider);
    event JobCompleted(uint256 indexed jobId, bytes32 resultHash);
    event JobCancelled(uint256 indexed jobId, string reason);

    // ===== CONSTRUCTOR =====
    // Constructor = fungsi yang dijalankan SEKALI saat contract pertama di-deploy
    // Seperti __init__ di Python
    constructor(address registryAddress, address _platformOwner) {
    registry = AgentRegistry(registryAddress);
    platformOwner = _platformOwner;
    }

    // ===== MODIFIER =====
    modifier onlyInStatus(uint256 jobId, JobStatus expectedStatus) {
    _onlyInStatus(jobId, expectedStatus);
    _;
    }

    function _onlyInStatus(uint256 jobId, JobStatus expectedStatus) internal view {
        require(jobs[jobId].status == expectedStatus, "Status job tidak sesuai");
    }

    // ===== FUNGSI 1: BUAT JOB =====
    // keyword "payable" = fungsi ini bisa menerima kiriman ETH
    function createJob(
        uint256 providerAgentId,
        bytes32 agreedResultHash,
        uint256 deadlineInSeconds,
        string memory description
    ) external payable returns (uint256) {

        // Validasi 1: agent yang mau disewa harus aktif
        (, , , , bool isActive, , ) = registry.agents(providerAgentId);
        require(isActive, "Agent tidak aktif");

        // Validasi 2: ETH yang dikirim harus lebih dari 0
        require(msg.value > 0, "Payment harus lebih dari 0");

        // Validasi 3: deadline harus di masa depan
        require(deadlineInSeconds > 0, "Deadline tidak valid");

        // Ambil address owner dari agent yang disewa
        (address providerOwner, , , , , , ) = registry.agents(providerAgentId);

        uint256 newJobId = jobCount;

        // Simpan job baru
        // msg.value = jumlah ETH yang dikirim bersamaan dengan pemanggilan fungsi ini
        jobs[newJobId] = Job({
            jobId: newJobId,
            clientAgent: payable(msg.sender),
            providerAgent: payable(providerOwner),
            registryAgentId: providerAgentId,
            payment: msg.value,
            resultHash: agreedResultHash,
            submittedHash: bytes32(0), // kosong dulu, diisi nanti saat submit
            status: JobStatus.CREATED,
            createdAt: block.timestamp,
            deadline: block.timestamp + deadlineInSeconds,
            jobDescription: description
        });

        jobCount++;
        emit JobCreated(newJobId, msg.sender, providerAgentId, msg.value);
        return newJobId;
    }

    // ===== FUNGSI 2: TERIMA JOB =====
    // Agent B konfirmasi bahwa dia mau ngerjain job ini
    function acceptJob(uint256 jobId) 
        external 
        onlyInStatus(jobId, JobStatus.CREATED) 
    {
        Job storage job = jobs[jobId];
        
        // Hanya providerAgent yang bisa accept
        require(msg.sender == job.providerAgent, "Bukan provider job ini");
        
        // Pastikan deadline belum lewat
        require(block.timestamp < job.deadline, "Deadline sudah lewat");

        job.status = JobStatus.ACCEPTED;
        emit JobAccepted(jobId, msg.sender);
    }

    // ===== FUNGSI 3: SUBMIT HASIL =====
    // Agent B submit hash dari hasil pekerjaannya
    function submitResult(uint256 jobId, bytes32 resultHash)
        external
        onlyInStatus(jobId, JobStatus.ACCEPTED)
    {
        Job storage job = jobs[jobId];
        require(msg.sender == job.providerAgent, "Bukan provider job ini");

        job.submittedHash = resultHash;

        // Cek apakah hash yang disubmit cocok dengan yang disepakati di awal
        if (resultHash == job.resultHash) {
            // ✅ Hash cocok = kerja selesai, bayar provider
            _releasePayment(jobId);
        } else {
            // ❌ Hash tidak cocok = cancel, uang balik ke client
            _cancelJob(jobId, "Hash hasil tidak cocok");
        }
    }

    // ===== FUNGSI 4: CANCEL JOB =====
    // Bisa dipanggil client kalau deadline sudah lewat
    function cancelExpiredJob(uint256 jobId) external {
        Job storage job = jobs[jobId];
        
        require(
            job.status == JobStatus.CREATED || job.status == JobStatus.ACCEPTED,
            "Job sudah selesai atau sudah dicancel"
        );
        require(block.timestamp > job.deadline, "Deadline belum lewat");

        _cancelJob(jobId, "Deadline exceeded");
    }
    // ===== FUNGSI INTERNAL =====
    // Diawali _ = konvensi penanda fungsi internal/private

    // Proses pembayaran ke provider
    function _releasePayment(uint256 jobId) internal {
        Job storage job = jobs[jobId];
        
        // Hitung platform fee 2%
        uint256 fee = (job.payment * PLATFORM_FEE_PERCENT) / 100;
        
        // Provider dapat sisa setelah dipotong fee
        uint256 providerAmount = job.payment - fee;

        // Update status DULU sebelum kirim ETH
        // Ini pola "Checks-Effects-Interactions" — best practice keamanan smart contract
        // Mencegah "reentrancy attack" (serangan di mana hacker panggil fungsi berulang)
        job.status = JobStatus.COMPLETED;

        // Kirim ETH ke provider
        // .call{value: amount}("") = cara modern kirim ETH di Solidity
        (bool sentToProvider, ) = job.providerAgent.call{value: providerAmount}("");
        require(sentToProvider, "Gagal kirim ETH ke provider");

        // Kirim fee ke platform owner
        (bool sentFee, ) = payable(platformOwner).call{value: fee}("");
        require(sentFee, "Gagal kirim fee");

        emit JobCompleted(jobId, job.submittedHash);
    }

    // Proses pembatalan dan refund ke client
    function _cancelJob(uint256 jobId, string memory reason) internal {
        Job storage job = jobs[jobId];
        
        job.status = JobStatus.CANCELLED;

        // Kembalikan ETH ke client
        (bool refunded, ) = job.clientAgent.call{value: job.payment}("");
        require(refunded, "Gagal refund ETH ke client");

        emit JobCancelled(jobId, reason);
    }
}  // ← tutup contract
