import Web3 from 'web3';
import { divDecimals, mulDecimals } from '../../utils';
import { web3 } from './index';
import * as agent from 'superagent';
const BN = require('bn.js');

export const getGasPrice = async (web3: Web3) => {
  return new BN(await web3.eth.getGasPrice()).mul(new BN(1));
};

export const getBridgeGasPrice = async (web3: Web3) => {
  let gasPriceApi = 0;

  try {
    const info = await agent.get(`https://ethgasstation.info/api/ethgasAPI.json`);

    gasPriceApi = mulDecimals(info.body.fast, 8);

    return new BN(gasPriceApi);
  } catch (e) {
    console.error(`Error getting gas price: ${e}`);
  }
  return new BN(await web3.eth.getGasPrice()).mul(new BN(1));
};

export const isGasCrazy = async (): Promise<boolean> => {
  try {
    const info = await agent.get(`https://ethgasstation.info/api/ethgasAPI.json`);

    if (info.body.fastest > info.body.average * 2) {
      return true;
    }
  } catch (e) {
    console.error(`Error getting gas price: ${e}`);
  }
  return false;
};

export const getNetworkFee = async (gas_amount: number, decimals?: number, bridgePrice?: boolean) => {
  let gasPrice;
  if (bridgePrice) {
    gasPrice = await getBridgeGasPrice(web3);
  } else {
    gasPrice = await getGasPrice(web3);
  }

  const gasLimit = new BN(gas_amount);

  const fee = gasLimit.mul(gasPrice);

  return Number(divDecimals(fee, decimals || 18));
};

export const ethToWei = (amount: string | number) => mulDecimals(amount, 18);

export const GWeiToWei = (amount: string | number) => mulDecimals(amount, 9);

interface EIP1559Gas {
  maxFeePerGas: number;
  maxPriorityFeePerGas: number;
}

export const getEIP1559Prices = async (): Promise<EIP1559Gas> => {
  try {
    const info = await agent.get(`https://blocknative-api.herokuapp.com/data`);

    return {
      maxFeePerGas: info.body.estimatedPrices[1].maxFeePerGas,
      maxPriorityFeePerGas: info.body.estimatedPrices[1].maxPriorityFeePerGas,
    };
  } catch (e) {
    return { maxFeePerGas: undefined, maxPriorityFeePerGas: undefined };
  }
};
