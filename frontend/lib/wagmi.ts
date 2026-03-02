import { createConfig, http, cookieStorage, createStorage } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { injected, coinbaseWallet } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
  connectors: [
    injected(),
    coinbaseWallet({ appName: "NeuroCart" }),
  ],
  transports: {
    [baseSepolia.id]: http("https://sepolia.base.org"),
  },
});
