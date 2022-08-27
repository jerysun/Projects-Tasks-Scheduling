import { createStore } from 'vuex';
//import { localStoragePlugin } from './plugins/localStorage';
import application from './modules/application';
import project from './modules/project';

const store = createStore({
  modules: {
    project,
    application,
  },
  state() /*like data()*/ {
    return {};
  },
  getters: {}, // like computed property
  mutations: /*like component methods, you can't modify states without it*/ {},
  actions: {},
  //plugins: [localStoragePlugin],
});

export default store;
