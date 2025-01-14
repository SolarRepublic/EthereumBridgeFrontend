import { Contract } from 'web3-eth-contract';
import Web3 from 'web3';
import { mulDecimals } from '../../utils';
import { EIP1559Gas, getEIP1559Prices } from './helpers';
import { BigNumber } from 'bignumber.js';
import detectEthereumProvider from '@metamask/detect-provider';

const MAX_UINT = Web3.utils
  .toBN(2)
  .pow(Web3.utils.toBN(256))
  .sub(Web3.utils.toBN(1));

export interface IEthMethodsInitParams {
  web3: Web3;
  ethManagerContract: Contract;
  ethManagerAddress: string;
}

export class EthMethodsERC20 {
  public readonly web3: Web3;
  private ethManagerContract: Contract;
  private ethManagerAddress: string;

  constructor(params: IEthMethodsInitParams) {
    this.web3 = params.web3;
    this.ethManagerContract = params.ethManagerContract;
    this.ethManagerAddress = params.ethManagerAddress;
  }

  getGasPrice = async (): Promise<EIP1559Gas | BigNumber> => {
    return await getEIP1559Prices();
  };

  sendHandler = async (method: any, args: Object, callback: Function) => {
    method
      .send(args)
      .on('transactionHash', function(hash) {
        callback({ hash });
      })
      .then(function(receipt) {
        callback({ receipt });
      })
      .catch(function(error) {
        callback({ error });
      });
  };

  getAllowance = async erc20Address => {
    const callerAddress = await EthMethodsERC20.getCallerAddress();

    const MyERC20Json = require('../out/MyERC20.json');
    const erc20Contract = new this.web3.eth.Contract(MyERC20Json.abi, erc20Address);

    return await erc20Contract.methods.allowance(callerAddress, this.ethManagerAddress).call();
  };

  private static async getCallerAddress() {
    const provider = await detectEthereumProvider({ mustBeMetaMask: true });

    // @ts-ignore
    if (provider !== window.ethereum) {
      console.error('Do you have multiple wallets installed?');
    }

    // @ts-ignore
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    return accounts[0];
  }

  callApprove = async (erc20Address, amount, decimals, callback) => {
    const callerAddress = await EthMethodsERC20.getCallerAddress();

    const MyERC20Json = require('../out/MyERC20.json');
    const erc20Contract = new this.web3.eth.Contract(MyERC20Json.abi, erc20Address);

    amount = Number(mulDecimals(amount, decimals));

    const allowance = await this.getAllowance(erc20Address);
    const gasLimit = await erc20Contract.methods
      .approve(this.ethManagerAddress, MAX_UINT)
      .estimateGas({ from: callerAddress });

    const limit2 = (gasLimit * 1.2).toFixed(0);

    if (Number(allowance) < Number(amount)) {
      let gasPrices = await this.getGasPrice();

      if (gasPrices instanceof EIP1559Gas) {
        this.sendHandler(
          erc20Contract.methods.approve(this.ethManagerAddress, MAX_UINT),
          {
            from: callerAddress,
            gas: (gasLimit * 1.2).toFixed(0),
            //gasPrice: await getGasPrice(this.web3),
            // maxFeePerGas: gasPrices.maxFeePerGas.toString(),
            // maxPriorityFeePerGas: gasPrices.maxPriorityFeePerGas.toString(),
          },
          callback,
        );
      } else {
        this.sendHandler(
          erc20Contract.methods.approve(this.ethManagerAddress, MAX_UINT),
          {
            from: callerAddress,
            gas: (gasLimit * 1.2).toFixed(0),
            gasPrice: gasPrices.toString(),
            // maxFeePerGas: eip1559gas.maxFeePerGas,
            //maxPriorityFeePerGas: eip1559gas.maxPriorityFeePerGas,
          },
          callback,
        );
      }
    }
  };

  swapToken = async (erc20Address, userAddr, amount, decimals, callback) => {
    const callerAddress = await EthMethodsERC20.getCallerAddress();

    const secretAddrHex = this.web3.utils.fromAscii(userAddr);
    // TODO: add validation

    const estimateGas = await this.ethManagerContract.methods
      .swapToken(secretAddrHex, mulDecimals(amount, decimals), erc20Address)
      .estimateGas({ from: callerAddress });

    const gasLimit = new BigNumber(Math.max(estimateGas * 1.3, Number(process.env.ETH_GAS_LIMIT))).toFixed(0);

    // let eip1559gas = await getEIP1559Prices();
    let gasPrices = await this.getGasPrice();

    if (gasPrices instanceof EIP1559Gas) {
      this.sendHandler(
        this.ethManagerContract.methods.swapToken(secretAddrHex, mulDecimals(amount, decimals), erc20Address),
        {
          from: callerAddress,
          gas: gasLimit,
          // gasPrice: (await getGasPrice(this.web3)),
          // maxFeePerGas: GWeiToWei(eip1559gas.maxFeePerGas),
          // maxPriorityFeePerGas: GWeiToWei(eip1559gas.maxPriorityFeePerGas),
        },
        callback,
      );
    } else {
      this.sendHandler(
        this.ethManagerContract.methods.swapToken(secretAddrHex, mulDecimals(amount, decimals), erc20Address),
        {
          from: callerAddress,
          gas: gasLimit,
          gasPrice: gasPrices.toString(),
          // maxFeePerGas: GWeiToWei(eip1559gas.maxFeePerGas),
          // maxPriorityFeePerGas: GWeiToWei(eip1559gas.maxPriorityFeePerGas),
        },
        callback,
      );
    }
  };

  checkEthBalance = async (erc20Address, addr) => {
    const MyERC20Json = require('../out/MyERC20.json');
    const erc20Contract = new this.web3.eth.Contract(MyERC20Json.abi, erc20Address);

    return await erc20Contract.methods.balanceOf(addr).call();
  };

  tokenDetails = async erc20Address => {
    if (!this.web3.utils.isAddress(erc20Address)) {
      throw new Error('Invalid token address');
    }

    const MyERC20Json = require('../out/MyERC20.json');
    const erc20Contract = new this.web3.eth.Contract(MyERC20Json.abi, erc20Address);

    let name = '';
    let symbol = '';
    // maker has some weird encoding for these.. so whatever
    if (erc20Address === '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2') {
      name = 'Maker';
      symbol = 'MKR';
    } else {
      name = await erc20Contract.methods.name().call();
      symbol = await erc20Contract.methods.symbol().call();
    }
    // todo: check if all the erc20s we care about have the decimals method (it's not required by the standard)
    const decimals = await erc20Contract.methods.decimals().call();

    return { name, symbol, decimals, erc20Address };
  };
}
