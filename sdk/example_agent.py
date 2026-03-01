# example_agent.py
# Contoh penggunaan AgentSDK — demo untuk hackathon
#
# Skenario demo:
# "TranscriberBot" — agent yang bisa "transkripsi" teks
# (kita simulasi dulu tanpa AI beneran, nanti bisa diganti model asli)

from agent_sdk import AgentSDK
from utils import hash_result, hash_to_hex

# =============================================
# STEP 1: DEFINISIKAN LOGIC AI AGENT KAMU
# =============================================

def transcriber_handler(job_id: int, job_data: dict) -> str:
    """
    Ini adalah "otak" dari agent kita.
    Fungsi ini dipanggil otomatis oleh SDK setiap ada job baru.
    
    Di sini kamu bisa taruh:
    - Call ke OpenAI API
    - Call ke Whisper untuk transkripsi audio
    - Call ke model AI apapun
    
    Untuk demo ini, kita simulasi dengan teks sederhana.
    """
    print(f"\n🤖 TranscriberBot mulai kerja...")
    print(f"   Job ID: {job_id}")
    print(f"   Deskripsi: {job_data['description']}")
    print(f"   Bayaran: {job_data['payment_eth']} ETH")
    
    # ===== SIMULASI KERJA AI =====
    # Di production, ganti bagian ini dengan:
    # import openai
    # result = openai.audio.transcriptions.create(...)
    
    # Untuk demo: kita "transkripsi" deskripsi job-nya
    result = f"Transkripsi selesai: '{job_data['description']}' telah diproses oleh TranscriberBot v1.0"
    
    print(f"   ✅ Hasil: {result}")
    print(f"   Hash hasil: {hash_to_hex(hash_result(result))}")
    
    return result

# =============================================
# STEP 2: JALANKAN AGENT
# =============================================

if __name__ == "__main__":
    print("=" * 50)
    print("  AI Agent Marketplace — TranscriberBot Demo")
    print("=" * 50)
    
    # Inisialisasi SDK
    # Private key diambil otomatis dari file .env
    sdk = AgentSDK(network="arbitrum_sepolia")
    
    # Cek balance dulu
    sdk.get_balance()
    
    print("\nPilih mode:")
    print("1. Register agent baru")
    print("2. Listen job (agent sudah terdaftar)")
    
    choice = input("\nPilihan (1/2): ").strip()
    
    if choice == "1":
        # Register agent baru ke marketplace
        agent_id = sdk.register_agent(
            name="TranscriberBot",
            skills=["transcription", "speech-to-text"],
            price_eth=0.001,  # 0.001 ETH per job
            endpoint="https://demo-transcriber.example.com/api"
        )
        print(f"\n🎉 Agent berhasil didaftarkan!")
        print(f"   Agent ID: {agent_id}")
        print(f"\nSimpen Agent ID ini, lalu jalankan mode 2 untuk mulai listen job.")
        
    elif choice == "2":
        agent_id = int(input("Masukkan Agent ID kamu: ").strip())
        
        # Tampilkan info agent
        print(f"\n📋 Info Agent ID {agent_id}:")
        info = sdk.get_agent_info(agent_id)
        print(f"   Nama: {info['name']}")
        print(f"   Skills: {info['skills']}")
        print(f"   Harga: {info['price_eth']} ETH")
        print(f"   Reputasi: {info['reputation']}/100")
        print(f"   Total jobs: {info['total_jobs']}")
        
        # Mulai listen job
        sdk.listen_for_jobs(agent_id, handler=transcriber_handler)
    
    else:
        print("Pilihan tidak valid!")