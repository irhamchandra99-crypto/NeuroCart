#!/usr/bin/env python3
"""
demo_summarizer.py — NeuroCart Provider Agent (x402-enabled)

Agent AI yang:
1. Meng-expose HTTP endpoint yang x402-compatible
2. Saat dipanggil tanpa payment → return 402 + instruksi bayar
3. Saat dipanggil dengan payment header → jalankan AI summarization
4. Submit hasil ke blockchain → Chainlink Functions verifikasi otomatis

Setup:
    pip install flask anthropic web3 python-dotenv requests

Jalankan:
    python demo_summarizer.py

Env vars yang dibutuhkan (.env):
    PRIVATE_KEY=0x...              # wallet private key agent ini
    ANTHROPIC_API_KEY=sk-ant-...   # Claude API key
    AGENT_WALLET=0x...             # alamat wallet yang menerima x402 payment
    AGENT_ID=0                     # legacy agent ID di AgentRegistry

Pastikan sudah:
1. Register agent di AgentRegistry (jalankan mode register dulu)
2. Fund wallet dengan ETH (untuk gas) dan USDC (untuk demo x402)
"""

import os
import json
import time
import anthropic
from flask import Flask, request, jsonify
from dotenv import load_dotenv
from agent_sdk import AgentSDK
from utils import connect_web3, get_account

load_dotenv()

app = Flask(__name__)

# ==========================================
# KONFIGURASI
# ==========================================

AGENT_WALLET    = os.getenv("AGENT_WALLET", "0x0000000000000000000000000000000000000001")
AGENT_ID        = int(os.getenv("AGENT_ID", "0"))
PORT            = int(os.getenv("PORT", "5001"))

# USDC di Base Sepolia (untuk x402 demo, lebih murah gas)
USDC_CONTRACT   = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
USDC_AMOUNT     = "2000000"  # 2 USDC (6 desimal)

# Inisialisasi Claude client
claude_client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

# Inisialisasi SDK (untuk submit hasil ke blockchain)
try:
    sdk = AgentSDK(network="arbitrum_sepolia")
    print(f"✅ SDK terkoneksi ke blockchain")
except Exception as e:
    sdk = None
    print(f"⚠️  SDK tidak terkoneksi: {e}")
    print(f"   Agent akan berjalan tanpa blockchain submission")

# ==========================================
# AI SUMMARIZATION FUNCTION
# ==========================================

def summarize_with_claude(text: str) -> str:
    """Ringkas teks menggunakan Claude API."""
    message = claude_client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=500,
        messages=[
            {
                "role": "user",
                "content": f"""Ringkas teks berikut dalam 3-5 kalimat yang jelas dan informatif.
Tulis dalam Bahasa Indonesia. Pertahankan poin-poin penting.

Teks yang akan diringkas:
{text}

Ringkasan:"""
            }
        ]
    )
    return message.content[0].text.strip()

# ==========================================
# x402 PAYMENT VERIFICATION
# ==========================================

def verify_x402_payment(payment_header: str) -> bool:
    """
    Verifikasi x402 payment header.

    Dalam production, kamu harus:
    1. Parse payment header (JSON base64-encoded)
    2. Verify signature dari client wallet
    3. Cek on-chain bahwa USDC sudah ditransfer
    4. Cek amount sesuai dengan yang diminta

    Untuk demo ini, kita mock verifikasi-nya.
    Production implementation ada di: https://github.com/coinbase/x402
    """
    if not payment_header:
        return False
    # Mock: kalau ada header apapun, anggap valid (untuk demo)
    # Production: verify signature + check on-chain transfer
    return len(payment_header) > 10

# ==========================================
# HTTP ENDPOINTS
# ==========================================

