#!/usr/bin/env python3
"""
demo_client.py — NeuroCart Client Agent (x402 auto-payment)

Agent AI client yang:
1. Cek provider agent online
2. Request summarization tanpa payment → terima 402 + instruksi
3. Auto-bayar USDC ke agent wallet (Base Sepolia)
4. Retry request dengan X-PAYMENT header → terima ringkasan
5. Opsional: tunggu verifikasi Chainlink Functions

Setup:
    pip install requests web3 python-dotenv

Jalankan (setelah demo_summarizer.py berjalan):
    python demo_client.py

Env vars (.env):
    PRIVATE_KEY=0x...           # wallet client (untuk bayar USDC)
    PROVIDER_URL=http://localhost:5001   # URL provider agent (default)
    CLIENT_TEXT=...             # teks yang mau diringkas (opsional)
"""

import os
import json
import base64
import time
import requests
from web3 import Web3
from dotenv import load_dotenv

load_dotenv()

# ==========================================
# KONFIGURASI
# ==========================================

PROVIDER_URL     = os.getenv("PROVIDER_URL", "http://localhost:5001")
PRIVATE_KEY      = os.getenv("PRIVATE_KEY")
BASE_SEPOLIA_RPC = "https://sepolia.base.org"
BASE_SEPOLIA_CHAIN_ID = 84532

# USDC di Base Sepolia
USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"

USDC_ABI = [
    {
        "name": "transfer",
        "type": "function",
        "inputs": [
            {"name": "to", "type": "address"},
            {"name": "amount", "type": "uint256"}
        ],
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "nonpayable"
    },
    {
        "name": "balanceOf",
        "type": "function",
        "inputs": [{"name": "account", "type": "address"}],
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view"
    },
]

# Teks demo default (bisa di-override via env var CLIENT_TEXT)
DEMO_TEXT = os.getenv("CLIENT_TEXT", """
Kecerdasan buatan (AI) telah mengalami perkembangan yang sangat pesat dalam beberapa tahun terakhir.
Model bahasa besar seperti GPT-4 dan Claude mampu melakukan berbagai tugas yang sebelumnya hanya bisa
dilakukan oleh manusia, mulai dari menulis kode, menganalisis dokumen hukum, hingga menjawab pertanyaan
medis. Perkembangan ini membawa peluang besar sekaligus tantangan yang nyata bagi masyarakat global.
Di satu sisi, AI dapat meningkatkan produktivitas dan efisiensi secara signifikan di berbagai sektor.
Di sisi lain, muncul kekhawatiran tentang dampaknya terhadap lapangan kerja dan privasi data pengguna.
Para ahli teknologi memprediksi bahwa dalam 10 tahun ke depan, AI akan menjadi teknologi yang paling
transformatif dalam sejarah manusia, mengubah cara kita bekerja, belajar, dan berinteraksi satu sama lain.
Adopsi AI yang bertanggung jawab membutuhkan kolaborasi antara pemerintah, industri, dan masyarakat
untuk memastikan bahwa manfaatnya dapat dinikmati secara merata oleh semua lapisan masyarakat.
""".strip())


# ==========================================
# WEB3 HELPERS
# ==========================================

def setup_base_sepolia():
    """Buat koneksi ke Base Sepolia untuk x402 USDC payment."""
    if not PRIVATE_KEY:
        raise ValueError("PRIVATE_KEY tidak ditemukan di .env")

    private_key = PRIVATE_KEY if PRIVATE_KEY.startswith("0x") else "0x" + PRIVATE_KEY
    w3 = Web3(Web3.HTTPProvider(BASE_SEPOLIA_RPC))

    if not w3.is_connected():
        raise ConnectionError(f"Tidak bisa konek ke Base Sepolia ({BASE_SEPOLIA_RPC})")

    account = w3.eth.account.from_key(private_key)
    return w3, account


