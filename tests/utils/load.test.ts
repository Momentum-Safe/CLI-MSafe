import {expect} from "chai";
import {
  DEPLOYED_MSAFE, DEVNET_FAUCET_URL, DEVNET_NODE_URL,
  MAINNET_FAUCET_URL,
  MAINNET_NODE_URL,
  parseConfig, TESTNET_FAUCET_URL,
  TESTNET_NODE_URL
} from "../../src/utils/load";

const DEF_CONFIG = "tests/data/config.yaml";

describe("parse config", () => {
  it("all default", async () => {
    const c = {
      configFilePath: DEF_CONFIG,
      profile: 'default',
      network: 'default',
      endpoint: 'default',
      faucet: 'default',
      msafeDeployer: 'default',
    };
    const parsed = await parseConfig(c);

    expect(parsed.address === '62d1b9d62ee2980308216888fbf7cf857bab8bde621ff7f3acd0ba74db983326');
    expect(parsed.network === "mainnet");
    expect(parsed.nodeURL === MAINNET_NODE_URL);
    expect(parsed.faucetURL === MAINNET_FAUCET_URL);
    // Do not use private key here
    expect(parsed.privateKey === "0xf7691675c77465ece6b45dc8c00cf53b7cde647f89833695fdd19592da92b503");
    expect(parsed.msafe.toString() === DEPLOYED_MSAFE.get("mainnet"));
  });

  it("mainnet only", async () => {
    const c = {
      configFilePath: DEF_CONFIG,
      profile: 'default',
      network: 'mainnet',
      endpoint: 'default',
      faucet: 'default',
      msafeDeployer: 'default',
    };
    const parsed = await parseConfig(c);

    expect(parsed.network === "mainnet");
    expect(parsed.nodeURL === MAINNET_NODE_URL);
    expect(parsed.faucetURL === MAINNET_FAUCET_URL);
    expect(parsed.msafe.toString() === DEPLOYED_MSAFE.get("mainnet"));
  });

  it("testnet only", async () => {
    const c = {
      configFilePath: DEF_CONFIG,
      profile: 'default',
      network: 'testnet',
      endpoint: 'default',
      faucet: 'default',
      msafeDeployer: 'default',
    };
    const parsed = await parseConfig(c);

    expect(parsed.network === "testnet");
    expect(parsed.nodeURL === TESTNET_NODE_URL);
    expect(parsed.faucetURL === TESTNET_FAUCET_URL);
    expect(parsed.msafe.toString() === DEPLOYED_MSAFE.get("testnet"));
  });

  it("devnet only", async () => {
    const c = {
      configFilePath: DEF_CONFIG,
      profile: 'default',
      network: 'devnet',
      endpoint: 'default',
      faucet: 'default',
      msafeDeployer: 'default',
    };
    const parsed = await parseConfig(c);

    expect(parsed.network === "devnet");
    expect(parsed.nodeURL === DEVNET_NODE_URL);
    expect(parsed.faucetURL === DEVNET_FAUCET_URL);
    expect(parsed.msafe.toString() === DEPLOYED_MSAFE.get("devnet"));
  });

  it("all custom", async () => {
    const c = {
      configFilePath: DEF_CONFIG,
      profile: 'default',
      network: 'testnet',
      endpoint: 'unknown endpoint',
      faucet: 'unknown faucet',
      msafeDeployer: '0x123',
    };
    const parsed = await parseConfig(c);

    expect(parsed.network === "testnet");
    expect(parsed.nodeURL === "unknown endpoint");
    expect(parsed.faucetURL === "unknown faucet");
    expect(parsed.msafe.toString() === "0x123");
  });

  it("unmatched endpoint with network", async () => {
    const c = {
      configFilePath: DEF_CONFIG,
      profile: 'default',
      network: 'testnet',
      endpoint: 'mainnet.aptos.fakeurl.org',
      faucet: 'default',
      msafeDeployer: 'default',
    };

    try {
      await parseConfig(c);
    } catch (e) {
      expect((e as Error).message).to.includes('Network does match the endpoint');
      return;
    }
    expect.fail('should have thrown');
  });

  it("partially custom", async () => {
    const c = {
      configFilePath: DEF_CONFIG,
      profile: 'default',
      network: 'testnet',
      endpoint: 'default',
      faucet: 'default',
      msafeDeployer: '0x123',
    };
    const parsed = await parseConfig(c);

    expect(parsed.network === "testnet");
    expect(parsed.nodeURL === TESTNET_NODE_URL);
    expect(parsed.faucetURL === TESTNET_FAUCET_URL);
    expect(parsed.msafe.toString() === "0x123");
  });

  it("partially custom2", async () => {
    const c = {
      configFilePath: DEF_CONFIG,
      profile: 'default',
      network: 'testnet',
      endpoint: 'unknown endpoint',
      faucet: 'unknown endpoint',
      msafeDeployer: 'default',
    };
    const parsed = await parseConfig(c);

    expect(parsed.network === "testnet");
    expect(parsed.nodeURL === 'unknown endpoint');
    expect(parsed.faucetURL === 'unknown endpoint');
    expect(parsed.msafe.toString() === DEPLOYED_MSAFE.get('testnet'));
  });
});

