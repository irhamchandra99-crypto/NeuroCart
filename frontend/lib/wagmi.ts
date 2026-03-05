import { createConfig, http } from "wagmi";
import { baseSepolia  } from "wagmi/chains";
import { injected, coinbaseWallet } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  ssr: false, // ← FIX: matikan SSR, ini penyebab error #310
  connectors: [
    injected(),
    coinbaseWallet({ appName: "NeuroCart" }),
  ],
  transports: {
    [baseSepolia.id]: http("https://sepolia.base.org"), // ganti
  },
});