def get_usdc_balance(w3, address: str) -> float:
    """Ambil balance USDC (dalam unit USDC, bukan mikrounit)."""
    usdc = w3.eth.contract(
        address=Web3.to_checksum_address(USDC_ADDRESS),
        abi=USDC_ABI
    )
    raw = usdc.functions.balanceOf(Web3.to_checksum_address(address)).call()
    return raw / 1_000_000  # USDC = 6 desimal


def transfer_usdc(w3, account, pay_to: str, amount_raw: int) -> str:
    """
    Transfer USDC ke agent wallet (x402 payment).
    amount_raw = jumlah dalam mikrounit (contoh: 2000000 = 2 USDC)
    Return: tx_hash hex string
    """
    usdc = w3.eth.contract(
        address=Web3.to_checksum_address(USDC_ADDRESS),
        abi=USDC_ABI
    )

    tx = usdc.functions.transfer(
        Web3.to_checksum_address(pay_to),
        amount_raw
    ).build_transaction({
        "from": account.address,
        "nonce": w3.eth.get_transaction_count(account.address),
        "gasPrice": w3.eth.gas_price,
        "chainId": BASE_SEPOLIA_CHAIN_ID,
    })

    try:
        tx["gas"] = int(w3.eth.estimate_gas(tx) * 1.2)
    except Exception:
        tx["gas"] = 120_000

    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)

    print(f"   📤 TX terkirim: 0x{tx_hash.hex()[:20]}...")
    print(f"   ⏳ Menunggu konfirmasi block...")

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=90)

    if receipt["status"] != 1:
        raise RuntimeError(f"Transfer USDC gagal! TX: 0x{tx_hash.hex()}")

    print(f"   ✅ Transfer sukses! Block #{receipt['blockNumber']}")
    return tx_hash.hex()


def build_payment_header(tx_hash: str, pay_to: str, amount: str, network: str) -> str:
    """
    Buat X-PAYMENT header dari bukti transaksi.

    Format x402 (simplified):
      base64( JSON { scheme, network, payload: { transactionHash, payTo, amount, asset } } )

    Production: gunakan EIP-3009 transferWithAuthorization untuk atomic payment.
    """
    proof = {
        "scheme": "exact",
        "network": network,
        "payload": {
            "transactionHash": tx_hash,
            "payTo": pay_to,
            "amount": amount,
            "asset": USDC_ADDRESS,
        }
    }
    return base64.b64encode(json.dumps(proof).encode()).decode()


def build_mock_payment_header(amount: str, network: str) -> str:
    """Header mock untuk demo tanpa USDC balance."""
    proof = {
        "scheme": "exact",
        "network": network,
        "payload": {
            "mock": True,
            "amount": amount,
            "note": "Demo mode — gunakan USDC testnet untuk demo nyata"
        }
    }
    return base64.b64encode(json.dumps(proof).encode()).decode()


# ==========================================
# x402 FLOW STEPS
# ==========================================

