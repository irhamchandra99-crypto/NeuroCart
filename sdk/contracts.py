# contracts.py
# File ini menyimpan ABI dan address contract kita
# ABI = "daftar menu" yang memberitahu Python fungsi apa saja yang ada di contract

import json
import os

# ===== ABI =====
# Kita ambil langsung dari file yang di-generate Foundry
# Lebih aman daripada hardcode manual

def load_abi(contract_name: str) -> list:
    """
    Baca ABI dari folder out/ yang di-generate Foundry.
    contract_name: nama contract, contoh: 'AgentRegistry'
    """
    # Cari root folder project (satu level di atas folder sdk/)
    sdk_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(sdk_dir)
    
    abi_path = os.path.join(
        project_root, 
        "out", 
        f"{contract_name}.sol", 
        f"{contract_name}.json"
    )
    
    with open(abi_path, "r") as f:
        artifact = json.load(f)
    
    return artifact["abi"]

# ===== CONTRACT ADDRESSES =====
# Sekarang masih kosong karena belum deploy
# Nanti setelah deploy ke testnet, kita isi dengan address yang didapat

CONTRACT_ADDRESSES = {
    "arbitrum_sepolia": {
        "AgentRegistry": "",   # diisi setelah deploy
        "JobEscrow": "",       # diisi setelah deploy
    },
    "local": {
        "AgentRegistry": "",   # untuk testing lokal
        "JobEscrow": "",
    }
}

# ===== NETWORK CONFIG =====
# Konfigurasi jaringan yang kita support

NETWORKS = {
    "arbitrum_sepolia": {
        "rpc_url": "https://sepolia-rollup.arbitrum.io/rpc",
        "chain_id": 421614,
        "name": "Arbitrum Sepolia Testnet"
    },
    "local": {
        "rpc_url": "http://127.0.0.1:8545",
        "chain_id": 31337,
        "name": "Local Anvil"
    }
}