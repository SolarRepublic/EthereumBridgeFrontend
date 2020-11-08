import { action, observable } from 'mobx';
import { IStores } from 'stores';
import { statusFetching } from '../constants';
import {
  getHmyBalance,
  hmyMethodsERC20,
  hmyMethodsBUSD,
  hmyMethodsLINK,
} from '../blockchain-bridge';
import { StoreConstructor } from './core/StoreConstructor';
import * as agent from 'superagent';
import { IOperation } from './interfaces';
import { divDecimals } from '../utils';
import { SigningCosmosClient } from '@cosmjs/launchpad';

const defaults = {};

export class UserStoreEx extends StoreConstructor {
  public stores: IStores;
  @observable public isAuthorized: boolean;
  public status: statusFetching;
  redirectUrl: string;

  private keplrWallet: any;
  private keplrOfflineSigner: any;
  private cosmJS: SigningCosmosClient;
  @observable public isKeplrWallet = false;

  @observable public sessionType: 'mathwallet' | 'ledger' | 'wallet';
  @observable public address: string;

  @observable public balance: string = '0';
  /* 
  @observable public hmyBUSDBalance: string = '0';
  @observable public hmyLINKBalance: string = '0';
  */
  @observable public hmyBUSDBalanceManager: number = 0;
  @observable public hmyLINKBalanceManager: number = 0;

  @observable public scrtRate = 0;
  @observable public ethRate = 0;

  @observable public hrc20Address = '';
  @observable public hrc20Balance = '';

  @observable public isInfoReading = false;

  constructor(stores) {
    super(stores);

    setInterval(async () => {
      // @ts-ignore
      this.isKeplrWallet = !!window.keplr && !!(window as any).getOfflineSigner;
      // @ts-ignore
      this.keplrWallet = window.keplr;

      const chainId = 'secret-2';
      if (this.isKeplrWallet) {
        await this.keplrWallet.enable(chainId);

        this.keplrOfflineSigner = (window as any).getOfflineSigner(chainId);
        const accounts = await this.keplrOfflineSigner.getAccounts();
        this.address = accounts[0].address;
        this.isAuthorized = true;

        this.cosmJS = new SigningCosmosClient(
          'https://secret-2.node.enigma.co/',
          this.address,
          this.keplrOfflineSigner,
        );
      }

      // await this.getBalances();
      // await this.getOneBalance();
    }, 3000);

    setInterval(() => this.getBalances(), 3 * 1000);

    this.getRates();

    // @ts-ignore
    this.isKeplrWallet = !!window.keplr;
    // @ts-ignore
    this.keplrWallet = window.keplr;
    /* 
    const session = localStorage.getItem('harmony_session');

    const sessionObj = JSON.parse(session);

    if (sessionObj && sessionObj.isInfoReading) {
      this.isInfoReading = sessionObj.isInfoReading;
    }

    if (sessionObj && sessionObj.address) {
      this.address = sessionObj.address;
      this.sessionType = sessionObj.sessionType;
      this.isAuthorized = true;

      this.stores.exchange.transaction.oneAddress = this.address;

      this.getSecretBalance();
    }
 */
  }

  @action public setInfoReading() {
    this.isInfoReading = true;
    this.syncLocalStorage();
  }

  @action public signIn() {
    return this.keplrWallet
      .getAccount()
      .then(account => {
        this.sessionType = `mathwallet`;
        this.address = account.address;
        this.isAuthorized = true;

        this.stores.exchange.transaction.oneAddress = this.address;

        this.syncLocalStorage();

        this.getSecretBalance();

        return Promise.resolve();
      })
      .catch(e => {
        this.keplrWallet.forgetIdentity();
      });
  }

  @action public getBalances = async () => {
    if (this.address) {
      try {
        const account = await this.cosmJS.getAccount(this.address);
        this.balance = divDecimals(
          account.balance.filter(x => x.denom === 'uscrt')[0].amount,
          6,
        );

        /* 
        let res = await getHmyBalance(this.address);
        this.balance = res && res.result;

        if (this.hrc20Address) {
          const hrc20Balance = await hmyMethodsERC20.checkHmyBalance(
            this.hrc20Address,
            this.address,
          );

          this.hrc20Balance = divDecimals(
            hrc20Balance,
            this.stores.userMetamask.erc20TokenDetails.decimals,
          );
        }

        let resBalance = 0;

        resBalance = await hmyMethodsBUSD.checkHmyBalance(this.address);
        this.hmyBUSDBalance = divDecimals(resBalance, 18);

        resBalance = await hmyMethodsLINK.checkHmyBalance(this.address);
        this.hmyLINKBalance = divDecimals(resBalance, 18);
 */
      } catch (e) {
        console.error(e);
      }
    }
  };

  @action public getSecretBalance = async () => {
    if (this.address) {
      const account = await this.cosmJS.getAccount(this.address);
      this.balance = divDecimals(
        account.balance.filter(x => x.denom === 'uscrt')[0].amount,
        6,
      );
    }
  };

  @action public signOut() {
    if (this.isKeplrWallet) {
      this.isAuthorized = false;

      return this.keplrWallet
        .forgetIdentity()
        .then(() => {
          this.sessionType = null;
          this.address = null;
          this.isAuthorized = false;

          // this.balanceGem = '0';
          // this.balanceDai = '0';
          // this.balance = '0';
          //
          // this.vat = { ink: '0', art: '0' };

          this.syncLocalStorage();

          return Promise.resolve();
        })
        .catch(err => {
          console.error(err.message);
        });
    }
  }

  private syncLocalStorage() {
    localStorage.setItem(
      'harmony_session',
      JSON.stringify({
        address: this.address,
        sessionType: this.sessionType,
        isInfoReading: this.isInfoReading,
      }),
    );
  }

  @action public signTransaction(txn: any) {
    if (this.sessionType === 'mathwallet' && this.isKeplrWallet) {
      return this.keplrWallet.signTransaction(txn);
    }
  }

  public saveRedirectUrl(url: string) {
    if (!this.isAuthorized && url) {
      this.redirectUrl = url;
    }
  }

  @action public async getRates() {
    const scrtbtc = await agent.get<{ body: IOperation }>(
      'https://api.binance.com/api/v1/ticker/24hr?symbol=SCRTBTC',
    );
    const btcusdt = await agent.get<{ body: IOperation }>(
      'https://api.binance.com/api/v1/ticker/24hr?symbol=BTCUSDT',
    );

    this.scrtRate = scrtbtc.body.lastPrice * btcusdt.body.lastPrice;

    const ethusdt = await agent.get<{ body: IOperation }>(
      'https://api.binance.com/api/v1/ticker/24hr?symbol=ETHUSDT',
    );

    this.ethRate = ethusdt.body.lastPrice;
  }
}