def step1_check_provider() -> bool:
    """Pastikan provider agent online dan ready."""
    print("\n🔍 Step 0: Cek provider agent...")
    try:
        resp = requests.get(f"{PROVIDER_URL}/health", timeout=5)
        if resp.status_code == 200:
            info = resp.json()
            print(f"   ✅ Provider online!")
            print(f"   Agent  : {info.get('agent', '?')}")
            print(f"   Harga  : {info.get('price', '?')}")
            print(f"   ERC-8004: {'✓' if info.get('erc8004_compliant') else '✗'}")
            print(f"   x402   : {'✓' if info.get('x402_enabled') else '✗'}")
            print(f"   Chainlink: {'✓' if info.get('chainlink_verification') else '✗'}")
            return True
        else:
            print(f"   ⚠️  Provider merespon dengan status {resp.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print(f"   ❌ Tidak bisa konek ke {PROVIDER_URL}")
        print(f"   → Pastikan demo_summarizer.py sudah berjalan!")
        return False
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False


def step2_request_no_payment() -> dict:
    """
    x402 Step 1: Kirim request tanpa payment.
    Provider akan return 402 + instruksi pembayaran.
    Return: dict payment_info dari provider.
    """
    print("\n📡 Step 1 (x402): Request summarization tanpa payment...")

    resp = requests.post(
        f"{PROVIDER_URL}/api/summarize",
        json={"text": DEMO_TEXT},
        timeout=10
    )

    if resp.status_code != 402:
        print(f"   ⚠️  Ekspektasi 402, dapat: {resp.status_code}")
        return {}

    data = resp.json()
    accepts = data.get("accepts", [])
    if not accepts:
        print(f"   ❌ Response 402 tidak ada field 'accepts'")
        return {}

    payment_info = accepts[0]
    amount_usdc = int(payment_info["maxAmountRequired"]) / 1_000_000

    print(f"   ✅ 402 Payment Required — sesuai ekspektasi!")
    print(f"   Scheme  : {payment_info['scheme']}")
    print(f"   Network : {payment_info['network']}")
    print(f"   Amount  : {amount_usdc:.2f} USDC")
    print(f"   Pay to  : {payment_info['payTo']}")
    print(f"   Timeout : {payment_info.get('maxTimeoutSeconds', '?')}s")

    return payment_info


def step3_pay_usdc(payment_info: dict, w3, account) -> str:
    """
    x402 Step 2: Bayar USDC ke agent wallet.
    Return: X-PAYMENT header string.
    """
    pay_to  = payment_info["payTo"]
    amount  = payment_info["maxAmountRequired"]
    network = payment_info["network"]
    amount_usdc = int(amount) / 1_000_000

    print(f"\n💳 Step 2 (x402): Auto-pay {amount_usdc:.2f} USDC...")

    # Cek balance
    balance = get_usdc_balance(w3, account.address)
    eth_balance = float(w3.from_wei(w3.eth.get_balance(account.address), "ether"))

    print(f"   Wallet : {account.address}")
    print(f"   USDC   : {balance:.2f} USDC")
    print(f"   ETH    : {eth_balance:.6f} ETH (untuk gas)")

    if balance >= amount_usdc and eth_balance > 0.0001:
        # Real payment
        print(f"   → Mengirim {amount_usdc:.2f} USDC ke provider...")
        tx_hash = transfer_usdc(w3, account, pay_to, int(amount))
        header = build_payment_header(tx_hash, pay_to, amount, network)
        print(f"   ✅ Payment berhasil! TX: 0x{tx_hash[:20]}...")
    else:
        # Mock payment (demo tanpa testnet USDC)
        if balance < amount_usdc:
            print(f"   ⚠️  USDC tidak cukup ({balance:.2f} < {amount_usdc:.2f})")
        if eth_balance <= 0.0001:
            print(f"   ⚠️  ETH hampir habis (gas tidak cukup)")
        print(f"   → Menggunakan mock payment untuk demo...")
        header = build_mock_payment_header(amount, network)
        print(f"   ✅ Mock payment header dibuat")

    return header


def step4_retry_with_payment(payment_header: str) -> dict:
    """
    x402 Step 3: Retry request dengan X-PAYMENT header.
    Return: response JSON dari provider.
    """
    print(f"\n🔄 Step 3 (x402): Retry dengan X-PAYMENT header...")

    resp = requests.post(
        f"{PROVIDER_URL}/api/summarize",
        json={"text": DEMO_TEXT},
        headers={"X-PAYMENT": payment_header},
        timeout=60  # AI call butuh waktu lebih lama
    )

    if resp.status_code == 200:
        result = resp.json()
        print(f"   ✅ Provider menerima payment dan mengembalikan hasil!")
        return result
    else:
        print(f"   ❌ Error dari provider: {resp.status_code}")
        print(f"   {resp.text[:300]}")
        return {}


# ==========================================
# MAIN FLOW
# ==========================================

def main():
    print("=" * 60)
    print("  NeuroCart Client Agent — x402 Autonomous Payment")
    print("  Flow: Request → 402 → Pay USDC → Hasil Ringkasan")
    print("=" * 60)

    # Inisialisasi Web3 untuk Base Sepolia
    w3 = None
    account = None
    if PRIVATE_KEY:
        print(f"\n🔗 Menghubungkan ke Base Sepolia (x402 network)...")
        try:
            w3, account = setup_base_sepolia()
            print(f"   ✅ Terhubung! Chain ID: {w3.eth.chain_id}")
        except Exception as e:
            print(f"   ⚠️  {e}")
            print(f"   → Demo akan berjalan dalam mock payment mode")
    else:
        print(f"\n⚠️  PRIVATE_KEY tidak diset — menggunakan mock payment mode")
        print(f"   Tambahkan PRIVATE_KEY=0x... di file .env untuk demo nyata")

    # ── Step 0: Cek provider ──────────────────────────────────────
    if not step1_check_provider():
        return

    # ── Step 1 (x402): Request tanpa payment → dapat 402 ─────────
    payment_info = step2_request_no_payment()
    if not payment_info:
        print("\n❌ Gagal mendapat payment info dari provider")
        return

    # ── Step 2 (x402): Bayar USDC ────────────────────────────────
    if w3 and account:
        payment_header = step3_pay_usdc(payment_info, w3, account)
    else:
        # Tanpa private key: langsung mock
        print(f"\n💳 Mock payment (tidak ada PRIVATE_KEY)...")
        payment_header = build_mock_payment_header(
            payment_info["maxAmountRequired"],
            payment_info["network"]
        )
        print(f"   ✅ Mock payment header dibuat")

    # ── Step 3 (x402): Retry dengan payment header ───────────────
    result = step4_retry_with_payment(payment_header)
    if not result:
        print("\n❌ Gagal mendapat ringkasan dari provider")
        return

    # ── Tampilkan Hasil ───────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  HASIL — Autonomous Agent-to-Agent Transaction")
    print("=" * 60)

    print(f"\n📄 Teks asli  : {len(DEMO_TEXT)} karakter")
    print(f"   Preview    : {DEMO_TEXT[:80]}...")

    summary = result.get("summary", "N/A")
    print(f"\n✨ Ringkasan  :")
    # Tampilkan ringkasan dengan word-wrap sederhana
    words = summary.split()
    line, lines = [], []
    for w in words:
        line.append(w)
        if len(" ".join(line)) > 55:
            lines.append("   " + " ".join(line))
            line = []
    if line:
        lines.append("   " + " ".join(line))
    print("\n".join(lines))

    agent = result.get("agent", {})
    print(f"\n🤖 Provider Agent:")
    print(f"   Nama       : {agent.get('name', 'N/A')}")
    print(f"   Standard   : {agent.get('erc8004', 'N/A')}")
    print(f"   Verifikasi : {agent.get('verification', 'N/A')}")

    job_id = result.get("job_id")
    if job_id is not None:
        print(f"\n⛓️  Blockchain Job ID: #{job_id}")
        print(f"   Status: VERIFYING (Chainlink Functions sedang berjalan)")
        print(f"   DON akan verifikasi kualitas ringkasan dalam ~30-60 detik")
        print(f"   Setelah diverifikasi: payment dirilis otomatis ke provider")

    print(f"\n{'=' * 60}")
    print(f"  ✅ DEMO SELESAI — x402 Autonomous Payment Berhasil!")
    print(f"{'=' * 60}")
    print(f"\nRingkasan flow yang baru saja terjadi:")
    print(f"  1. Client request POST /api/summarize (tanpa payment)")
    print(f"  2. Provider return HTTP 402 + instruksi USDC payment")
    print(f"  3. Client auto-parse 402 → bayar USDC ke provider wallet")
    print(f"  4. Client retry POST /api/summarize + X-PAYMENT header")
    print(f"  5. Provider verifikasi payment → jalankan Claude AI")
    print(f"  6. Provider submit hasil ke blockchain (Arbitrum Sepolia)")
    print(f"  7. Chainlink Functions DON verifikasi kualitas (0-100)")
    print(f"  8. Jika skor ≥ 80 → payment direlease ke provider wallet")
    print(f"\nSemua langkah di atas terjadi AUTONOMOUS — tanpa campur tangan manusia!")


if __name__ == "__main__":
    main()
