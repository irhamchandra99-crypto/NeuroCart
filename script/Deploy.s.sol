// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// =============================================================================
// Deploy.s.sol — Deployment Script (Foundry)
//
// Cara deploy ke Arbitrum Sepolia:
//
//   forge script script/Deploy.s.sol \
//     --rpc-url https://sepolia-rollup.arbitrum.io/rpc \
//     --broadcast \
//     --verify \
//     -vvvv
//
// Butuh env vars di .env:
//   PRIVATE_KEY=0x...
//   ARBSEP_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
//   ETHERSCAN_API_KEY=...  (untuk --verify)
//   FUNCTIONS_SUBSCRIPTION_ID=...
//
// Setelah deploy, update contracts.py dengan address yang keluar
// =============================================================================

import {Script, console} from "forge-std/Script.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {JobEscrow} from "../src/JobEscrow.sol";
import {NeuroCartFunctions} from "../src/NeuroCartFunctions.sol";
import {NeuroCartAutomation} from "../src/NeuroCartAutomation.sol";

contract Deploy is Script {

    // =========================================================================
    // CHAINLINK ADDRESSES — ARBITRUM SEPOLIA
    // Verify semua address di: https://docs.chain.link/
    // =========================================================================

    // ETH/USD Price Feed (Arbitrum Sepolia)
    // https://docs.chain.link/data-feeds/price-feeds/addresses?network=arbitrum&page=1
    address constant ETH_USD_FEED = 0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165;

    // Chainlink Functions Router (Arbitrum Sepolia)
    // VERIFY address sebelum deploy: https://docs.chain.link/chainlink-functions/supported-networks
    // Ganti dengan address yang tepat dari docs Chainlink
    address constant FUNCTIONS_ROUTER = 0xf9B8fc078197181C841c296C876945aaa425B278;

    // DON ID untuk Arbitrum Sepolia (fun-arbitrum-sepolia-1)
    bytes32 constant DON_ID = 0x66756e2d617262697472756d2d7365706f6c69612d3100000000000000000000;

    // USDC di Arbitrum Sepolia
    // https://developers.circle.com/stablecoins/usdc-on-test-networks
    address constant USDC_ARBITRUM_SEPOLIA = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d;

    // =========================================================================
    // DEPLOY
    // =========================================================================

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Ambil subscription ID dari env (buat dulu di https://functions.chain.link)
        uint64 subscriptionId = uint64(vm.envUint("FUNCTIONS_SUBSCRIPTION_ID"));

        console.log("=== NEUROCART DEPLOYMENT ===");
        console.log("Deployer:", deployer);
        console.log("Network: Arbitrum Sepolia");
        console.log("Subscription ID:", subscriptionId);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy AgentRegistry (ERC-8004 + Chainlink Data Feeds)
        AgentRegistry registry = new AgentRegistry(ETH_USD_FEED);
        console.log("AgentRegistry deployed:", address(registry));

        // 2. Deploy JobEscrow (Chainlink Functions + USDC)
        JobEscrow escrow = new JobEscrow(
            address(registry),
            deployer,
            USDC_ARBITRUM_SEPOLIA
        );
        console.log("JobEscrow deployed:", address(escrow));

        // 3. Deploy NeuroCartFunctions (Chainlink Functions Consumer)
        NeuroCartFunctions functions = new NeuroCartFunctions(
            FUNCTIONS_ROUTER,
            subscriptionId,
            DON_ID
        );
        console.log("NeuroCartFunctions deployed:", address(functions));

        // 4. Deploy NeuroCartAutomation (Chainlink Automation)
        NeuroCartAutomation automation = new NeuroCartAutomation(address(escrow));
        console.log("NeuroCartAutomation deployed:", address(automation));

        // 5. Wiring: hubungkan semua contract
        registry.setEscrowContract(address(escrow));
        escrow.setFunctionsContract(address(functions));
        escrow.setAutomationContract(address(automation));
        functions.setEscrowContract(address(escrow));

        console.log("\n=== WIRING SELESAI ===");
        console.log("registry.escrowContract ->", address(escrow));
        console.log("escrow.functionsContract ->", address(functions));
        console.log("escrow.automationContract ->", address(automation));
        console.log("functions.escrowContract ->", address(escrow));

        vm.stopBroadcast();

        // Output untuk disalin ke sdk/contracts.py
        console.log("\n=== COPY KE contracts.py ===");
        console.log("AgentRegistry =", address(registry));
        console.log("JobEscrow =", address(escrow));
        console.log("NeuroCartFunctions =", address(functions));
        console.log("NeuroCartAutomation =", address(automation));

        console.log("\n=== LANGKAH SELANJUTNYA ===");
        console.log("1. Tambahkan NeuroCartFunctions ke subscription LINK:");
        console.log("   https://functions.chain.link -> tambah consumer:", address(functions));
        console.log("2. Upload verify-quality.js source ke contract:");
        console.log("   cast send", address(functions), "setSource(string)");
        console.log("3. Daftarkan NeuroCartAutomation di Automation:");
        console.log("   https://automation.chain.link -> Register Upkeep:", address(automation));
    }
}