@app.route("/api/summarize", methods=["POST"])
def summarize():
    """
    Main endpoint untuk summarization service.

    Flow x402:
    1. Cek payment header
    2. Jika tidak ada → return 402 dengan instruksi
    3. Jika ada → verify payment → jalankan AI → submit ke blockchain
    """
    payment_header = request.headers.get("X-PAYMENT")

    # === LANGKAH 1: Cek payment ===
    if not payment_header or not verify_x402_payment(payment_header):
        # Return 402 dengan instruksi x402
        return jsonify({
            "x402Version": 1,
            "error": "Payment Required",
            "accepts": [
                {
                    "scheme": "exact",
                    "network": "base-sepolia",
                    "maxAmountRequired": USDC_AMOUNT,
                    "resource": f"http://localhost:{PORT}/api/summarize",
                    "description": "AI Summarization Service — per request",
                    "mimeType": "application/json",
                    "payTo": AGENT_WALLET,
                    "maxTimeoutSeconds": 300,
                    "asset": USDC_CONTRACT,
                    "outputSchema": {
                        "type": "object",
                        "properties": {
                            "summary": {"type": "string"},
                            "job_id": {"type": "number"},
                            "quality_pending": {"type": "boolean"}
                        }
                    }
                }
            ]
        }), 402

    # === LANGKAH 2: Validasi request body ===
    data = request.get_json(silent=True)
    if not data or "text" not in data:
        return jsonify({"error": "Request body harus mengandung field 'text'"}), 400

    text = data["text"]
    if len(text) < 10:
        return jsonify({"error": "Teks terlalu pendek (minimal 10 karakter)"}), 400

    print(f"\n🤖 Request summarization diterima (via x402)")
    print(f"   Panjang teks: {len(text)} karakter")
    print(f"   Payment header: {payment_header[:30]}...")

    # === LANGKAH 3: Jalankan AI ===
    try:
        print(f"   🧠 Memanggil Claude API...")
        summary = summarize_with_claude(text)
        print(f"   ✅ Ringkasan selesai ({len(summary)} karakter)")

        # === LANGKAH 4: Submit hasil ke blockchain ===
        job_id = None
        if sdk and sdk.escrow:
            try:
                # Cari job aktif untuk agent ini
                # Dalam production, mapping job_id dari x402 payment metadata
                job_count = sdk.escrow.functions.jobCount().call()
                for jid in range(max(0, job_count - 10), job_count):
                    job = sdk.escrow.functions.jobs(jid).call()
                    if job[2] == sdk.account.address and job[9] == 1:  # ACCEPTED
                        job_id = jid
                        sdk._submit_result(job_id, summary)
                        print(f"   ⛓️  Submitted ke blockchain (Job #{job_id})")
                        print(f"   🔗 Chainlink Functions sedang verifikasi kualitas...")
                        break
            except Exception as e:
                print(f"   ⚠️  Blockchain submission error: {e}")

        return jsonify({
            "summary": summary,
            "job_id": job_id,
            "quality_pending": job_id is not None,
            "message": "Ringkasan selesai. Chainlink Functions sedang verifikasi kualitas." if job_id else "Ringkasan selesai.",
            "agent": {
                "id": AGENT_ID,
                "name": "SummarizerBot",
                "erc8004": "ERC-8004 Compliant",
                "verification": "Chainlink Functions"
            }
        }), 200

    except Exception as e:
        print(f"   ❌ Error: {e}")
        return jsonify({"error": f"Summarization gagal: {str(e)}"}), 500


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "online",
        "agent": "SummarizerBot",
        "agent_id": AGENT_ID,
        "erc8004_compliant": True,
        "x402_enabled": True,
        "chainlink_verification": True,
        "accepts": ["summarization"],
        "price": "2 USDC per request",
        "wallet": AGENT_WALLET
    })


@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "name": "NeuroCart SummarizerBot",
        "description": "AI Summarization Agent — ERC-8004 + x402 + Chainlink",
        "endpoints": {
            "POST /api/summarize": "Ringkas teks (requires x402 payment)",
            "GET /health": "Status agent"
        },
        "payment": {
            "protocol": "x402",
            "amount": "2 USDC",
            "network": "Base Sepolia"
        }
    })


# ==========================================
# MAIN
# ==========================================

if __name__ == "__main__":
    print("=" * 60)
    print("  NeuroCart SummarizerBot — Provider Agent")
    print("  ERC-8004 Compliant | x402 Payment | Chainlink Verified")
    print("=" * 60)
    print(f"\n📡 Server berjalan di: http://localhost:{PORT}")
    print(f"💳 Menerima pembayaran di: {AGENT_WALLET}")
    print(f"💰 Harga: 2 USDC per request (via x402)")
    print(f"\n📋 Test dengan:")
    print(f"   curl -X POST http://localhost:{PORT}/api/summarize \\")
    print(f"        -H 'Content-Type: application/json' \\")
    print(f"        -d '{{\"text\": \"Teks yang mau diringkas...\"}}'")
    print(f"\n   (Akan dapat response 402, lalu jalankan demo_client.py untuk auto-pay)")

    app.run(host="0.0.0.0", port=PORT, debug=False)
