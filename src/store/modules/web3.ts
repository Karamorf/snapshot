import Vue from 'vue';
import { Web3Provider } from '@ethersproject/providers';
import { getInstance } from '@snapshot-labs/lock/plugins/vue';
import getProvider from '@snapshot-labs/snapshot.js/src/utils/provider';
import networks from '@snapshot-labs/snapshot.js/src/networks.json';
import store from '@/store';
import { formatUnits } from '@ethersproject/units';

let wsProvider;
let auth;
const defaultNetwork =
  process.env.VUE_APP_DEFAULT_NETWORK || Object.keys(networks)[0];

if (wsProvider) {
  wsProvider.on('block', blockNumber => {
    store.commit('GET_BLOCK_SUCCESS', blockNumber);
  });
}

const state = {
  account: null,
  name: null,
  network: networks[defaultNetwork]
};

const mutations = {
  HANDLE_CHAIN_CHANGED(_state, chainId) {
    if (!networks[chainId]) {
      networks[chainId] = {
        ...networks[defaultNetwork],
        chainId,
        name: 'Unknown',
        network: 'unknown',
        unknown: true
      };
    }
    Vue.set(_state, 'network', networks[chainId]);
    console.debug('HANDLE_CHAIN_CHANGED', chainId);
  },
  WEB3_SET(_state, payload) {
    Object.keys(payload).forEach(key => {
      Vue.set(_state, key, payload[key]);
    });
  }
};

const actions = {
  login: async ({ dispatch, commit }, connector = 'injected') => {
    auth = getInstance();
    commit('SET', { authLoading: true });
    await auth.login(connector);
    if (auth.provider) {
      auth.web3 = new Web3Provider(auth.provider);
      await dispatch('loadProvider');
    }
    commit('SET', { authLoading: false });
  },
  logout: async ({ commit }) => {
    Vue.prototype.$auth.logout();
    commit('WEB3_SET', { account: null, name: null });
  },
  loadProvider: async ({ commit, dispatch }) => {
    try {
      if (auth.provider.removeAllListeners) auth.provider.removeAllListeners();
      if (auth.provider.on) {
        auth.provider.on('chainChanged', async chainId => {
          commit('HANDLE_CHAIN_CHANGED', parseInt(formatUnits(chainId, 0)));
        });
        auth.provider.on('accountsChanged', async accounts => {
          if (accounts.length !== 0) {
            commit('WEB3_SET', { account: accounts[0] });
            await dispatch('loadProvider');
          }
        });
        // auth.provider.on('disconnect', async () => {});
      }
      const [network, accounts] = await Promise.all([
        auth.web3.getNetwork(),
        auth.web3.listAccounts()
      ]);
      commit('HANDLE_CHAIN_CHANGED', network.chainId);
      const account = accounts.length > 0 ? accounts[0] : null;
      let name = '';
      try {
        name = await getProvider('1').lookupAddress(account);
      } catch (e) {
        console.error(e);
      }
      commit('WEB3_SET', { account, name });
    } catch (e) {
      commit('WEB3_SET', { account: null, name: null });
      return Promise.reject(e);
    }
  }
};

export default {
  state,
  mutations,
  actions
};
