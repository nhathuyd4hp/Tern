import { configureStore } from '@reduxjs/toolkit';
import tasksMiddleware from './middlewares/tasks/middleware';
import debugMiddleware from './middlewares/debug/middleware';
import appReducer from './slices/app';
import collectionsReducer from './slices/collections';
import tabsReducer from './slices/tabs';
import globalEnvironmentsReducer from './slices/global-environments';
import workspacesReducer from './slices/workspaces';
import openapiSyncReducer from './slices/openapi-sync';
import openCollectionModalReducer from './slices/open-collection-modal';
import { draftDetectMiddleware } from './middlewares/draft/middleware';
import { autosaveMiddleware } from './middlewares/autosave/middleware';
import { snapshotMiddleware } from './middlewares/snapshot/middleware';
import { benchmarkMiddleware } from './middlewares/benchmark/middleware';

const isDevEnv = () => {
  return import.meta.env.MODE === 'development';
};

let middleware = [tasksMiddleware.middleware, draftDetectMiddleware, autosaveMiddleware, snapshotMiddleware];
if (isDevEnv()) {
  middleware = [...middleware, debugMiddleware.middleware];
}

export const store = configureStore({
  reducer: {
    app: appReducer,
    collections: collectionsReducer,
    tabs: tabsReducer,
    globalEnvironments: globalEnvironmentsReducer,
    workspaces: workspacesReducer,
    openapiSync: openapiSyncReducer,
    openCollectionModal: openCollectionModalReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .prepend(...(__BRUNO_BENCHMARK__ ? [benchmarkMiddleware] : []))
      .concat(middleware)
});

export default store;
