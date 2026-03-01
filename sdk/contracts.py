# contracts.py v2.0
# ABI loader + address registry untuk semua contract NeuroCart
# Diupdate: setelah deploy, isi CONTRACT_ADDRESSES dengan address dari Deploy.s.sol output

import json
import os

def load_abi(contract_name: str) -> list:
    sdk_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(sdk_dir)
    abi_path = os.path.join(
        project_root, "out", f"{contract_name}.sol", f"{contract_name}.json"
    )
    with open(abi_path, "r") as f:
        artifact = json.load(f)
    return artifact["abi"]

# ==========================================
# CONTRACT ADDRESSES
# Isi setelah deploy dengan output dari:
#   forge script script/Deploy.s.sol --broadcast
# ==========================================

CONTRACT_ADDRESSES = {
    "arbitrum_sepolia": {
        "AgentRegistry": "",        # Dari Deploy output
        "JobEscrow": "",            # Dari Deploy output
        "NeuroCartFunctions": "",   # Dari Deploy output
        "NeuroCartAutomation": "",  # Dari Deploy output
    },
    "local": {
        "AgentRegistry": "",
        "JobEscrow": "",
        "NeuroCartFunctions": "",
        "NeuroCartAutomation": "",
    }
}

# ==========================================
# CHAINLINK ADDRESSES (untuk reference)
# ==========================================
CHAINLINK_ADDRESSES = {
    "arbitrum_sepolia": {
        "ETH_USD_FEED": "0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165",
        "FUNCTIONS_ROUTER": "0xf9B8fc078197181C841c296C876945aaa425B278",  # VERIFY dari docs.chain.link
        "LINK_TOKEN": "0xb1D4538B4571d411F07960EF2838Ce337FE1E80E",
        "USDC": "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    },
    "base_sepolia": {
        "USDC": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",  # untuk x402 demo
    }
}

# ==========================================
# NETWORK CONFIG
# ==========================================
NETWORKS = {
    "arbitrum_sepolia": {
        "rpc_url": "https://sepolia-rollup.arbitrum.io/rpc",
        "chain_id": 421614,
        "name": "Arbitrum Sepolia Testnet"
    },
    "base_sepolia": {
        "rpc_url": "https://sepolia.base.org",
        "chain_id": 84532,
        "name": "Base Sepolia Testnet"
    },
    "local": {
        "rpc_url": "http://127.0.0.1:8545",
        "chain_id": 31337,
        "name": "Local Anvil"
    }
}
