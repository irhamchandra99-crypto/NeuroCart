// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {AgentRegistry} from "./AgentRegistry.sol";

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

interface INeuroCartFunctions {
    function requestVerification(
        uint256 jobId,
        string calldata result,
        string calldata jobType
    ) external returns (bytes32 requestId);
}

contract JobEscrow {

    enum JobStatus { CREATED, ACCEPTED, VERIFYING, COMPLETED, CANCELLED }
    enum PaymentToken { ETH, USDC }

    struct Job {
        uint256 jobId;
        address payable clientAgent;
        address payable providerAgent;
        uint256 registryAgentId;
        uint256 payment;
        PaymentToken paymentToken;
        string resultData;
        string jobDescription;
        string jobType;
        JobStatus status;
        uint256 createdAt;
        uint256 deadline;
        bytes32 verificationRequestId;
        uint8 qualityScore;
    }

    AgentRegistry public registry;
    INeuroCartFunctions public functionsContract;
    address public automationContract;
    address public platformOwner;
    IERC20 public usdcToken;

    mapping(uint256 => Job) public jobs;
    uint256 public jobCount = 0;
    uint256 public constant PLATFORM_FEE_PERCENT = 2;

    event JobCreated(uint256 indexed jobId, address indexed client, uint256 indexed agentId, uint256 payment, PaymentToken token);
    event JobAccepted(uint256 indexed jobId, address indexed provider);
    event JobVerificationStarted(uint256 indexed jobId, bytes32 requestId);
    event JobCompleted(uint256 indexed jobId, uint8 qualityScore, uint256 providerAmount);
    event JobCancelled(uint256 indexed jobId, string reason);

    modifier onlyInStatus(uint256 jobId, JobStatus expectedStatus) {
        require(jobs[jobId].status == expectedStatus, "Status job tidak sesuai");
        _;
    }

    modifier onlyFunctions() {
        require(msg.sender == address(functionsContract), "Hanya Functions contract");
        _;
    }

    modifier onlyPlatformOwner() {
        require(msg.sender == platformOwner, "Hanya platform owner");
        _;
    }

    constructor(address registryAddress, address _platformOwner, address _usdcToken) {
        registry = AgentRegistry(registryAddress);
        platformOwner = _platformOwner;
        usdcToken = IERC20(_usdcToken);
    }

    function setFunctionsContract(address _functions) external onlyPlatformOwner {
        functionsContract = INeuroCartFunctions(_functions);
    }

    function setAutomationContract(address _automation) external onlyPlatformOwner {
        automationContract = _automation;
    }

    // --- Buat job ETH ---
    function createJob(
        uint256 providerAgentId,
        uint256 deadlineInSeconds,
        string calldata description,
        string calldata jobType
    ) external payable returns (uint256) {
        require(registry.isAgentActive(providerAgentId), "Agent tidak aktif");
        require(msg.value > 0, "Payment ETH harus lebih dari 0");
        require(deadlineInSeconds >= 300, "Deadline minimal 5 menit");

        address providerOwner = registry.getAgentOwnerAddr(providerAgentId);

        uint256 newJobId = jobCount;
        jobs[newJobId] = Job({
            jobId: newJobId,
            clientAgent: payable(msg.sender),
            providerAgent: payable(providerOwner),
            registryAgentId: providerAgentId,
            payment: msg.value,
            paymentToken: PaymentToken.ETH,
            resultData: "",
            jobDescription: description,
            jobType: jobType,
            status: JobStatus.CREATED,
            createdAt: block.timestamp,
            deadline: block.timestamp + deadlineInSeconds,
            verificationRequestId: bytes32(0),
            qualityScore: 0
        });

        jobCount++;
        registry.incrementActiveJobs(providerAgentId);
        emit JobCreated(newJobId, msg.sender, providerAgentId, msg.value, PaymentToken.ETH);
        return newJobId;
    }

    // --- Buat job USDC (untuk x402 flow) ---
    function createJobUSDC(
        uint256 providerAgentId,
        uint256 amount,
        uint256 deadlineInSeconds,
        string calldata description,
        string calldata jobType
    ) external returns (uint256) {
        require(registry.isAgentActive(providerAgentId), "Agent tidak aktif");
        require(amount > 0, "Payment USDC harus lebih dari 0");
        require(deadlineInSeconds >= 300, "Deadline minimal 5 menit");

        bool transferred = usdcToken.transferFrom(msg.sender, address(this), amount);
        require(transferred, "Transfer USDC gagal");

        address providerOwner = registry.getAgentOwnerAddr(providerAgentId);

        uint256 newJobId = jobCount;
        jobs[newJobId] = Job({
            jobId: newJobId,
            clientAgent: payable(msg.sender),
            providerAgent: payable(providerOwner),
            registryAgentId: providerAgentId,
            payment: amount,
            paymentToken: PaymentToken.USDC,
            resultData: "",
            jobDescription: description,
            jobType: jobType,
            status: JobStatus.CREATED,
            createdAt: block.timestamp,
            deadline: block.timestamp + deadlineInSeconds,
            verificationRequestId: bytes32(0),
            qualityScore: 0
        });

        jobCount++;
        registry.incrementActiveJobs(providerAgentId);
        emit JobCreated(newJobId, msg.sender, providerAgentId, amount, PaymentToken.USDC);
        return newJobId;
    }

    // --- Terima job ---
    function acceptJob(uint256 jobId) external onlyInStatus(jobId, JobStatus.CREATED) {
        Job storage job = jobs[jobId];
        require(msg.sender == job.providerAgent, "Bukan provider job ini");
        require(block.timestamp < job.deadline, "Deadline sudah lewat");
        job.status = JobStatus.ACCEPTED;
        emit JobAccepted(jobId, msg.sender);
    }

    // --- Submit hasil + trigger Chainlink Functions ---
    function submitResult(uint256 jobId, string calldata result)
        external
        onlyInStatus(jobId, JobStatus.ACCEPTED)
    {
        Job storage job = jobs[jobId];
        require(msg.sender == job.providerAgent, "Bukan provider job ini");
        require(block.timestamp < job.deadline, "Deadline sudah lewat");
        require(bytes(result).length > 0, "Hasil tidak boleh kosong");

        job.resultData = result;
        job.status = JobStatus.VERIFYING;

        bytes32 requestId = functionsContract.requestVerification(jobId, result, job.jobType);
        job.verificationRequestId = requestId;
        emit JobVerificationStarted(jobId, requestId);
    }

    // --- Callback dari Chainlink Functions ---
    function finalizeVerification(uint256 jobId, bool passed, uint8 score)
        external
        onlyFunctions
        onlyInStatus(jobId, JobStatus.VERIFYING)
    {
        Job storage job = jobs[jobId];
        job.qualityScore = score;

        bytes32 erc8004Id = registry.legacyToErc8004Id(job.registryAgentId);

        if (passed) {
            _releasePayment(jobId);
            registry.submitFeedback(erc8004Id, score, "Chainlink verified");
        } else {
            registry.slashStake(erc8004Id, "Quality check failed");
            registry.submitFeedback(erc8004Id, score, "Quality check failed");
            _cancelJob(jobId, "Kualitas hasil di bawah threshold 80");
        }

        registry.decrementActiveJobs(job.registryAgentId);
    }

    // --- Cancel expired (dipanggil Automation atau siapapun) ---
    function cancelExpiredJob(uint256 jobId) external {
        Job storage job = jobs[jobId];
        require(
            job.status == JobStatus.CREATED || job.status == JobStatus.ACCEPTED,
            "Job sudah selesai atau dicancel"
        );
        require(block.timestamp > job.deadline, "Deadline belum lewat");

        registry.decrementActiveJobs(job.registryAgentId);
        _cancelJob(jobId, "Deadline exceeded");
    }

    // --- Internal: release payment ---
    function _releasePayment(uint256 jobId) internal {
        Job storage job = jobs[jobId];
        uint256 fee = (job.payment * PLATFORM_FEE_PERCENT) / 100;
        uint256 providerAmount = job.payment - fee;
        job.status = JobStatus.COMPLETED;

        if (job.paymentToken == PaymentToken.ETH) {
            (bool sentProvider, ) = job.providerAgent.call{value: providerAmount}("");
            require(sentProvider, "Gagal kirim ETH ke provider");
            (bool sentFee, ) = payable(platformOwner).call{value: fee}("");
            require(sentFee, "Gagal kirim fee");
        } else {
            require(usdcToken.transfer(job.providerAgent, providerAmount), "Gagal kirim USDC ke provider");
            require(usdcToken.transfer(platformOwner, fee), "Gagal kirim fee USDC");
        }

        emit JobCompleted(jobId, job.qualityScore, providerAmount);
    }

    // --- Internal: cancel & refund ---
    function _cancelJob(uint256 jobId, string memory reason) internal {
        Job storage job = jobs[jobId];
        job.status = JobStatus.CANCELLED;

        if (job.paymentToken == PaymentToken.ETH) {
            (bool refunded, ) = job.clientAgent.call{value: job.payment}("");
            require(refunded, "Gagal refund ETH");
        } else {
            require(usdcToken.transfer(job.clientAgent, job.payment), "Gagal refund USDC");
        }

        emit JobCancelled(jobId, reason);
    }

    function getJobStatus(uint256 jobId) external view returns (JobStatus) {
        return jobs[jobId].status;
    }
}
